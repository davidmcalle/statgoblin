// In-memory LRU cache for the dashboard's aggregate bundle. Keyed by campaign
// + filter set + a version stamp that bumps on any write (campaignVersion), so
// a cached bundle is only ever served for data that hasn't changed since. On a
// cache hit the render skips ~14 aggregate scans and returns the held result;
// on a write the version changes, the key changes, and the next render
// recomputes. Pairs with the SSE bus: SSE says "changed" → re-render → new
// version → miss → recompute; unchanged → same version → hit → near-free.
//
// Single process, like the event bus — a multi-instance deploy would move this
// to a shared store. Kept on globalThis so HMR shares one map. inspect() backs
// the GM cache viewer.

type Entry = {
  campaignId: string;
  /** Human-readable filter description for the viewer. */
  label: string;
  /** Version stamp the entry was computed at. */
  version: number;
  value: unknown;
  sizeBytes: number;
  createdAt: number;
  hits: number;
};

const MAX_ENTRIES = 300;

const store = globalThis as unknown as {
  __aggCache?: Map<string, Entry>;
  __aggCacheStats?: { hits: number; misses: number };
};
const cache: Map<string, Entry> = store.__aggCache ?? (store.__aggCache = new Map());
const counters = store.__aggCacheStats ?? (store.__aggCacheStats = { hits: 0, misses: 0 });

function keyOf(campaignId: string, version: number, parts: Record<string, unknown>): string {
  return `${campaignId}|${version}|${JSON.stringify(parts)}`;
}

/**
 * Return the cached bundle for (campaign, version, filter) or compute+store it.
 * `parts` uniquely identifies the filter set; `label` is shown in the viewer.
 */
export async function getOrCompute<T>(
  campaignId: string,
  version: number,
  parts: Record<string, unknown>,
  label: string,
  compute: () => Promise<T>,
): Promise<T> {
  const key = keyOf(campaignId, version, parts);
  const hit = cache.get(key);
  if (hit) {
    hit.hits += 1;
    // Re-insert to mark most-recently-used (Map keeps insertion order).
    cache.delete(key);
    cache.set(key, hit);
    counters.hits += 1;
    return hit.value as T;
  }
  counters.misses += 1;
  const value = await compute();
  let sizeBytes = 0;
  try {
    sizeBytes = JSON.stringify(value)?.length ?? 0;
  } catch {
    // non-serializable slips through as size 0; caching still works
  }
  cache.set(key, {
    campaignId,
    label,
    version,
    value,
    sizeBytes,
    createdAt: Date.now(),
    hits: 0,
  });
  // Evict least-recently-used until under the cap.
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  return value;
}

export type CacheEntryView = {
  label: string;
  version: number;
  sizeBytes: number;
  ageMs: number;
  hits: number;
  /** True when this entry matches the campaign's current version (live). */
  current: boolean;
};

/** Entries for one campaign, newest version first. `currentVersion` tags live rows. */
export function inspectCampaign(campaignId: string, currentVersion: number): CacheEntryView[] {
  const now = Date.now();
  const rows: CacheEntryView[] = [];
  for (const e of cache.values()) {
    if (e.campaignId !== campaignId) continue;
    rows.push({
      label: e.label,
      version: e.version,
      sizeBytes: e.sizeBytes,
      ageMs: now - e.createdAt,
      hits: e.hits,
      current: e.version === currentVersion,
    });
  }
  return rows.sort((a, b) => b.version - a.version || b.hits - a.hits);
}

/** Drop every entry for a campaign; returns how many were removed. */
export function clearCampaign(campaignId: string): number {
  let removed = 0;
  for (const [key, e] of cache) {
    if (e.campaignId === campaignId) {
      cache.delete(key);
      removed += 1;
    }
  }
  return removed;
}

export function cacheStats(): { entries: number; hits: number; misses: number } {
  return { entries: cache.size, hits: counters.hits, misses: counters.misses };
}
