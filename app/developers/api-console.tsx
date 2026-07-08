"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// API reference + live console. Each endpoint is an accordion: parameter
// table, example request/response packets, and a try-it form that executes
// same-origin against this deployment.

type ParamDef = {
  name: string;
  type: string;
  desc: string;
  options?: string[];
  example?: string;
};

type EndpointDef = {
  method: "GET";
  path: string;
  summary: string;
  desc: string;
  params: ParamDef[];
  exampleQuery?: string;
  exampleResponse: string;
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
    summary: "List rolls, filterable",
    desc: "Individual rolls, oldest first — the same filter axes as the dashboard. By default hidden death saves and soft-deleted rolls are excluded so responses match the dashboard; the key is the GM credential, so both are available on request via include_hidden and include_deleted. Combine any parameters; all are optional.",
    exampleQuery: "?type=attack&from=2026-07-01&limit=2",
    params: [
      { name: "actor", type: "string", desc: "Exact character or monster name", example: "Maeple Morningsong" },
      { name: "type", type: "enum", desc: "Roll type", options: ROLL_TYPES, example: "attack" },
      { name: "kind", type: "enum", desc: "Actor bucket, resolved like the dashboard filter", options: ["pc", "npc", "monster"], example: "pc" },
      { name: "session", type: "date (YYYY-MM-DD)", desc: "One play date — a session", example: "2026-07-06" },
      { name: "from", type: "date (YYYY-MM-DD)", desc: "Start date, inclusive", example: "2026-07-01" },
      { name: "to", type: "date (YYYY-MM-DD)", desc: "End date, inclusive", example: "2026-07-31" },
      { name: "updated_since", type: "ISO datetime", desc: "Only rows written or updated since — for incremental sync. Response orders by update time; key rows by (messageId, rollIndex), reprocessing recreates ids.", example: "2026-07-06T00:00:00Z" },
      { name: "include_hidden", type: "enum", desc: "Include death saves the GM is currently hiding from players. Careful where the output ends up.", options: ["true", "false"], example: "false" },
      { name: "include_deleted", type: "enum", desc: "Include soft-deleted rolls as tombstones (deletedAt set) — pair with updated_since so removals propagate to your copy.", options: ["true", "false"], example: "false" },
      { name: "limit", type: "integer 1–500", desc: "Page size (default 100)", example: "100" },
      { name: "offset", type: "integer", desc: "Pagination offset (default 0)", example: "0" },
    ],
    exampleResponse: `{
  "total": 132,
  "limit": 2,
  "offset": 0,
  "rolls": [
    {
      "id": "332ef4b1-e908-4636-9516-ba36cccbc45d",
      "messageId": "Q6s9UxM3tErjRJH9",
      "rollType": "attack",
      "actorFid": "ddbGiaSpi4775821",
      "actorName": "Giant Spider",
      "actorType": "npc",
      "authorName": "Gamemaster",
      "authorRole": "GAMEMASTER",
      "itemName": "Bite",
      "itemType": "weapon",
      "activityType": "attack",
      "formula": "1d20 + 3 + 2",
      "total": 16,
      "dice": [{ "f": 20, "r": 11 }],
      "modifier": 5,
      "dc": null,
      "d20": 11,
      "advantageState": 0,
      "isNat20": false,
      "isNat1": false,
      "isHit": true,
      "isCritical": false,
      "damageTotal": null,
      "damageType": null,
      "targetCount": 1,
      "ability": null,
      "skill": null,
      "rolledAt": "2026-07-06T15:26:41.000Z",
      "createdAt": "2026-07-06T15:26:42.113Z",
      "updatedAt": "2026-07-06T15:26:42.113Z"
    }
  ]
}`,
  },
  {
    method: "GET",
    path: "/api/v1/sessions",
    summary: "List play sessions",
    desc: "Play sessions — one per distinct date with rolls, numbered oldest-first. Dates feed the rolls endpoint's session parameter. With filters, numbering stays campaign-global while counts narrow to the matching rolls; dates with no matches drop out.",
    params: [
      { name: "actor", type: "string", desc: "Sessions where this character/monster rolled, with their roll counts", example: "Maeple Morningsong" },
      { name: "kind", type: "enum", desc: "Narrow counts to an actor bucket", options: ["pc", "npc", "monster"], example: "monster" },
    ],
    exampleQuery: "?kind=monster",
    exampleResponse: `{
  "sessions": [
    { "n": 1, "date": "2026-06-14", "rolls": 118 },
    { "n": 2, "date": "2026-06-21", "rolls": 96 }
  ]
}`,
  },
  {
    method: "GET",
    path: "/api/v1/actors",
    summary: "List discovered actors",
    desc: "The campaign's discovered actors: names, effective kind (pc/npc/monster), challenge rating where known, and lifetime roll counts. Date filters keep only actors that actually rolled in the window.",
    params: [
      { name: "kind", type: "enum", desc: "Effective kind", options: ["pc", "npc", "monster"], example: "monster" },
      { name: "search", type: "string", desc: "Case-insensitive name substring", example: "spider" },
      { name: "session", type: "date (YYYY-MM-DD)", desc: "Only actors that rolled on this play date", example: "2026-07-06" },
      { name: "from", type: "date (YYYY-MM-DD)", desc: "Activity window start, inclusive", example: "2026-07-01" },
      { name: "to", type: "date (YYYY-MM-DD)", desc: "Activity window end, inclusive", example: "2026-07-31" },
    ],
    exampleQuery: "?kind=monster&session=2026-07-06",
    exampleResponse: `{
  "actors": [
    {
      "foundryActorId": "ddbGiaSpi4775821",
      "name": "Giant Spider",
      "actorType": "npc",
      "kindOverride": null,
      "cr": 1,
      "rollCount": 35,
      "lastSeenAt": "2026-07-06T15:26:41.000Z",
      "kind": "monster",
      "assigned": false
    }
  ]
}`,
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
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Authentication</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Every request carries two headers — the same pair the Foundry module uses. Both come
          from your campaign&apos;s settings panel (GM only). The campaign ID identifies, the
          API key authorizes; treat the key as a secret. Values entered here stay in this
          browser and power the try-it forms below.
        </p>
        <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed">
          {`X-Campaign-Id: <campaign uuid>\nAuthorization: Bearer <api key>`}
        </pre>
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

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Endpoints</h2>
        <div className="divide-y divide-border rounded-md border border-border">
          {ENDPOINTS.map((e) => (
            <Endpoint key={e.path} def={e} campaignId={campaignId} apiKey={apiKey} />
          ))}
        </div>
      </section>
    </div>
  );
}

function MethodChip({ method }: { method: string }) {
  return (
    <span className="rounded-sm border border-primary/40 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary">
      {method}
    </span>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
      {children}
    </h3>
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
  const exampleCurl = [
    `curl "${origin || "https://statgoblin.com"}${def.path}${def.exampleQuery ?? ""}" \\`,
    `  -H "X-Campaign-Id: $CAMPAIGN_ID" \\`,
    `  -H "Authorization: Bearer $API_KEY"`,
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
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
        <MethodChip method={def.method} />
        <code className="font-mono text-sm font-semibold">{def.path}</code>
        <span className="hidden truncate text-sm text-muted-foreground sm:inline">
          {def.summary}
        </span>
        <ChevronDown
          size={16}
          className="ml-auto shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
        />
      </summary>

      <div className="space-y-5 border-t border-border bg-muted/20 px-4 py-4">
        <p className="max-w-2xl text-sm text-muted-foreground">{def.desc}</p>

        {def.params.length > 0 && (
          <div className="space-y-2">
            <SubHeading>Query parameters</SubHeading>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-mono font-normal">parameter</th>
                    <th className="px-3 py-2 font-mono font-normal">type</th>
                    <th className="px-3 py-2 font-mono font-normal">example</th>
                    <th className="px-3 py-2 font-mono font-normal">description</th>
                  </tr>
                </thead>
                <tbody>
                  {def.params.map((p) => (
                    <tr key={p.name} className="border-b border-border/60 last:border-b-0">
                      <td className="px-3 py-2 align-top font-mono whitespace-nowrap">{p.name}</td>
                      <td className="px-3 py-2 align-top font-mono whitespace-nowrap text-muted-foreground">
                        {p.type}
                      </td>
                      <td className="px-3 py-2 align-top font-mono whitespace-nowrap text-muted-foreground">
                        {p.example ?? "—"}
                      </td>
                      <td className="min-w-56 px-3 py-2 align-top text-muted-foreground">{p.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <SubHeading>Example request</SubHeading>
          <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed">
            {exampleCurl}
          </pre>
        </div>

        <div className="space-y-2">
          <SubHeading>Example response · 200</SubHeading>
          <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed">
            {def.exampleResponse}
          </pre>
        </div>

        <div className="space-y-3">
          <SubHeading>Try it</SubHeading>
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
                      placeholder={p.example ?? p.type}
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
            <code className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
              {url}
            </code>
          </div>
          {!campaignId || !apiKey ? (
            <p className="text-xs text-muted-foreground">
              Fill in the credentials at the top of the page to send requests.
            </p>
          ) : null}
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
              <pre className="max-h-96 overflow-auto rounded-md border border-border bg-background p-3 font-mono text-xs leading-relaxed">
                {result.body}
              </pre>
            </div>
          )}
        </div>
      </div>
    </details>
  );
}
