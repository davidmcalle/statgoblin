"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useIsMobile } from "@/lib/use-mobile";
import { ABILITY_NAMES, SKILL_NAMES } from "@/lib/dnd5e-meta";
import type { GroupRoll, GroupRollReport } from "@/lib/group-rolls";

// All recharts panels, shadcn-wrapped. Data arrives shaped + colored from the
// server page; components stay purely presentational.

export type NamedCount = { name: string; count: number; fill: string };

export function SkillBarsCard({
  data,
  legend,
}: {
  data: NamedCount[];
  legend: { label: string; color: string }[];
}) {
  const isMobile = useIsMobile();
  if (data.length === 0) return null;
  const config = { count: { label: "Rolls" } } satisfies ChartConfig;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Checks by skill &amp; ability</CardTitle>
        <CardDescription>What the dice get asked to do, colored by ability</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} style={{ height: 40 + data.length * 34 }} className="w-full">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid horizontal={false} strokeOpacity={0.25} />
            <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              width={isMobile ? 92 : 130}
              fontSize={isMobile ? 11 : 12}
              tickLine={false}
              axisLine={false}
            />
            <ChartTooltip cursor={{ fillOpacity: 0.06 }} content={<ChartTooltipContent />} />
            <Bar dataKey="count" radius={[3, 3, 3, 3]} barSize={20}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.fill} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {legend.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function RollTypesCard({ data }: { data: NamedCount[] }) {
  const isMobile = useIsMobile();
  if (data.length === 0) return null;
  const config = { count: { label: "Rolls" } } satisfies ChartConfig;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Roll types</CardTitle>
        <CardDescription>Attacks, saves, checks — the shape of the session</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} style={{ height: 40 + data.length * 34 }} className="w-full">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid horizontal={false} strokeOpacity={0.25} />
            <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              width={isMobile ? 92 : 130}
              fontSize={isMobile ? 11 : 12}
              tickLine={false}
              axisLine={false}
            />
            <ChartTooltip cursor={{ fillOpacity: 0.06 }} content={<ChartTooltipContent />} />
            <Bar dataKey="count" radius={3} barSize={20}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.fill} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export type HistBucket = { face: number; count: number; byName: { name: string; count: number }[] };

export function D20HistogramCard({ data }: { data: HistBucket[] }) {
  const isMobile = useIsMobile();
  const total = data.reduce((n, d) => n + d.count, 0);
  if (total === 0) return null;
  const expected = total / 20;
  const config = { count: { label: "Rolls" } } satisfies ChartConfig;
  const breakdown = new Map(data.map((d) => [d.face, d.byName]));
  return (
    <Card>
      <CardHeader>
        <CardTitle>d20 fairness</CardTitle>
        <CardDescription>
          {total} d20s · dashed line = perfectly fair ({expected.toFixed(1)} per face) · hover a
          bar for who rolled it
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-56 w-full">
          <BarChart data={data} margin={{ left: -20, right: 8 }}>
            <CartesianGrid vertical={false} strokeOpacity={0.25} />
            {/* 20 ticks don't fit a phone; show every other face there. */}
            <XAxis
              dataKey="face"
              tickLine={false}
              axisLine={false}
              interval={isMobile ? 1 : 0}
              fontSize={11}
            />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
            <ChartTooltip
              cursor={{ fillOpacity: 0.06 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const rows = breakdown.get(Number(label)) ?? [];
                return (
                  <div className="rounded-md border bg-popover px-3 py-2 text-xs">
                    <p className="mb-1 font-semibold">
                      Rolled {label} — {payload[0]?.value} time{payload[0]?.value === 1 ? "" : "s"}
                    </p>
                    {rows.map((r) => (
                      <p key={r.name} className="flex justify-between gap-4 text-muted-foreground">
                        <span>{r.name}</span>
                        <span className="text-foreground">×{r.count}</span>
                      </p>
                    ))}
                  </div>
                );
              }}
            />
            <ReferenceLine y={expected} strokeDasharray="4 4" strokeOpacity={0.5} />
            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
              {data.map((d) => (
                <Cell
                  key={d.face}
                  fill={d.face === 20 ? "#22c55e" : d.face === 1 ? "#ef4444" : "var(--muted-foreground)"}
                  fillOpacity={d.face === 20 || d.face === 1 ? 0.9 : 0.45}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export type PactRow = { name: string; color: string; nat20: number; nat1: number };

export function DicePactsCard({ rows }: { rows: PactRow[] }) {
  const isMobile = useIsMobile();
  // Nothing lucky or cursed yet — an empty diverging chart is just a frame.
  if (rows.length === 0 || rows.every((r) => r.nat20 === 0 && r.nat1 === 0)) return null;
  // nat1 mirrored negative for the diverging layout.
  const data = rows.map((r) => ({ ...r, nat1: -r.nat1 }));
  const span = Math.max(10, ...rows.map((r) => Math.max(r.nat20, r.nat1))) * 1.2;
  const config = {
    nat20: { label: "Nat 20 rate" },
    nat1: { label: "Nat 1 rate" },
  } satisfies ChartConfig;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lucky &amp; cursed</CardTitle>
        <CardDescription>
          Nat 20 rate (right) vs nat 1 rate (left) · dashed guides = expected 5%
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} style={{ height: 60 + rows.length * 40 }} className="w-full">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }} stackOffset="sign">
            <CartesianGrid horizontal={false} strokeOpacity={0.25} />
            <XAxis
              type="number"
              domain={[-span, span]}
              tickFormatter={(v: number) => `${Math.abs(v)}%`}
              tickLine={false}
              axisLine={false}
              fontSize={11}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={isMobile ? 92 : 130}
              fontSize={isMobile ? 11 : 12}
              tickLine={false}
              axisLine={false}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) =>
                    `${name === "nat1" ? "Nat 1" : "Nat 20"}: ${Math.abs(Number(value)).toFixed(1)}%`
                  }
                />
              }
            />
            <ReferenceLine x={0} strokeOpacity={0.6} />
            <ReferenceLine x={5} strokeDasharray="4 4" strokeOpacity={0.45} />
            <ReferenceLine x={-5} strokeDasharray="4 4" strokeOpacity={0.45} />
            <Bar dataKey="nat20" stackId="a" radius={[0, 3, 3, 0]} barSize={18}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Bar>
            <Bar dataKey="nat1" stackId="a" radius={[3, 0, 0, 3]} barSize={18}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} fillOpacity={0.55} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export type RadarRow = Record<string, string | number>;

export function RadarCard({
  title,
  description,
  data,
  series,
}: {
  title: string;
  description: string;
  data: RadarRow[];
  series: { name: string; color: string }[];
}) {
  if (data.length < 3 || series.length === 0) return null;
  const config = Object.fromEntries(
    series.map((s) => [s.name, { label: s.name, color: s.color }]),
  ) satisfies ChartConfig;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="mx-auto h-80 w-full max-w-lg">
          <RadarChart data={data}>
            <PolarGrid strokeOpacity={0.3} />
            <PolarAngleAxis dataKey="axis" fontSize={11} />
            <ChartTooltip content={<ChartTooltipContent />} />
            {series.map((s) => (
              <Radar
                key={s.name}
                name={s.name}
                dataKey={s.name}
                stroke={s.color}
                fill={s.color}
                fillOpacity={0.12}
                strokeWidth={2}
              />
            ))}
          </RadarChart>
        </ChartContainer>
        <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {series.map((s) => (
            <span key={s.name} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// One row per subject; counts[i] = times they rolled face i+1 (length 20).
export type HeatRow = { name: string; counts: number[] };

// d20 faces as a heatmap: rows are subjects, columns faces 1-20, cell darkness
// (one sequential hue) = how often that subject rolled that face, with the
// count printed in the cell. Discrete and non-overlapping — unlike a line
// chart it never interpolates counts that don't exist, and it scales to any
// number of rollers without a colour running out.
export function D20HeatmapCard({
  rows,
  subjectLabel,
}: {
  rows: HeatRow[];
  subjectLabel: string;
}) {
  const max = Math.max(1, ...rows.flatMap((r) => r.counts));
  const total = rows.reduce((n, r) => n + r.counts.reduce((a, b) => a + b, 0), 0);
  if (rows.length === 0 || total === 0) return null;
  const faces = Array.from({ length: 20 }, (_, i) => i + 1);
  const cellFor = (count: number) => {
    if (count === 0) return "var(--muted)";
    const pct = Math.round((0.18 + 0.82 * (count / max)) * 100);
    return `color-mix(in oklab, var(--series-1) ${pct}%, transparent)`;
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>d20 faces by {subjectLabel}</CardTitle>
        <CardDescription>
          How often each {subjectLabel} rolled each face (1-20) · darker = more often
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table
            className="w-full min-w-[560px] table-fixed border-separate"
            style={{ borderSpacing: 2 }}
          >
            <colgroup>
              <col style={{ width: 132 }} />
            </colgroup>
            <thead>
              <tr>
                <th className="sticky left-0 bg-card" />
                {faces.map((f) => (
                  <th
                    key={f}
                    className="text-center text-[10px] font-medium tabular-nums"
                    style={{
                      color:
                        f === 20
                          ? "#22c55e"
                          : f === 1
                            ? "#ef4444"
                            : "var(--muted-foreground)",
                    }}
                  >
                    {f}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name}>
                  <td
                    className="sticky left-0 max-w-0 truncate bg-card pr-2 text-right text-xs whitespace-nowrap"
                    title={r.name}
                  >
                    {r.name}
                  </td>
                  {r.counts.map((c, i) => (
                    <td
                      key={i}
                      title={`${r.name} rolled ${i + 1} — ${c} time${c === 1 ? "" : "s"}`}
                      className="h-8 rounded-[3px] text-center text-[11px] tabular-nums text-foreground/80"
                      style={{ background: cellFor(c) }}
                    >
                      {c || ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

const TYPE_WORD: Record<string, string> = {
  skill: "check",
  ability: "check",
  save: "save",
  concentration: "concentration",
};

function groupLabel(g: GroupRoll): string {
  const base = g.skill
    ? (SKILL_NAMES[g.skill] ?? g.skill)
    : g.ability
      ? (ABILITY_NAMES[g.ability] ?? g.ability)
      : "Check";
  return `${base} ${TYPE_WORD[g.rollType] ?? "check"}`;
}

function AdvMark({ state }: { state: number | null }) {
  if (state === 1)
    return (
      <span className="text-green-600 dark:text-green-500" title="Advantage">
        ▲
      </span>
    );
  if (state === -1)
    return (
      <span className="text-red-600 dark:text-red-400" title="Disadvantage">
        ▼
      </span>
    );
  return null;
}

const MAX_GROUPS = 20;

// Group rolls: the party rolling the same check in a burst. Shows a campaign
// advantage/disadvantage strip up top, then each burst with every
// participant's d20, the group average, and double-nat callouts.
export function GroupRollsCard({
  report,
  subjectLabel = "player",
}: {
  report: GroupRollReport;
  subjectLabel?: string;
}) {
  const { summary, groups } = report;
  const totalChecks = summary.adv.n + summary.normal.n + summary.dis.n;
  if (totalChecks === 0) return null;
  const shown = groups.slice(0, MAX_GROUPS);
  const advTiles = [
    { label: "Advantage", b: summary.adv, mark: "▲", cls: "text-green-600 dark:text-green-500" },
    { label: "Normal", b: summary.normal, mark: "", cls: "" },
    {
      label: "Disadvantage",
      b: summary.dis,
      mark: "▼",
      cls: "text-red-600 dark:text-red-400",
    },
  ] as const;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Group rolls</CardTitle>
        <CardDescription>
          When the party makes the same check together (within 90s) · plus how advantage and
          disadvantage played out
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {advTiles.map((t) => (
            <div key={t.label} className="rounded-md border border-border p-3 text-center">
              <div className="text-lg font-bold tabular-nums">{t.b.avgD20 ?? "—"}</div>
              <div className="text-[11px] text-muted-foreground">
                <span className={t.cls}>{t.mark}</span> {t.label} avg d20
              </div>
              <div className="text-[11px] text-muted-foreground">
                {t.b.n} roll{t.b.n === 1 ? "" : "s"}
              </div>
            </div>
          ))}
        </div>

        {(report.doubleNat20Groups > 0 || report.doubleNat1Groups > 0) && (
          <div className="flex flex-wrap gap-4 text-xs">
            {report.doubleNat20Groups > 0 && (
              <span className="text-green-600 dark:text-green-500">
                🍀 {report.doubleNat20Groups} group{report.doubleNat20Groups === 1 ? "" : "s"} with
                double nat 20
              </span>
            )}
            {report.doubleNat1Groups > 0 && (
              <span className="text-red-600 dark:text-red-400">
                💀 {report.doubleNat1Groups} group{report.doubleNat1Groups === 1 ? "" : "s"} with
                double nat 1
              </span>
            )}
          </div>
        )}

        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No group rolls yet — they appear when {subjectLabel}s roll the same check within 90
            seconds of each other.
          </p>
        ) : (
          <ul className="space-y-2">
            {shown.map((g, i) => (
              <li key={i} className="rounded-md border border-border p-3">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{groupLabel(g)}</span>
                    {g.doubleNat20 && (
                      <span className="text-xs text-green-600 dark:text-green-500">
                        double nat 20
                      </span>
                    )}
                    {g.doubleNat1 && (
                      <span className="text-xs text-red-600 dark:text-red-400">double nat 1</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(g.sessionDate).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      timeZone: "UTC",
                    })}{" "}
                    · {g.participants.length} {subjectLabel}s
                    {g.spanSec > 0 ? ` · within ${g.spanSec}s` : ""}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {g.participants.map((p, j) => (
                    <span
                      key={j}
                      className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs"
                    >
                      <span className="text-muted-foreground">{p.actorName}</span>
                      <AdvMark state={p.advantageState} />
                      <span
                        className={`font-bold tabular-nums ${
                          p.isNat20
                            ? "text-green-600 dark:text-green-500"
                            : p.isNat1
                              ? "text-red-600 dark:text-red-400"
                              : ""
                        }`}
                      >
                        {p.d20 ?? "—"}
                      </span>
                      {p.total != null && <span className="text-muted-foreground">→ {p.total}</span>}
                    </span>
                  ))}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Group result: avg total{" "}
                  <span className="font-semibold text-foreground tabular-nums">
                    {g.avgTotal ?? "—"}
                  </span>{" "}
                  · avg d20{" "}
                  <span className="font-semibold text-foreground tabular-nums">
                    {g.avgD20 ?? "—"}
                  </span>
                  {g.advCount > 0 || g.disCount > 0 ? (
                    <span>
                      {" "}
                      · {g.advCount} adv / {g.disCount} dis
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        {groups.length > MAX_GROUPS && (
          <p className="text-xs text-muted-foreground">
            Showing the {MAX_GROUPS} most recent of {groups.length} group rolls.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
