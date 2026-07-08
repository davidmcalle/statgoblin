"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Interactive API console: fill the campaign credentials once, then execute
// any endpoint against this deployment and read the live response. Fetches
// are same-origin, so nothing extra to configure.

type ParamDef = {
  name: string;
  type: string;
  desc: string;
  options?: string[];
  placeholder?: string;
};

type EndpointDef = {
  method: "GET";
  path: string;
  desc: string;
  params: ParamDef[];
};

const ROLL_TYPES = [
  "attack",
  "damage",
  "save",
  "skill",
  "ability",
  "healing",
  "death",
  "initiative",
  "usage",
  "concentration",
  "hitDie",
  "recharge",
  "manual",
];

const ENDPOINTS: EndpointDef[] = [
  {
    method: "GET",
    path: "/api/v1/rolls",
    desc: "Individual rolls, oldest first — the same filter axes as the dashboard. Hidden death saves and deleted rolls are excluded.",
    params: [
      { name: "actor", type: "string", desc: "Exact character/monster name", placeholder: "Maeple Morningsong" },
      { name: "type", type: "enum", desc: "Roll type", options: ROLL_TYPES },
      { name: "kind", type: "enum", desc: "Actor bucket", options: ["pc", "npc", "monster"] },
      { name: "session", type: "date", desc: "One play date", placeholder: "2026-07-06" },
      { name: "from", type: "date", desc: "Start date, inclusive", placeholder: "2026-07-01" },
      { name: "to", type: "date", desc: "End date, inclusive", placeholder: "2026-07-31" },
      { name: "limit", type: "1–500", desc: "Page size (default 100)", placeholder: "100" },
      { name: "offset", type: "number", desc: "Pagination offset", placeholder: "0" },
    ],
  },
  {
    method: "GET",
    path: "/api/v1/sessions",
    desc: "Play sessions — one per distinct date with rolls, numbered oldest-first. Dates feed the rolls endpoint's session parameter.",
    params: [],
  },
  {
    method: "GET",
    path: "/api/v1/actors",
    desc: "Discovered actors: names, effective kind (pc/npc/monster), CR where known, roll counts.",
    params: [],
  },
];

const CREDS_KEY = "sg-dev-creds";

export function ApiConsole() {
  const [campaignId, setCampaignId] = useState("");
  const [apiKey, setApiKey] = useState("");

  // Credentials survive reloads (this browser only) so retesting is cheap.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CREDS_KEY) ?? "{}");
      if (saved.campaignId) setCampaignId(saved.campaignId);
      if (saved.apiKey) setApiKey(saved.apiKey);
    } catch {
      // ignore corrupt storage
    }
  }, []);
  useEffect(() => {
    localStorage.setItem(CREDS_KEY, JSON.stringify({ campaignId, apiKey }));
  }, [campaignId, apiKey]);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Credentials</h2>
        <p className="text-sm text-muted-foreground">
          Both values live in your campaign&apos;s settings panel (GM only). The campaign ID
          identifies, the API key authorizes — treat the key as a secret. They&apos;re kept in
          this browser only.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              X-Campaign-Id
            </span>
            <Input
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
              className="font-mono"
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              Authorization (Bearer)
            </span>
            <Input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="rw_…"
              type="password"
              className="font-mono"
            />
          </label>
        </div>
      </section>

      {ENDPOINTS.map((e) => (
        <Endpoint key={e.path} def={e} campaignId={campaignId} apiKey={apiKey} />
      ))}
    </div>
  );
}

function Endpoint({
  def,
  campaignId,
  apiKey,
}: {
  def: EndpointDef;
  campaignId: string;
  apiKey: string;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ status: number; ms: number; body: string } | null>(null);
  // Origin only exists in the browser; render relative during SSR and upgrade
  // after mount so server and client HTML match.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const query = Object.entries(values)
    .filter(([, v]) => v.trim() !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(v.trim())}`)
    .join("&");
  const url = `${def.path}${query ? `?${query}` : ""}`;
  const curl = [
    `curl "${origin}${url}" \\`,
    `  -H "X-Campaign-Id: ${campaignId || "$CAMPAIGN_ID"}" \\`,
    `  -H "Authorization: Bearer ${apiKey ? "••••••" : "$API_KEY"}"`,
  ].join("\n");

  const send = async () => {
    setPending(true);
    const started = performance.now();
    try {
      const res = await fetch(url, {
        headers: { "X-Campaign-Id": campaignId.trim(), Authorization: `Bearer ${apiKey.trim()}` },
        cache: "no-store",
      });
      const text = await res.text();
      let body = text;
      try {
        body = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        // leave non-JSON as-is
      }
      // Keep the pane responsive on huge pages.
      if (body.length > 200_000) body = `${body.slice(0, 200_000)}\n… truncated`;
      setResult({ status: res.status, ms: Math.round(performance.now() - started), body });
    } catch (err) {
      setResult({
        status: 0,
        ms: Math.round(performance.now() - started),
        body: err instanceof Error ? err.message : "request failed",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="space-y-3 border-t border-border pt-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="rounded-sm border border-border px-1.5 py-0.5 font-mono text-xs font-semibold">
          {def.method}
        </span>
        <code className="font-mono text-sm font-semibold">{def.path}</code>
      </div>
      <p className="text-sm text-muted-foreground">{def.desc}</p>

      {def.params.length > 0 && (
        <div className="grid grid-cols-2 gap-x-2 gap-y-3 sm:grid-cols-4">
          {def.params.map((p) => (
            <div key={p.name} className="min-w-0">
              <span
                className="mb-1 block font-mono text-[10px] tracking-widest text-muted-foreground uppercase"
                title={p.desc}
              >
                {p.name}
              </span>
              {p.options ? (
                <Select
                  items={[{ value: "__none__", label: "—" }, ...p.options.map((o) => ({ value: o, label: o }))]}
                  value={values[p.name] || "__none__"}
                  onValueChange={(v) =>
                    setValues((prev) => ({ ...prev, [p.name]: v === "__none__" || !v ? "" : v }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[{ value: "__none__", label: "—" }, ...p.options.map((o) => ({ value: o, label: o }))].map(
                      (i) => (
                        <SelectItem key={i.value} value={i.value}>
                          {i.label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={values[p.name] ?? ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [p.name]: e.target.value }))}
                  placeholder={p.placeholder ?? p.type}
                  className="font-mono text-xs"
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" disabled={pending || !campaignId || !apiKey} onClick={send}>
          {pending ? "Sending…" : "Send request"}
        </Button>
        <code className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{url}</code>
      </div>

      <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed">{curl}</pre>

      {result && (
        <div className="space-y-1">
          <div className="font-mono text-xs">
            <span
              className={
                result.status >= 200 && result.status < 300
                  ? "text-green-600 dark:text-green-500"
                  : "text-red-600 dark:text-red-400"
              }
            >
              {result.status === 0 ? "network error" : `HTTP ${result.status}`}
            </span>
            <span className="text-muted-foreground"> · {result.ms} ms</span>
          </div>
          <pre className="max-h-96 overflow-auto rounded-md border border-border p-3 font-mono text-xs leading-relaxed">
            {result.body}
          </pre>
        </div>
      )}
    </section>
  );
}
