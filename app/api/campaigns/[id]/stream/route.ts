import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/prisma";
import { subscribeCampaign } from "@/lib/live";

// SSE stream: one "roll" event per ingested message for this campaign.
// Members only — same check as the campaign page; EventSource sends the Clerk
// session cookie automatically.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return new Response("unauthorized", { status: 401 });
  const member = await prisma.campaignMember.findUnique({
    where: { campaignId_userId: { campaignId: id, userId } },
  });
  if (!member) return new Response("not a member", { status: 403 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      // Enqueueing after the client vanishes throws on the dead controller
      // (dev logs it as "transformAlgorithm is not a function") — treat any
      // enqueue failure as a disconnect and tear down.
      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      const unsubscribe = subscribeCampaign(id, () => write("data: roll\n\n"));
      // Comment-frame heartbeat keeps proxies from idling the connection out.
      const heartbeat = setInterval(() => write(": ping\n\n"), 25_000);
      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      request.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
