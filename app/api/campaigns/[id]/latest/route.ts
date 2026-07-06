import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/prisma";

// Tiny freshness probe for the live dashboard: the client polls this and
// re-renders the page when the value changes. Plain request/response — no
// long-lived streams (SSE in dev tripped Node's stream-teardown TypeError,
// and proxies dislike idle streams anyway).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return new Response("unauthorized", { status: 401 });
  const member = await prisma.campaignMember.findUnique({
    where: { campaignId_userId: { campaignId: id, userId } },
  });
  if (!member) return new Response("not a member", { status: 403 });

  // Version = newest of (a) event activity — ingest and roll deletions both
  // bump raw_events.updated_at — and (b) the campaign's activity stamp, which
  // shared mutations (assign/kind/settings/joins) publish through.
  const [latest, campaign] = await Promise.all([
    prisma.rawEvent.aggregate({
      where: { campaignId: id },
      _max: { updatedAt: true },
      _count: true,
    }),
    prisma.campaign.findUnique({ where: { id }, select: { activityAt: true } }),
  ]);
  const newest = Math.max(
    latest._max.updatedAt?.getTime() ?? 0,
    campaign?.activityAt.getTime() ?? 0,
  );
  return Response.json(
    { t: newest ? new Date(newest).toISOString() : null, n: latest._count },
    { headers: { "Cache-Control": "no-store" } },
  );
}
