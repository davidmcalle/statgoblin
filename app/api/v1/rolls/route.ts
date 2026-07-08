import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { authorizeCampaignKey } from "@/lib/api-auth";

// Read API: derived rolls, filterable with the same axes as the dashboard.
// Auth: X-Campaign-Id + Bearer admin API key (see /developers).

const querySchema = z.object({
  actor: z.string().max(200).optional(),
  type: z.string().max(50).optional(),
  kind: z.enum(["pc", "npc", "monster"]).optional(),
  session: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** ISO datetime — rows written/updated since then, for incremental sync. */
  updated_since: z.iso.datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(request: Request) {
  const campaignId = await authorizeCampaignKey(request);
  if (!campaignId) {
    return Response.json({ error: "invalid campaign id or api key" }, { status: 401 });
  }

  const params = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!params.success) {
    return Response.json(
      { error: "invalid query", detail: params.error.issues },
      { status: 400 },
    );
  }
  const q = params.data;

  // Kind filter resolves through the actors table, like the dashboard.
  let actorFids: string[] | undefined;
  if (q.kind) {
    const { actorFidsForKind } = await import("@/lib/stats");
    actorFids = await actorFidsForKind(campaignId, q.kind);
  }

  const day = (d: string) => new Date(`${d}T00:00:00Z`);
  const where = {
    campaignId,
    deletedAt: null,
    isHidden: false,
    ...(q.updated_since ? { updatedAt: { gte: new Date(q.updated_since) } } : {}),
    ...(q.actor ? { actorName: q.actor } : {}),
    ...(q.type ? { rollType: q.type } : {}),
    ...(actorFids ? { actorFid: { in: actorFids } } : {}),
    ...(q.session
      ? { rolledAt: { gte: day(q.session), lt: new Date(day(q.session).getTime() + 86_400_000) } }
      : q.from || q.to
        ? {
            rolledAt: {
              ...(q.from ? { gte: day(q.from) } : {}),
              ...(q.to ? { lt: new Date(day(q.to).getTime() + 86_400_000) } : {}),
            },
          }
        : {}),
  };

  const [total, rolls] = await Promise.all([
    prisma.roll.count({ where }),
    prisma.roll.findMany({
      where,
      // Incremental consumers page by update time; everyone else by roll time.
      orderBy: q.updated_since
        ? [{ updatedAt: "asc" as const }, { rollIndex: "asc" as const }]
        : [{ rolledAt: "asc" as const }, { rollIndex: "asc" as const }],
      skip: q.offset,
      take: q.limit,
      select: {
        id: true,
        messageId: true,
        rollType: true,
        actorFid: true,
        actorName: true,
        actorType: true,
        authorName: true,
        authorRole: true,
        itemName: true,
        itemType: true,
        activityType: true,
        formula: true,
        total: true,
        dice: true,
        modifier: true,
        dc: true,
        d20: true,
        advantageState: true,
        isNat20: true,
        isNat1: true,
        isHit: true,
        isCritical: true,
        damageTotal: true,
        damageType: true,
        targetCount: true,
        ability: true,
        skill: true,
        rolledAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  return Response.json({ total, limit: q.limit, offset: q.offset, rolls });
}
