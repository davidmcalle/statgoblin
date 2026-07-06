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
                  <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
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
  if (rows.length === 0) return null;
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

export function SkillRadarCard({
  data,
  series,
}: {
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
        <CardTitle>Skill coverage</CardTitle>
        <CardDescription>Who leans on which skills</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="mx-auto h-80 w-full max-w-lg">
          <RadarChart data={data}>
            <PolarGrid strokeOpacity={0.3} />
            <PolarAngleAxis dataKey="skill" fontSize={11} />
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
