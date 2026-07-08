import { prisma } from "@/lib/db/prisma";
import { effectiveKind } from "@/lib/kind";
import { authorizeCampaignKey } from "@/lib/api-auth";

// Read API: the campaign's discovered actors with their effective kind.
export async function GET(request: Request) {
  const campaignId = await authorizeCampaignKey(request);
  if (!campaignId) {
    return Response.json({ error: "invalid campaign id or api key" }, { status: 401 });
  }
  const actors = await prisma.actor.findMany({
    where: { campaignId },
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
  return Response.json({
    actors: actors.map(({ assignedUserId, ...a }) => ({
      ...a,
      kind: effectiveKind({ ...a, assignedUserId }),
      assigned: !!assignedUserId,
    })),
  });
}
