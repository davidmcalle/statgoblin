"use client";

import { ResponsiveCirclePacking } from "@nivo/circle-packing";
import { ResponsiveRadar } from "@nivo/radar";
import { ResponsiveBar } from "@nivo/bar";

// nivo chart wrappers (client components — nivo renders in the browser).
// Data arrives fully shaped and serializable from the server page.

const CARD =
  "rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950";
const DOTS = {
  backgroundImage: "radial-gradient(circle, rgb(128 128 128 / 0.12) 1px, transparent 1px)",
  backgroundSize: "22px 22px",
};

// Neutral tones legible on both light and dark cards.
const NIVO_THEME = {
  text: { fill: "#9ca3af", fontSize: 12 },
  axis: {
    ticks: { text: { fill: "#9ca3af" }, line: { stroke: "#9ca3af", strokeOpacity: 0.3 } },
    domain: { line: { stroke: "#9ca3af", strokeOpacity: 0.3 } },
  },
  grid: { line: { stroke: "#9ca3af", strokeOpacity: 0.15 } },
  tooltip: { container: { background: "#111827", color: "#e5e7eb", fontSize: 12 } },
};

export type BubbleDatum = { name: string; value: number; color: string };

export function BubbleCard({
  title,
  bubbles,
  legend,
  height = 480,
}: {
  title: string;
  bubbles: BubbleDatum[];
  legend?: { label: string; color: string }[];
  height?: number;
}) {
  if (bubbles.length === 0) return null;
  const colorByName = new Map(bubbles.map((b) => [b.name, b.color]));
  return (
    <section className={CARD} style={DOTS}>
      <h2 className="mb-2 font-semibold">{title}</h2>
      <div style={{ height }}>
        <ResponsiveCirclePacking
          data={{ name: "root", value: 0, color: "transparent", children: bubbles }}
          id="name"
          value="value"
          leavesOnly
          padding={6}
          colors={(node) => colorByName.get(node.id as string) ?? "#6b7280"}
          enableLabels
          labelsSkipRadius={26}
          labelTextColor="#ffffff"
          borderWidth={0}
          theme={NIVO_THEME}
          tooltip={({ id, value }) => (
            <div className="rounded bg-gray-900 px-2 py-1 text-xs text-gray-100">
              {id}: {value} rolls
            </div>
          )}
        />
      </div>
      {legend && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
          {legend.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

export type PactRow = { name: string; color: string; nat20Rate: number; nat1Rate: number };

export function DicePactsCard({ rows }: { rows: PactRow[] }) {
  if (rows.length === 0) return null;
  const colorByName = new Map(rows.map((r) => [r.name, r.color]));
  // Diverging horizontal bars: nat 1 rate mirrored negative, values in percent.
  const data = rows
    .slice()
    .reverse()
    .map((r) => ({
      name: r.name,
      "Nat 20": +(r.nat20Rate * 100).toFixed(2),
      "Nat 1": -+(r.nat1Rate * 100).toFixed(2),
    }));
  const span = Math.max(10, ...rows.map((r) => Math.max(r.nat20Rate, r.nat1Rate) * 100 * 1.2));
  return (
    <section className={CARD} style={DOTS}>
      <h2 className="mb-2 font-semibold">
        Dice Pacts <span className="font-normal text-gray-500">— natural 20s &amp; 1s</span>
      </h2>
      <div style={{ height: 60 + rows.length * 44 }}>
        <ResponsiveBar
          data={data}
          keys={["Nat 20", "Nat 1"]}
          indexBy="name"
          layout="horizontal"
          valueScale={{ type: "linear", min: -span, max: span }}
          valueFormat={(v) => `${Math.abs(Number(v)).toFixed(1)}%`}
          colors={({ indexValue, id }) => {
            const base = colorByName.get(String(indexValue)) ?? "#6b7280";
            return id === "Nat 1" ? `${base}b3` : base; // dim the nat-1 side
          }}
          borderRadius={3}
          enableGridX
          enableGridY={false}
          axisBottom={{ format: (v: number) => `${Math.abs(v)}%` }}
          axisLeft={{ tickSize: 0, tickPadding: 8 }}
          markers={[
            { axis: "x", value: 5, lineStyle: { stroke: "#9ca3af", strokeOpacity: 0.5 }, legend: "Nat 20 avg", textStyle: { fill: "#9ca3af", fontSize: 11 } },
            { axis: "x", value: -5, lineStyle: { stroke: "#9ca3af", strokeOpacity: 0.5 }, legend: "Nat 1 avg", textStyle: { fill: "#9ca3af", fontSize: 11 } },
            { axis: "x", value: 0, lineStyle: { stroke: "#9ca3af", strokeOpacity: 0.6, strokeDasharray: "3 3" } },
          ]}
          margin={{ top: 24, right: 24, bottom: 40, left: 120 }}
          padding={0.35}
          labelSkipWidth={40}
          labelTextColor="#ffffff"
          theme={NIVO_THEME}
        />
      </div>
      <p className="mt-1 text-xs text-gray-500">
        One bar per character · right = Nat 20 rate, left = Nat 1 rate · guides = expected 5%
      </p>
    </section>
  );
}

export type RadarDatum = Record<string, string | number>;

export function SkillRadarCard({
  data,
  keys,
  colors,
}: {
  data: RadarDatum[]; // [{ skill: "Arcana", "Damien": 3, ... }]
  keys: string[];
  colors: string[];
}) {
  if (data.length < 3 || keys.length === 0) return null;
  return (
    <section className={CARD} style={DOTS}>
      <h2 className="mb-2 font-semibold">Skill checks</h2>
      <div style={{ height: 440 }}>
        <ResponsiveRadar
          data={data}
          keys={keys}
          indexBy="skill"
          colors={colors}
          fillOpacity={0.12}
          borderWidth={2}
          dotSize={4}
          gridShape="linear"
          margin={{ top: 40, right: 80, bottom: 60, left: 80 }}
          theme={NIVO_THEME}
          legends={[
            {
              anchor: "bottom",
              direction: "row",
              translateY: 50,
              itemWidth: 130,
              itemHeight: 16,
              symbolShape: "circle",
              symbolSize: 10,
              itemTextColor: "#9ca3af",
            },
          ]}
        />
      </div>
    </section>
  );
}
