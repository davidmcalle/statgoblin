import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/prisma";
import { subscribeCampaign } from "@/lib/events";

// Live dashboard stream (SSE): the client opens this once and the server pushes
// an "activity" event whenever a roll lands or a shared mutation happens, so
// the page re-renders on real change instead of polling every 4s. Every
// enqueue/close is guarded — writing to a torn-down stream throws, which is
// what tripped the earlier SSE attempt — and a heartbeat keeps proxies from
// dropping an idle connection.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEARTBEAT_MS = 25_000;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return new Response("unauthorized", { status: 401 });
  const member = await prisma.campaignMember.findUnique({
    where: { campaignId_userId: { campaignId: id, userId } },
  });
  if (!member) return new Response("not a member", { status: 403 });

  const encoder = new TextEncoder();
  let unsubscribe: () => void = () => {};
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // stream already torn down — stop touching it
          closed = true;
        }
      };
      const teardown = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      // Reconnect hint + an initial event so the client knows it's live.
      send("retry: 5000\n\n");
      send("event: ready\ndata: 1\n\n");

      unsubscribe = subscribeCampaign(id, () => send(`event: activity\ndata: ${Date.now()}\n\n`));
      heartbeat = setInterval(() => send(": ping\n\n"), HEARTBEAT_MS);
      request.signal.addEventListener("abort", teardown);
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Tell any buffering proxy (nginx-style) not to hold the stream.
      "X-Accel-Buffering": "no",
    },
  });
}
