import type { ActorStats, D20Bucket, DeathSaveRow, RollTypeCount } from "@/lib/stats";

// Server-rendered dashboard panels: plain CSS bars, no chart library.

export function ActorStatsTable({ stats }: { stats: ActorStats[] }) {
  if (stats.length === 0) return null;
  return (
    <section className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <h2 className="mb-3 font-semibold">Characters</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="pb-2 pr-3 font-normal">Character</th>
              <th className="pb-2 pr-3 text-right font-normal">d20s</th>
              <th className="pb-2 pr-3 text-right font-normal">avg d20</th>
              <th className="pb-2 pr-3 text-right font-normal">nat 20</th>
              <th className="pb-2 pr-3 text-right font-normal">nat 1</th>
              <th className="pb-2 pr-3 text-right font-normal">damage</th>
              <th className="pb-2 text-right font-normal">healing</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.actorName} className="border-t border-gray-100 dark:border-gray-900">
                <td className="py-1.5 pr-3 font-semibold">{s.actorName}</td>
                <td className="py-1.5 pr-3 text-right">{s.d20Rolls}</td>
                <td className="py-1.5 pr-3 text-right">{s.avgD20?.toFixed(1) ?? "—"}</td>
                <td className="py-1.5 pr-3 text-right text-green-600">{s.nat20s}</td>
                <td className="py-1.5 pr-3 text-right text-red-600">{s.nat1s}</td>
                <td className="py-1.5 pr-3 text-right">{s.damage || "—"}</td>
                <td className="py-1.5 text-right">{s.healing || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function D20HistogramPanel({ buckets }: { buckets: D20Bucket[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const total = buckets.reduce((n, b) => n + b.count, 0);
  if (total === 0) return null;
  return (
    <section className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <h2 className="mb-3 font-semibold">
        d20 fairness <span className="font-normal text-gray-500">({total} rolls)</span>
      </h2>
      <div className="flex h-28 items-end gap-1">
        {buckets.map((b) => (
          <div key={b.face} className="flex flex-1 flex-col items-center gap-1" title={`${b.face}: ${b.count}`}>
            <div
              className={`w-full rounded-t ${
                b.face === 20 ? "bg-green-500" : b.face === 1 ? "bg-red-500" : "bg-gray-400 dark:bg-gray-600"
              }`}
              style={{ height: `${(b.count / max) * 100}%`, minHeight: b.count > 0 ? "2px" : "0" }}
            />
            <span className="text-[10px] text-gray-500">{b.face}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function RollTypePanel({ counts }: { counts: RollTypeCount[] }) {
  const max = Math.max(1, ...counts.map((c) => c.count));
  if (counts.length === 0) return null;
  return (
    <section className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <h2 className="mb-3 font-semibold">Roll types</h2>
      <ul className="space-y-1.5 text-sm">
        {counts.map((c) => (
          <li key={c.rollType} className="flex items-center gap-2">
            <span className="w-28 shrink-0">{c.rollType}</span>
            <div className="h-3 flex-1 rounded bg-gray-100 dark:bg-gray-900">
              <div
                className="h-3 rounded bg-gray-400 dark:bg-gray-600"
                style={{ width: `${(c.count / max) * 100}%` }}
              />
            </div>
            <span className="w-10 text-right text-gray-500">{c.count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DeathSavesPanel({ saves }: { saves: DeathSaveRow[] }) {
  if (saves.length === 0) return null;
  return (
    <section className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <h2 className="mb-3 font-semibold">Death saves</h2>
      <ul className="space-y-1 text-sm">
        {saves.map((s, i) => (
          <li key={i} className="flex flex-wrap gap-x-3">
            <span className="font-semibold">{s.actorName ?? "—"}</span>
            <span className={s.d20 === 20 ? "text-green-600" : s.d20 === 1 ? "text-red-600" : ""}>
              rolled {s.total ?? "?"}
              {s.d20 === 20 ? " (nat 20!)" : s.d20 === 1 ? " (nat 1)" : ""}
            </span>
            <span className="ml-auto text-gray-500">{s.rolledAt.toISOString().slice(0, 10)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
