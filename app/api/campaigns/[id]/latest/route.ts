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

  const latest = await prisma.rawEvent.aggregate({
    where: { campaignId: id },
    _max: { updatedAt: true },
    _count: true,
  });
  return Response.json(
    { t: latest._max.updatedAt?.toISOString() ?? null, n: latest._count },
    { headers: { "Cache-Control": "no-store" } },
  );
}
