import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUserId } from "@/lib/campaigns";
import { myCharacters } from "@/lib/stats";

export const dynamic = "force-dynamic";

// Cross-campaign view: every character assigned to the signed-in user, plus
// their combined lifetime numbers.
export default async function MePage() {
  const userId = await requireUserId();
  const characters = await myCharacters(userId);

  const total = characters.reduce(
    (acc, c) => ({
      allRolls: acc.allRolls + c.stats.allRolls,
      d20Rolls: acc.d20Rolls + c.stats.d20Rolls,
      nat20s: acc.nat20s + c.stats.nat20s,
      nat1s: acc.nat1s + c.stats.nat1s,
      d20Sum: acc.d20Sum + (c.stats.avgD20 ?? 0) * c.stats.d20Rolls,
      damage: acc.damage + c.stats.damage,
      healing: acc.healing + c.stats.healing,
    }),
    { allRolls: 0, d20Rolls: 0, nat20s: 0, nat1s: 0, d20Sum: 0, damage: 0, healing: 0 },
  );
  const avgD20 = total.d20Rolls > 0 ? total.d20Sum / total.d20Rolls : null;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-8 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Your characters</h1>
          <p className="text-sm text-muted-foreground">
            Every character assigned to you, across all your campaigns
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {/* Plain link: the route streams a JSON attachment. */}
          <a
            href="/api/me/export"
            className="rounded-md border border-input px-3 py-1.5 hover:bg-muted"
          >
            Export my data
          </a>
          <Link
            href="/developers"
            className="rounded-md px-2 py-1.5 text-muted-foreground hover:text-foreground"
          >
            Developer API
          </Link>
        </div>
      </div>

      {characters.length === 0 ? (
        <p className="text-muted-foreground">
          No characters assigned yet — ask your GM to assign your character on the campaign page.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              { label: "Total rolls", value: total.allRolls },
              {
                label: "Nat 20s / 1s",
                value: (
                  <>
                    <span className="text-green-500">{total.nat20s}</span>
                    <span className="text-muted-foreground"> / </span>
                    <span className="text-red-500">{total.nat1s}</span>
                  </>
                ),
              },
              { label: "Average d20", value: avgD20?.toFixed(1) ?? "—" },
              { label: "Damage dealt", value: total.damage || "—" },
              { label: "Healing done", value: total.healing || "—" },
            ].map((s) => (
              <Card key={s.label} className="gap-1 py-4">
                <CardContent className="px-4">
                  <div className="text-2xl font-bold">{s.value}</div>
                  <div className="text-sm text-muted-foreground">{s.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {characters.map((c) => (
              <Card key={c.actorId}>
                <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                  {c.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.image} alt="" className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-lg font-bold">
                      {c.name.slice(0, 1)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <CardTitle className="truncate text-base">{c.name}</CardTitle>
                    <Link href={`/campaigns/${c.campaignId}`}>
                      <Badge variant="secondary" className="mt-1">
                        {c.campaignName}
                      </Badge>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Rolls", value: c.stats.allRolls },
                      { label: "Avg d20", value: c.stats.avgD20?.toFixed(1) ?? "—" },
                      {
                        label: "Nat 20 / 1",
                        value: (
                          <>
                            <span className="text-green-500">{c.stats.nat20s}</span>
                            <span className="text-muted-foreground"> / </span>
                            <span className="text-red-500">{c.stats.nat1s}</span>
                          </>
                        ),
                      },
                      { label: "Damage", value: c.stats.damage || "—" },
                      { label: "Healing", value: c.stats.healing || "—" },
                    ].map((s) => (
                      <div key={s.label}>
                        <div className="text-lg font-bold">{s.value}</div>
                        <div className="text-xs text-muted-foreground">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
