import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ActorStats, CampaignTotals, DeathSaveRow } from "@/lib/stats";

// Server-rendered panels: stat cards, character table, death saves.

export function StatCards({ totals }: { totals: CampaignTotals }) {
  const { totalRolls, nat20s, nat1s, avgD20, highest } = totals;
  const avgBad = avgD20 !== null && avgD20 < 10.5;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card className="gap-1 py-4">
        <CardContent className="px-4">
          <div className="text-2xl font-bold">{totalRolls}</div>
          <div className="text-sm text-muted-foreground">Total rolls</div>
        </CardContent>
      </Card>
      <Card className="gap-1 py-4">
        <CardContent className="flex items-start justify-between px-4">
          <div>
            <div className="text-2xl font-bold text-green-500">{nat20s}</div>
            <div className="text-sm text-muted-foreground">Nat 20s</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-red-500">{nat1s}</div>
            <div className="text-sm text-muted-foreground">Nat 1s</div>
          </div>
        </CardContent>
      </Card>
      <Card className="gap-1 py-4">
        <CardContent className="px-4">
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
        </CardContent>
      </Card>
      <Card className="gap-1 py-4">
        <CardContent className="px-4">
          <div className={`text-2xl font-bold ${avgBad ? "text-red-500" : "text-green-500"}`}>
            {avgD20?.toFixed(1) ?? "—"}
          </div>
          <div className="text-sm text-muted-foreground">Average d20 · expected 10.5</div>
        </CardContent>
      </Card>
    </div>
  );
}

export function CharacterTable({
  stats,
  colors,
}: {
  stats: ActorStats[];
  colors: Map<string, string>;
}) {
  if (stats.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Characters</CardTitle>
        <CardDescription>Everything each character has put on the table</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Character</TableHead>
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
