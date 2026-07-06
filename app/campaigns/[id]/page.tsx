import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/campaigns";
import { CampaignSettings } from "./settings";

export const dynamic = "force-dynamic";

type Payload = {
  author?: { name?: string };
  actor?: { name?: string } | null;
  item?: { name?: string; type?: string } | null;
  flavor?: string;
  rolls?: { formula?: string; total?: number }[];
};

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUserId();
  const member = await prisma.campaignMember.findUnique({
    where: { campaignId_userId: { campaignId: id, userId } },
    include: {
      campaign: {
        include: { members: true, apiKeys: { orderBy: { createdAt: "asc" } } },
      },
    },
  });
  if (!member) notFound();
  const campaign = member.campaign;
  const isCreator = campaign.creatorId === userId;

  const events = await prisma.rawEvent.findMany({
    where: { campaignId: id, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 p-6">
      <div className="mb-6 flex items-center gap-4">
        {campaign.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={campaign.image} alt="" className="h-16 w-16 rounded object-cover" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded bg-gray-100 text-3xl dark:bg-gray-800">
            🎲
          </span>
        )}
        <div>
          <h1 className="text-2xl font-bold">{campaign.name}</h1>
          <p className="text-sm text-gray-500">
            {campaign.members.length} members · {events.length} recent rolls ·{" "}
            {member.role === "gm" ? "you're the GM" : "player"}
          </p>
        </div>
      </div>

      {isCreator && (
        <CampaignSettings
          campaign={campaign}
          apiKeys={campaign.apiKeys.map((k) => ({
            id: k.id,
            name: k.name,
            keyPrefix: k.keyPrefix,
            createdAt: k.createdAt.toISOString(),
            lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          }))}
        />
      )}

      <h2 className="mb-3 mt-8 text-lg font-semibold">Latest rolls</h2>
      <ul className="space-y-2 font-mono text-sm">
        {events.length === 0 && (
          <p className="font-sans text-gray-500">
            Nothing yet — point the Foundry module at this campaign and roll.
          </p>
        )}
        {events.map((e) => {
          const p = (e.payload ?? {}) as Payload;
          const roll = p.rolls?.[0];
          return (
            <li key={e.id} className="rounded border border-gray-200 p-3 dark:border-gray-800">
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <span className="font-bold">{p.actor?.name ?? p.author?.name ?? "—"}</span>
                <span>{p.item?.name ?? p.flavor ?? ""}</span>
                {roll && (
                  <span>
                    {roll.formula} = <span className="font-bold">{roll.total}</span>
                  </span>
                )}
                <span className="ml-auto text-gray-500">
                  {e.updatedAt.toISOString().replace("T", " ").slice(0, 19)}
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
