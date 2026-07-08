import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { effectiveKind } from "@/lib/kind";
import { authorizeCampaignKey } from "@/lib/api-auth";

// Read API: the campaign's discovered actors with their effective kind.
// Filterable by kind, name substring, and activity window (actors that
// actually rolled in a session / date range).

const querySchema = z.object({
  kind: z.enum(["pc", "npc", "monster"]).optional(),
  search: z.string().max(200).optional(),
  session: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
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

  // Activity window: keep only actors with at least one live roll inside it.
  const day = (d: string) => new Date(`${d}T00:00:00Z`);
  let activeFids: Set<string> | null = null;
  if (q.session || q.from || q.to) {
    const rolled = await prisma.roll.findMany({
      where: {
        campaignId,
        deletedAt: null,
        actorFid: { not: null },
        ...(q.session
          ? { sessionDate: day(q.session) }
          : {
              rolledAt: {
                ...(q.from ? { gte: day(q.from) } : {}),
                ...(q.to ? { lt: new Date(day(q.to).getTime() + 86_400_000) } : {}),
              },
            }),
      },
      distinct: ["actorFid"],
      select: { actorFid: true },
    });
    activeFids = new Set(rolled.map((r) => r.actorFid!));
  }

  const actors = await prisma.actor.findMany({
    where: {
      campaignId,
      ...(q.search ? { name: { contains: q.search, mode: "insensitive" as const } } : {}),
    },
    orderBy: { name: "asc" },
    select: {
      foundryActorId: true,
      name: true,
      actorType: true,
      kindOverride: true,
      cr: true,
      rollCount: true,
      assignedUserId: true,
      lastSeenAt: true,
    },
  });

  const shaped = actors
    .filter((a) => !activeFids || activeFids.has(a.foundryActorId))
    .map(({ assignedUserId, ...a }) => ({
      ...a,
      kind: effectiveKind({ ...a, assignedUserId }),
      assigned: !!assignedUserId,
    }))
    .filter((a) => !q.kind || a.kind === q.kind);

  return Response.json({ actors: shaped });
}
