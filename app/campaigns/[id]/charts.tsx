import { hierarchy, pack } from "d3-hierarchy";

// Server-rendered SVG charts. Layout math only (d3-hierarchy for circle
// packing); no client JS, native <title> tooltips.

const CARD =
  "rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950";
const DOTS = {
  backgroundImage: "radial-gradient(circle, rgb(128 128 128 / 0.12) 1px, transparent 1px)",
  backgroundSize: "22px 22px",
};

// ——— Stat cards ————————————————————————————————————————————————————————————

export function StatCards({
  totalRolls,
  nat20s,
  nat1s,
  avgD20,
  highest,
}: {
  totalRolls: number;
  nat20s: number;
  nat1s: number;
  avgD20: number | null;
  highest: { total: number; actorName: string | null; rolledAt: Date } | null;
}) {
  const avgBad = avgD20 !== null && avgD20 < 10.5;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div className={CARD}>
        <div className="text-2xl font-bold">{totalRolls}</div>
        <div className="text-sm text-gray-500">Total rolls</div>
      </div>
      <div className={`${CARD} flex items-start justify-between`}>
        <div>
          <div className="text-2xl font-bold">{nat20s}</div>
          <div className="text-sm text-gray-500">Nat 20s</div>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500">Nat 1s</div>
          <div className="text-xl font-bold">{nat1s}</div>
        </div>
      </div>
      <div className={CARD}>
        <div className="text-2xl font-bold">
          {highest?.total ?? "—"}{" "}
          <span className="text-sm font-normal text-gray-500">Highest d20 roll</span>
        </div>
        <div className="text-sm text-gray-500">
          {highest
            ? `${highest.actorName ?? "someone"} · ${highest.rolledAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
            : "no rolls yet"}
        </div>
      </div>
      <div className={CARD}>
        <div className={`text-2xl font-bold ${avgBad ? "text-red-500" : "text-green-600"}`}>
          {avgD20?.toFixed(1) ?? "—"}{" "}
          <span className="text-sm font-normal text-gray-500">Average d20</span>
        </div>
        <div className="text-sm text-gray-500">expected 10.5</div>
      </div>
    </div>
  );
}

// ——— Bubble pack ————————————————————————————————————————————————————————————

export type Bubble = { label: string; value: number; color: string; tooltip?: string };

export function BubblePack({
  title,
  bubbles,
  legend,
}: {
  title: string;
  bubbles: Bubble[];
  legend?: { label: string; color: string }[];
}) {
  if (bubbles.length === 0) return null;
  const W = 800;
  const H = 560;
  const root = hierarchy<{ children: Bubble[] } | Bubble>({ children: bubbles })
    .sum((d) => ("value" in d ? d.value : 0))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const laid = pack<{ children: Bubble[] } | Bubble>().size([W, H]).padding(6)(root);

  return (
    <section className={CARD} style={DOTS}>
      <h2 className="mb-2 font-semibold">{title}</h2>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={title}>
        {laid.leaves().map((node, i) => {
          const d = node.data as Bubble;
          const fontSize = Math.max(11, Math.min(24, node.r / 3.2));
          return (
            <g key={i} transform={`translate(${node.x},${node.y})`}>
              <title>{d.tooltip ?? `${d.label}: ${d.value}`}</title>
              <circle r={node.r} fill={d.color} />
              {node.r > 26 && (
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="white"
                  fontSize={fontSize}
                  fontWeight={600}
                >
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
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

// ——— Diverging nat 20/1 bars ("Dice Pacts") ————————————————————————————————

export type NatRateRow = { name: string; color: string; nat20Rate: number; nat1Rate: number };

export function DicePacts({ rows }: { rows: NatRateRow[] }) {
  if (rows.length === 0) return null;
  const W = 900;
  const rowH = 34;
  const top = 34;
  const H = top + rows.length * rowH + 30;
  const mid = W / 2;
  const span = Math.max(0.1, ...rows.map((r) => Math.max(r.nat20Rate, r.nat1Rate))) * 1.15;
  const x = (rate: number, side: 1 | -1) => mid + side * (rate / span) * (mid - 130);
  const expected = 0.05;

  return (
    <section className={CARD} style={DOTS}>
      <h2 className="mb-2 font-semibold">
        Dice Pacts <span className="font-normal text-gray-500">— natural 20s &amp; 1s</span>
      </h2>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Nat 20 and nat 1 rates">
        {/* expected-rate guides */}
        {expected <= span &&
          ([1, -1] as const).map((side) => (
            <g key={side}>
              <line
                x1={x(expected, side)}
                x2={x(expected, side)}
                y1={top - 6}
                y2={H - 24}
                stroke="currentColor"
                strokeOpacity={0.35}
              />
              <text
                x={x(expected, side)}
                y={top - 12}
                textAnchor="middle"
                fontSize={11}
                fill="currentColor"
                opacity={0.6}
              >
                {side === 1 ? "Nat 20 avg" : "Nat 1 avg"}
              </text>
            </g>
          ))}
        <line x1={mid} x2={mid} y1={top - 6} y2={H - 24} stroke="currentColor" strokeOpacity={0.5} strokeDasharray="3 3" />
        {rows.map((r, i) => {
          const y = top + i * rowH;
          return (
            <g key={r.name}>
              <title>{`${r.name}: nat 20 ${(r.nat20Rate * 100).toFixed(1)}%, nat 1 ${(r.nat1Rate * 100).toFixed(1)}%`}</title>
              <text x={120} y={y + rowH / 2} textAnchor="end" dominantBaseline="central" fontSize={12} fill="currentColor" opacity={0.7}>
                {r.name}
              </text>
              {r.nat20Rate > 0 && (
                <rect x={mid} y={y + 4} width={x(r.nat20Rate, 1) - mid} height={rowH - 12} rx={3} fill={r.color} />
              )}
              {r.nat1Rate > 0 && (
                <rect x={x(r.nat1Rate, -1)} y={y + 4} width={mid - x(r.nat1Rate, -1)} height={rowH - 12} rx={3} fill={r.color} opacity={0.75} />
              )}
            </g>
          );
        })}
        <text x={mid} y={H - 8} textAnchor="middle" fontSize={11} fill="currentColor" opacity={0.5}>
          ← nat 1 rate · nat 20 rate → · guides at expected 5%
        </text>
      </svg>
    </section>
  );
}

// ——— Radar ——————————————————————————————————————————————————————————————————

export type RadarSeries = { name: string; color: string; values: number[] };

export function RadarChart({
  title,
  axes,
  series,
}: {
  title: string;
  axes: string[];
  series: RadarSeries[];
}) {
  if (axes.length < 3 || series.length === 0) return null;
  const SIZE = 520;
  const cx = SIZE / 2;
  const cy = SIZE / 2 + 6;
  const R = SIZE / 2 - 70;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const angle = (i: number) => (Math.PI * 2 * i) / axes.length - Math.PI / 2;
  const pt = (i: number, v: number) => {
    const r = (v / max) * R;
    return `${cx + r * Math.cos(angle(i))},${cy + r * Math.sin(angle(i))}`;
  };
  const ring = (frac: number) =>
    axes.map((_, i) => pt(i, max * frac)).join(" ");

  return (
    <section className={CARD} style={DOTS}>
      <h2 className="mb-2 font-semibold">{title}</h2>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto w-full max-w-xl" role="img" aria-label={title}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon key={f} points={ring(f)} fill="none" stroke="currentColor" strokeOpacity={0.15} />
        ))}
        {axes.map((a, i) => (
          <g key={a}>
            <line x1={cx} y1={cy} x2={pt(i, max).split(",").map(Number)[0]} y2={pt(i, max).split(",").map(Number)[1]} stroke="currentColor" strokeOpacity={0.15} />
            <text
              x={cx + (R + 26) * Math.cos(angle(i))}
              y={cy + (R + 26) * Math.sin(angle(i))}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={12}
              fill="currentColor"
              opacity={0.7}
            >
              {a}
            </text>
          </g>
        ))}
        {series.map((s) => (
          <g key={s.name}>
            <title>{s.name}</title>
            <polygon
              points={s.values.map((v, i) => pt(i, v)).join(" ")}
              fill={s.color}
              fillOpacity={0.12}
              stroke={s.color}
              strokeWidth={2}
            />
          </g>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5" style={{ color: s.color }}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </section>
  );
}
