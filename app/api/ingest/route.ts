import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

// The Foundry module POSTs cross-origin with an Authorization header, so the
// browser preflights every request — answer OPTIONS and echo CORS headers on
// every response.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Minimal envelope check only — collectedData is mirrored verbatim into JSONB.
// Shape exploration happens in the DB, not the validator.
const eventSchema = z.object({
  eventType: z.enum(["created", "updated", "deleted"]),
  messageId: z.string().min(1),
  collectedData: z.record(z.string(), z.unknown()).nullable(),
});

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return Response.json({ error: "missing bearer token" }, { status: 401, headers: CORS_HEADERS });
  }
  const campaign = await prisma.campaign.findUnique({ where: { ingestToken: token } });
  if (!campaign) {
    return Response.json({ error: "unknown ingest token" }, { status: 401, headers: CORS_HEADERS });
  }

  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "invalid event", detail: parsed.error.issues },
      { status: 400, headers: CORS_HEADERS },
    );
  }
  const { eventType, messageId, collectedData } = parsed.data;

  // Upsert per message: N clients replay the same event and midi-qol mutates a
  // message several times — last write wins, receivedCount records the churn.
  // Deletes keep the final payload and stamp deletedAt.
  const deletedAt = eventType === "deleted" ? new Date() : null;
  await prisma.rawEvent.upsert({
    where: { campaignId_messageId: { campaignId: campaign.id, messageId } },
    create: {
      campaignId: campaign.id,
      messageId,
      lastEventType: eventType,
      payload: collectedData ?? undefined,
      deletedAt,
    },
    update: {
      lastEventType: eventType,
      ...(collectedData ? { payload: collectedData } : {}),
      ...(deletedAt ? { deletedAt } : {}),
      receivedCount: { increment: 1 },
    },
  });

  return Response.json({ ok: true }, { headers: CORS_HEADERS });
}
