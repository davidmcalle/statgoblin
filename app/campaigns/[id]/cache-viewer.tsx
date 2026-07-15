"use client";

import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import {
  clearCampaignCache,
  getCacheEntryValue,
  getCacheReport,
  type CacheReport,
} from "@/app/actions/campaigns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function humanAge(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.round(m / 60)}h`;
}

// GM-only: a Redis-explorer-style view of the in-memory aggregate cache for
// this campaign. Each row is one cached filter set — its key, size, age, hit
// count, and whether it's still live (matches the campaign's current version)
// or stale (a newer write superseded it, pending eviction).
export function CacheViewer({ campaignId }: { campaignId: string }) {
  const [report, setReport] = useState<CacheReport | null>(null);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  // key -> fetched JSON payload (or a loading/gone marker), for expanded rows.
  const [values, setValues] = useState<Record<string, string>>({});
  const [openKey, setOpenKey] = useState<string | null>(null);

  const refresh = () => {
    setValues({});
    startTransition(async () => setReport(await getCacheReport(campaignId)));
  };

  useEffect(() => {
    startTransition(async () => setReport(await getCacheReport(campaignId)));
  }, [campaignId]);

  const toggle = (key: string) => {
    if (openKey === key) {
      setOpenKey(null);
      return;
    }
    setOpenKey(key);
    if (values[key] === undefined) {
      startTransition(async () => {
        const json = await getCacheEntryValue(campaignId, key);
        setValues((v) => ({ ...v, [key]: json ?? "// entry was evicted" }));
      });
    }
  };

  const entries = useMemo(() => {
    const list = report?.entries ?? [];
    const term = query.trim().toLowerCase();
    return term ? list.filter((e) => e.label.toLowerCase().includes(term)) : list;
  }, [report, query]);

  const stats = report?.stats;
  const total = stats ? stats.hits + stats.misses : 0;
  const hitRate = total ? Math.round((stats!.hits / total) * 100) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aggregate cache</CardTitle>
        <CardDescription>
          In-memory dashboard cache. Entries invalidate automatically when rolls change — a live
          entry is served as-is; a stale one is superseded and awaiting eviction.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>{stats?.entries ?? 0} entries cached (all campaigns)</span>
          <span>{stats?.hits ?? 0} hits</span>
          <span>{stats?.misses ?? 0} misses</span>
          {hitRate !== null && <span>{hitRate}% hit rate</span>}
          <span className="font-mono text-xs">version {report?.version ?? 0}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search keys…"
            className="h-9 min-w-40 flex-1 rounded-md border border-border bg-transparent px-3 text-sm"
          />
          <Button variant="outline" size="sm" onClick={refresh} disabled={pending}>
            {pending ? "…" : "Refresh"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await clearCampaignCache(campaignId);
                setReport(await getCacheReport(campaignId));
              })
            }
          >
            Clear
          </Button>
        </div>

        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {report
              ? query
                ? "No entries match that search."
                : "No cached entries for this campaign yet — load or re-render a dashboard view."
              : "Loading…"}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <th className="py-1 pr-3 font-medium">Key</th>
                  <th className="py-1 pr-3 font-medium">Size</th>
                  <th className="py-1 pr-3 font-medium">Age</th>
                  <th className="py-1 pr-3 font-medium">Hits</th>
                  <th className="py-1 font-medium">State</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <Fragment key={e.key}>
                    <tr
                      onClick={() => toggle(e.key)}
                      className="cursor-pointer border-t border-border hover:bg-muted/50"
                    >
                      <td className="py-1.5 pr-3 font-mono text-xs">
                        <span className="mr-1 inline-block text-muted-foreground">
                          {openKey === e.key ? "▾" : "▸"}
                        </span>
                        {e.label}
                      </td>
                      <td className="py-1.5 pr-3 tabular-nums">{humanBytes(e.sizeBytes)}</td>
                      <td className="py-1.5 pr-3 tabular-nums">{humanAge(e.ageMs)}</td>
                      <td className="py-1.5 pr-3 tabular-nums">{e.hits}</td>
                      <td className="py-1.5">
                        {e.current ? (
                          <span className="text-green-600 dark:text-green-500">live</span>
                        ) : (
                          <span className="text-muted-foreground">stale</span>
                        )}
                      </td>
                    </tr>
                    {openKey === e.key && (
                      <tr className="border-t border-border">
                        <td colSpan={5} className="py-2">
                          <pre className="max-h-96 overflow-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
                            {values[e.key] ?? "Loading…"}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
