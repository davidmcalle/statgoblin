import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { ActorStats, CampaignTotals, DeathSaveRow, ItemUsage } from "@/lib/stats";

// Server-rendered panels: stat cards, character table, death saves.

export function StatCards({ totals }: { totals: CampaignTotals }) {
  const { totalRolls, nat20s, nat1s, avgD20, highest } = totals;
  const avgBad = avgD20 !== null && avgD20 < 10.5;
  const tile = "rounded-md border border-border p-4";
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div className={tile}>
        <div className="text-2xl font-bold">{totalRolls}</div>
        <div className="text-sm text-muted-foreground">Total rolls</div>
      </div>
      <div className={tile}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-500">{nat20s}</div>
            <div className="text-sm text-muted-foreground">Nat 20s</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{nat1s}</div>
            <div className="text-sm text-muted-foreground">Nat 1s</div>
          </div>
        </div>
      </div>
      <div className={tile}>
        <div className="text-2xl font-bold">{highest?.total ?? "—"}</div>
        <div className="text-sm text-muted-foreground">
          Highest d20 roll
          {highest && (
            <>
              {" · "}
              {highest.actorName ?? "someone"},{" "}
              {highest.rolledAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </>
          )}
        </div>
      </div>
      <div className={tile}>
        <div className={`text-2xl font-bold ${avgBad ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-500"}`}>
          {avgD20?.toFixed(1) ?? "—"}
        </div>
        <div className="text-sm text-muted-foreground">Average d20 · expected 10.5</div>
      </div>
    </div>
  );
}

export function CharacterTable({
  stats,
  colors,
  subjectLabel = "character",
}: {
  stats: ActorStats[];
  colors: Map<string, string>;
  subjectLabel?: string;
}) {
  if (stats.length === 0) return null;
  const title = subjectLabel === "player" ? "Players" : "Characters";
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Everything each {subjectLabel} has put on the table</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="capitalize">{subjectLabel}</TableHead>
              <TableHead className="text-right">Rolls</TableHead>
              <TableHead className="text-right">d20s</TableHead>
              <TableHead className="text-right">Avg d20</TableHead>
              <TableHead className="text-right">Nat 20</TableHead>
              <TableHead className="text-right">Nat 1</TableHead>
              <TableHead className="text-right">Damage</TableHead>
              <TableHead className="text-right">Healing</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.map((s) => (
              <TableRow key={s.actorName}>
                <TableCell className="font-medium">
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: colors.get(s.actorName) ?? "#6b7280" }}
                    />
                    {s.actorName}
                  </span>
                </TableCell>
                <TableCell className="text-right">{s.allRolls}</TableCell>
                <TableCell className="text-right">{s.d20Rolls}</TableCell>
                <TableCell className="text-right">{s.avgD20?.toFixed(1) ?? "—"}</TableCell>
                <TableCell className="text-right text-green-500">{s.nat20s}</TableCell>
                <TableCell className="text-right text-red-500">{s.nat1s}</TableCell>
                <TableCell className="text-right">{s.damage || "—"}</TableCell>
                <TableCell className="text-right">{s.healing || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function DeathSavesCard({ saves }: { saves: DeathSaveRow[] }) {
  if (saves.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Death saves</CardTitle>
        <CardDescription>The moments everyone held their breath</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1.5 text-sm">
          {saves.map((s, i) => (
            <li key={i} className="flex flex-wrap gap-x-3">
              <span className="font-medium">{s.actorName ?? "—"}</span>
              <span
                className={
                  s.d20 === 20 ? "text-green-500" : s.d20 === 1 ? "text-red-500" : ""
                }
              >
                rolled {s.total ?? "?"}
                {s.d20 === 20 ? " — nat 20, back on their feet!" : s.d20 === 1 ? " — nat 1, two failures" : ""}
              </span>
              <span className="ml-auto text-muted-foreground">
                {s.rolledAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

const ITEM_TYPE_LABEL: Record<string, string> = {
  weapon: "weapon",
  spell: "spell",
  feat: "feature",
  consumable: "consumable",
  equipment: "equipment",
};

export function ItemsCard({ items }: { items: ItemUsage[] }) {
  if (items.length === 0) return null;
  const maxUses = Math.max(...items.map((i) => i.uses));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Weapons, spells &amp; features</CardTitle>
        <CardDescription>What the table reaches for, and what it costs the enemy</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {items.map((i) => (
            <li key={i.itemName} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="min-w-0 flex-1 truncate font-medium sm:w-40 sm:flex-none">
                {i.itemName}
              </span>
              <span className="shrink-0 sm:w-24">
                <Badge variant="outline" className="capitalize">
                  {ITEM_TYPE_LABEL[i.itemType ?? ""] ?? i.itemType ?? "?"}
                </Badge>
              </span>
              {/* Usage bar gets its own line on phones. */}
              <span className="order-last h-2 w-full rounded bg-muted sm:order-none sm:w-auto sm:flex-1">
                <span
                  className="block h-2 rounded bg-primary/60"
                  style={{ width: `${(i.uses / maxUses) * 100}%` }}
                />
              </span>
              <span className="shrink-0 text-right text-muted-foreground sm:w-14">×{i.uses}</span>
              <span className="shrink-0 whitespace-nowrap text-right text-muted-foreground sm:w-24">
                {i.damage > 0 ? `${i.damage} dmg` : i.healing > 0 ? `${i.healing} heal` : ""}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}
