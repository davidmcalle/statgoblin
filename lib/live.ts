import { EventEmitter } from "node:events";

// In-process pub/sub linking ingest to SSE subscribers. Single-instance only —
// if the app ever runs multiple replicas, replace this with Redis pub/sub
// behind the same two functions. Cached on globalThis so dev HMR doesn't strand
// subscribers on a dead emitter.
const g = globalThis as unknown as { rollwatchLive?: EventEmitter };

const emitter =
  g.rollwatchLive ??
  (() => {
    const e = new EventEmitter();
    e.setMaxListeners(0); // one listener per open dashboard tab
    g.rollwatchLive = e;
    return e;
  })();

export function publishCampaignEvent(campaignId: string): void {
  emitter.emit(`campaign:${campaignId}`);
}

export function subscribeCampaign(campaignId: string, listener: () => void): () => void {
  const channel = `campaign:${campaignId}`;
  emitter.on(channel, listener);
  return () => emitter.off(channel, listener);
}
