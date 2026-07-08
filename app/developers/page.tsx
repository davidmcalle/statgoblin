// Developer reference for the read API. Auth mirrors Foundry ingest: the
// campaign UUID identifies, an admin API key (campaign settings) authorizes.

const BASE = "https://statgoblin.com";

type Param = { name: string; type: string; desc: string };

const ROLL_PARAMS: Param[] = [
  { name: "actor", type: "string", desc: "Exact character/monster name" },
  { name: "type", type: "string", desc: "Roll type: attack, damage, save, skill, ability, healing, death, initiative, usage, concentration, hitDie, recharge" },
  { name: "kind", type: "pc | npc | monster", desc: "Actor bucket, resolved like the dashboard filter" },
  { name: "session", type: "YYYY-MM-DD", desc: "One play date (a session)" },
  { name: "from", type: "YYYY-MM-DD", desc: "Start date, inclusive" },
  { name: "to", type: "YYYY-MM-DD", desc: "End date, inclusive" },
  { name: "limit", type: "1–500", desc: "Page size, default 100" },
  { name: "offset", type: "number", desc: "Pagination offset, default 0" },
];

function Endpoint({
  method,
  path,
  desc,
  params,
  example,
}: {
  method: string;
  path: string;
  desc: string;
  params?: Param[];
  example: string;
}) {
  return (
    <section className="space-y-3 border-t border-border pt-6">
      <div className="flex items-baseline gap-3">
        <span className="rounded-sm border border-border px-1.5 py-0.5 font-mono text-xs font-semibold">
          {method}
        </span>
        <code className="font-mono text-sm font-semibold">{path}</code>
      </div>
      <p className="text-sm text-muted-foreground">{desc}</p>
      {params && (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="py-1.5 pr-4 font-mono font-normal uppercase tracking-wider">param</th>
              <th className="py-1.5 pr-4 font-mono font-normal uppercase tracking-wider">type</th>
              <th className="py-1.5 font-mono font-normal uppercase tracking-wider">description</th>
            </tr>
          </thead>
          <tbody>
            {params.map((p) => (
              <tr key={p.name} className="border-b border-border/60">
                <td className="py-1.5 pr-4 font-mono">{p.name}</td>
                <td className="py-1.5 pr-4 font-mono text-muted-foreground">{p.type}</td>
                <td className="py-1.5 text-muted-foreground">{p.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed">
        {example}
      </pre>
    </section>
  );
}

export default function DevelopersPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Developer API</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Read your campaign&apos;s derived roll data over HTTPS and do whatever you like with
          it. Responses are JSON. Hidden rolls (death saves inside a GM hiding window) and
          deleted rolls are excluded.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Authentication</h2>
        <p className="text-sm text-muted-foreground">
          Every request carries two headers, the same pair the Foundry module uses. Both come
          from your campaign&apos;s settings panel (GM only): the campaign ID identifies, an API
          key authorizes. Treat the key as a secret — anyone holding it can read the
          campaign&apos;s rolls and ingest new ones.
        </p>
        <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed">
          {`X-Campaign-Id: <campaign uuid>\nAuthorization: Bearer <api key>`}
        </pre>
      </section>

      <Endpoint
        method="GET"
        path="/api/v1/rolls"
        desc="Individual rolls, oldest first. Filter with any combination of the parameters — the same axes as the dashboard filters."
        params={ROLL_PARAMS}
        example={`curl "${BASE}/api/v1/rolls?type=attack&from=2026-07-01&limit=50" \\\n  -H "X-Campaign-Id: $CAMPAIGN_ID" \\\n  -H "Authorization: Bearer $API_KEY"\n\n{ "total": 132, "limit": 50, "offset": 0, "rolls": [ { "id": "…", "rollType": "attack",\n  "actorName": "Maeple Morningsong", "itemName": "Longbow", "total": 21, "d20": 17,\n  "dice": [{ "f": 20, "r": 17 }], "isNat20": false, "rolledAt": "2026-07-05T19:12:04Z", … } ] }`}
      />

      <Endpoint
        method="GET"
        path="/api/v1/sessions"
        desc="Play sessions — one per distinct date with rolls, numbered oldest-first. Session dates feed the rolls endpoint's session parameter."
        example={`curl "${BASE}/api/v1/sessions" \\\n  -H "X-Campaign-Id: $CAMPAIGN_ID" \\\n  -H "Authorization: Bearer $API_KEY"\n\n{ "sessions": [ { "n": 1, "date": "2026-06-14", "rolls": 118 }, … ] }`}
      />

      <Endpoint
        method="GET"
        path="/api/v1/actors"
        desc="The campaign's discovered actors: names, effective kind (pc/npc/monster), CR where known, and roll counts."
        example={`curl "${BASE}/api/v1/actors" \\\n  -H "X-Campaign-Id: $CAMPAIGN_ID" \\\n  -H "Authorization: Bearer $API_KEY"\n\n{ "actors": [ { "foundryActorId": "…", "name": "Giant Spider", "kind": "monster",\n  "cr": 1, "rollCount": 35, "assigned": false, … } ] }`}
      />

      <section className="space-y-2 border-t border-border pt-6">
        <h2 className="text-lg font-semibold">Your data export</h2>
        <p className="text-sm text-muted-foreground">
          Separate from the campaign API: signed-in users can download everything linked to
          their account — memberships, assigned characters, and those characters&apos; rolls —
          as one JSON file from the My characters page.
        </p>
      </section>
    </main>
  );
}
