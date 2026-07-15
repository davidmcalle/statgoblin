// In-memory pub/sub for live dashboard updates. A roll lands (or a shared
// mutation happens) → publishCampaignActivity fans out to every open SSE
// connection for that campaign, which nudges the browser to re-render. This
// replaces the old 4s freshness poll: no query runs unless something actually
// changed.
//
// Single process only. Fanning out across multiple app instances would need a
// shared bus (Redis) — but the homelab runs one instance, so an in-memory
// registry needs no extra infrastructure to run, back up, or fail. Kept on
// globalThis so HMR and duplicate module instances share one registry.

type Subscriber = () => void;

const store = globalThis as unknown as {
  __campaignSubscribers?: Map<string, Set<Subscriber>>;
};
const subscribers: Map<string, Set<Subscriber>> =
  store.__campaignSubscribers ?? (store.__campaignSubscribers = new Map());

/** Register a listener for a campaign's activity; returns an unsubscribe fn. */
export function subscribeCampaign(campaignId: string, fn: Subscriber): () => void {
  let set = subscribers.get(campaignId);
  if (!set) {
    set = new Set();
    subscribers.set(campaignId, set);
  }
  set.add(fn);
  return () => {
    const current = subscribers.get(campaignId);
    if (!current) return;
    current.delete(fn);
    if (current.size === 0) subscribers.delete(campaignId);
  };
}

/** Notify every open connection watching this campaign. Cheap, synchronous. */
export function publishCampaignActivity(campaignId: string): void {
  const set = subscribers.get(campaignId);
  if (!set) return;
  // Snapshot so an unsubscribe during iteration can't disturb the loop, and
  // isolate each callback so one dead connection can't break the rest.
  for (const fn of [...set]) {
    try {
      fn();
    } catch {
      // a broken subscriber shouldn't stop the fan-out
    }
  }
}
