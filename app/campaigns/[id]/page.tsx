import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/campaigns";
import { CampaignSettings } from "./settings";
import { LiveRefresh } from "./live-refresh";
import {
  actorSkillMatrix,
  actorStats,
  campaignTotals,
  d20Histogram,
  recentDeathSaves,
  rollTypeCounts,
  skillAbilityBuckets,
} from "@/lib/stats";
import {
  ActorStatsTable,
  D20HistogramPanel,
  DeathSavesPanel,
  RollTypePanel,
} from "./stats-panels";
import { BubblePack, DicePacts, RadarChart, StatCards, type Bubble } from "./charts";
import {
  ABILITY_COLORS,
  ABILITY_NAMES,
  SKILL_ABILITY,
  SKILL_NAMES,
  characterColors,
} from "@/lib/dnd5e-meta";

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

  const [events, stats, histogram, types, deathSaves, totals, skillBuckets, skillMatrix] =
    await Promise.all([
      prisma.rawEvent.findMany({
        where: { campaignId: id, deletedAt: null },
        orderBy: { updatedAt: "desc" },
        take: 50,
      }),
      actorStats(id),
      d20Histogram(id),
      rollTypeCounts(id),
      recentDeathSaves(id),
      campaignTotals(id),
      skillAbilityBuckets(id),
      actorSkillMatrix(id),
    ]);

  const colors = characterColors(stats.map((s) => s.actorName));
  const fallback = "#6b7280";

  const skillBubbles: Bubble[] = skillBuckets.map((b) => {
    const ability = b.isSkill ? (SKILL_ABILITY[b.key] ?? b.ability) : b.key;
    const label = b.isSkill ? (SKILL_NAMES[b.key] ?? b.key) : (ABILITY_NAMES[b.key] ?? b.key);
    return {
      label,
      value: b.count,
      color: ABILITY_COLORS[ability ?? ""] ?? fallback,
      tooltip: `${label}: ${b.count} rolls`,
    };
  });
  const abilitiesInUse = [
    ...new Set(
      skillBuckets.map((b) => (b.isSkill ? (SKILL_ABILITY[b.key] ?? b.ability) : b.key)),
    ),
  ].filter((a): a is string => !!a && !!ABILITY_NAMES[a]);

  const characterBubbles: Bubble[] = stats.map((s) => ({
    label: s.actorName,
    value: s.allRolls,
    color: colors.get(s.actorName) ?? fallback,
    tooltip: `${s.actorName}: ${s.allRolls} rolls`,
  }));

  const pactRows = stats
    .filter((s) => s.d20Rolls > 0)
    .map((s) => ({
      name: s.actorName,
      color: colors.get(s.actorName) ?? fallback,
      nat20Rate: s.nat20s / s.d20Rolls,
      nat1Rate: s.nat1s / s.d20Rolls,
    }));

  const radarSeries = skillMatrix.actors.map((a) => ({
    name: a.name,
    color: colors.get(a.name) ?? fallback,
    values: a.counts,
  }));
  const radarAxes = skillMatrix.skills.map((s) => SKILL_NAMES[s] ?? s);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 p-6">
      <LiveRefresh campaignId={id} />
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

      <div className="mb-6 grid gap-4">
        <StatCards
          totalRolls={totals.totalRolls}
          nat20s={totals.nat20s}
          nat1s={totals.nat1s}
          avgD20={totals.avgD20}
          highest={totals.highest}
        />
        <BubblePack
          title="Dice by ability & skill"
          bubbles={skillBubbles}
          legend={abilitiesInUse.map((a) => ({
            label: ABILITY_NAMES[a],
            color: ABILITY_COLORS[a],
          }))}
        />
        <DicePacts rows={pactRows} />
        <div className="grid gap-4 lg:grid-cols-2">
          <BubblePack title="Rolls by character" bubbles={characterBubbles} />
          <RadarChart title="Skill checks" axes={radarAxes} series={radarSeries} />
        </div>
        <ActorStatsTable stats={stats} />
        <div className="grid gap-4 sm:grid-cols-2">
          <D20HistogramPanel buckets={histogram} />
          <RollTypePanel counts={types} />
        </div>
        <DeathSavesPanel saves={deathSaves} />
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
