import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { hashIngestKey } from "@/lib/campaigns";
import { deriveRawEvent } from "@/lib/derive";

// The Foundry module POSTs cross-origin with Authorization + X-Campaign-Id
// headers, so the browser preflights every request — answer OPTIONS and echo
// CORS headers on every response.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Campaign-Id",
};

// Minimal envelope check only — collectedData is mirrored verbatim into JSONB.
const eventSchema = z.object({
  eventType: z.enum(["created", "updated", "deleted"]),
  messageId: z.string().min(1),
  collectedData: z.record(z.string(), z.unknown()).nullable(),
});

const uuidSchema = z.uuid();

function unauthorized(detail: string) {
  return Response.json({ error: detail }, { status: 401, headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  // Two credentials: the campaign UUID identifies, an admin API key (known
  // only to the GM, stored hashed) authorizes. A member who knows the UUID
  // can't ingest into — or replay rolls out of — someone else's campaign.
  const key = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const campaignId = uuidSchema.safeParse(request.headers.get("x-campaign-id")?.trim());
  if (!key || !campaignId.success) return unauthorized("missing campaign id or api key");

  const apiKey = await prisma.apiKey.findUnique({ where: { keyHash: hashIngestKey(key) } });
  if (!apiKey || apiKey.campaignId !== campaignId.data) {
    return unauthorized("invalid campaign id or api key");
  }
  const campaign = { id: apiKey.campaignId };
  // Fire-and-forget freshness stamp; ingest shouldn't block on bookkeeping.
  void prisma.apiKey
    .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "invalid event", detail: parsed.error.issues },
      { status: 400, headers: CORS_HEADERS },
    );
  }
  const { eventType, messageId } = parsed.data;
  const collectedData = parsed.data.collectedData as Prisma.InputJsonValue | null;

  // Upsert per message: N clients replay the same event and midi-qol mutates a
  // message several times — last write wins, receivedCount records the churn.
  // Deletes keep the final payload and stamp deletedAt.
  const deletedAt = eventType === "deleted" ? new Date() : null;
  const row = await prisma.rawEvent.upsert({
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

  // Incremental derive — same code path reprocess uses, so live ingest and
  // rebuilds can't drift apart. Dashboards notice via the /latest poll.
  await deriveRawEvent(row);

  return Response.json({ ok: true }, { headers: CORS_HEADERS });
}
