import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { actorFidsForKind, sessions } from "@/lib/stats";
import { authorizeCampaignKey } from "@/lib/api-auth";

// Read API: play sessions (one per distinct date), numbered oldest-first.
// With actor/kind filters the numbering stays campaign-global; counts narrow
// to the matching rolls and dates without any drop out.

const querySchema = z.object({
  actor: z.string().max(200).optional(),
  kind: z.enum(["pc", "npc", "monster"]).optional(),
});

export async function GET(request: Request) {
  const campaignId = await authorizeCampaignKey(request);
  if (!campaignId) {
    return Response.json({ error: "invalid campaign id or api key" }, { status: 401 });
  }
  const params = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!params.success) {
    return Response.json({ error: "invalid query", detail: params.error.issues }, { status: 400 });
  }
  const q = params.data;

  const all = await sessions(campaignId);
  if (!q.actor && !q.kind) return Response.json({ sessions: all });

  const actorFids = q.kind ? await actorFidsForKind(campaignId, q.kind) : undefined;
  const rows = await prisma.roll.groupBy({
    by: ["rolledAt"],
    where: {
      campaignId,
      deletedAt: null,
      ...(q.actor ? { actorName: q.actor } : {}),
      ...(actorFids ? { actorFid: { in: actorFids } } : {}),
    },
    _count: { _all: true },
  });
  const byDay = new Map<string, number>();
  for (const r of rows) {
    const dayKey = r.rolledAt.toISOString().slice(0, 10);
    byDay.set(dayKey, (byDay.get(dayKey) ?? 0) + r._count._all);
  }

  return Response.json({
    sessions: all
      .filter((s) => byDay.has(s.date))
      .map((s) => ({ ...s, rolls: byDay.get(s.date)! })),
  });
}
