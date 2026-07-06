import { prisma } from "@/lib/db/prisma";

// Crude shape-inspection page: newest events first, payload behind a
// <details> toggle. This is scaffolding for learning the data, not the
// real dashboard.
export const dynamic = "force-dynamic";

type Payload = {
  author?: { name?: string };
  actor?: { name?: string } | null;
  item?: { name?: string; type?: string } | null;
  flavor?: string;
  rolls?: { formula?: string; total?: number }[];
};

export default async function EventsPage() {
  const events = await prisma.rawEvent.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: { campaign: { select: { name: true } } },
  });

  return (
    <main className="mx-auto max-w-4xl p-6 font-mono text-sm">
      <h1 className="mb-4 text-xl font-bold">Raw events ({events.length})</h1>
      <ul className="space-y-2">
        {events.map((e) => {
          const p = (e.payload ?? {}) as Payload;
          const roll = p.rolls?.[0];
          return (
            <li key={e.id} className="rounded border border-gray-300 p-3 dark:border-gray-700">
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <span className="font-bold">{p.actor?.name ?? p.author?.name ?? "—"}</span>
                <span>{p.item?.name ?? p.flavor ?? ""}</span>
                {roll && (
                  <span>
                    {roll.formula} = <span className="font-bold">{roll.total}</span>
                  </span>
                )}
                <span className="ml-auto text-gray-500">
                  {e.lastEventType} ×{e.receivedCount}
                  {e.deletedAt ? " (deleted)" : ""} · {e.updatedAt.toISOString().slice(11, 19)}
                </span>
              </div>
              <details className="mt-1">
                <summary className="cursor-pointer text-gray-500">payload</summary>
                <pre className="mt-1 overflow-x-auto rounded bg-gray-100 p-2 text-xs dark:bg-gray-900">
                  {JSON.stringify(e.payload, null, 2)}
                </pre>
              </details>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
