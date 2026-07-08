import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/prisma";

// Everything we hold that's attributable to the signed-in user, as one JSON
// download: memberships, their assigned characters, and every roll those
// characters made. Rolls are keyed to characters, not accounts — this is the
// complete user-linked set.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return new Response("unauthorized", { status: 401 });

  const memberships = await prisma.campaignMember.findMany({
    where: { userId },
    include: { campaign: { select: { id: true, name: true, creatorId: true } } },
  });

  const campaigns = await Promise.all(
    memberships.map(async (m) => {
      const actors = await prisma.actor.findMany({
        where: { campaignId: m.campaignId, assignedUserId: userId },
        select: {
          foundryActorId: true,
          name: true,
          actorType: true,
          kindOverride: true,
          cr: true,
          rollCount: true,
          lastSeenAt: true,
        },
      });
      const rolls = actors.length
        ? await prisma.roll.findMany({
            where: {
              campaignId: m.campaignId,
              deletedAt: null,
              actorFid: { in: actors.map((a) => a.foundryActorId) },
            },
            orderBy: [{ rolledAt: "asc" }, { rollIndex: "asc" }],
            omit: { campaignId: true, rawEventId: true, deletedAt: true },
          })
        : [];
      return {
        campaignId: m.campaign.id,
        campaignName: m.campaign.name,
        role: m.role,
        joinedAt: m.joinedAt,
        isCreator: m.campaign.creatorId === userId,
        characters: actors,
        rolls,
      };
    }),
  );

  const body = JSON.stringify(
    { exportedAt: new Date().toISOString(), userId, campaigns },
    null,
    2,
  );
  return new Response(body, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="statgoblin-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
