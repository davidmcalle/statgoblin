// Server-rendered stat cards; the nivo charts live in charts-client.tsx.

const CARD =
  "rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950";

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
