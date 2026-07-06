import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/campaigns";
import {
  actorSkillMatrix,
  actorStats,
  actorTops,
  campaignTotals,
  d20Histogram,
  filterOptions,
  itemUsage,
  recentDeathSaves,
  rollTypeCounts,
  skillAbilityBuckets,
  type StatFilters,
} from "@/lib/stats";
import { campaignMembers } from "@/lib/members";
import { SKILL_NAMES as SKILL_LABELS } from "@/lib/dnd5e-meta";
import { CharacterCard, type CharacterCardData } from "./character-cards";
import {
  ABILITY_COLORS,
  ABILITY_NAMES,
  SKILL_ABILITY,
  SKILL_NAMES,
  characterColors,
} from "@/lib/dnd5e-meta";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CampaignSettings } from "./settings";
import { LiveRefresh } from "./live-refresh";
import { FilterBar } from "./filter-bar";
import { CharacterTable, DeathSavesCard, ItemsCard, Section, StatCards } from "./panels";
import {
  D20HistogramCard,
  DicePactsCard,
  RollTypesCard,
  SkillBarsCard,
  SkillRadarCard,
  type NamedCount,
  type RadarRow,
} from "./dashboard-charts";

export const dynamic = "force-dynamic";

type Payload = {
  author?: { name?: string };
  actor?: { name?: string } | null;
  item?: { name?: string; type?: string } | null;
  flavor?: string;
  rolls?: { formula?: string; total?: number }[];
};

const FALLBACK = "#6b7280";

export default async function CampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ actor?: string; type?: string; days?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
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

  const days = sp.days ? Number(sp.days) : undefined;
  const filters: StatFilters = {
    actor: sp.actor || undefined,
    type: sp.type || undefined,
    days: days && Number.isFinite(days) ? days : undefined,
  };

  const [
    events,
    stats,
    histogram,
    types,
    deathSaves,
    totals,
    skillBuckets,
    skillMatrix,
    options,
    items,
    tops,
    actors,
    members,
  ] = await Promise.all([
    prisma.rawEvent.findMany({
      where: { campaignId: id, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
    actorStats(id, filters),
    d20Histogram(id, filters),
    rollTypeCounts(id, filters),
    recentDeathSaves(id, filters),
    campaignTotals(id, filters),
    skillAbilityBuckets(id, filters),
    actorSkillMatrix(id, filters),
    filterOptions(id),
    itemUsage(id, filters),
    actorTops(id, filters),
    prisma.actor.findMany({ where: { campaignId: id } }),
    campaignMembers(id),
  ]);

  const colors = characterColors(options.actors);
  const memberName = new Map(members.map((m) => [m.userId, m.name]));
  const statsByName = new Map(stats.map((s) => [s.actorName, s]));
  const topsByName = new Map(tops.map((t) => [t.actorName, t]));

  // Card per discovered actor; viewer's own characters first, then other
  // players' characters. Unassigned actors are the GM's monster/NPC bucket.
  const cardOf = (a: (typeof actors)[number]): CharacterCardData => ({
    actorId: a.id,
    name: a.name,
    image: a.image,
    color: colors.get(a.name) ?? FALLBACK,
    assignedUserId: a.assignedUserId,
    stats: statsByName.get(a.name) ?? null,
    tops: topsByName.get(a.name)
      ? {
          ...topsByName.get(a.name)!,
          topSkill: topsByName.get(a.name)!.topSkill
            ? (SKILL_LABELS[topsByName.get(a.name)!.topSkill!] ?? topsByName.get(a.name)!.topSkill)
            : null,
        }
      : null,
  });
  const byRolls = (x: CharacterCardData, y: CharacterCardData) =>
    (y.stats?.allRolls ?? 0) - (x.stats?.allRolls ?? 0);
  const pcCards = actors
    .filter((a) => a.assignedUserId)
    .map(cardOf)
    .sort((x, y) => Number(y.assignedUserId === userId) - Number(x.assignedUserId === userId) || byRolls(x, y));
  const monsterCards = actors.filter((a) => !a.assignedUserId).map(cardOf).sort(byRolls);

  const skillBars: NamedCount[] = skillBuckets.map((b) => {
    const ability = b.isSkill ? (SKILL_ABILITY[b.key] ?? b.ability) : b.key;
    return {
      name: b.isSkill ? (SKILL_NAMES[b.key] ?? b.key) : `${ABILITY_NAMES[b.key] ?? b.key} (raw)`,
      count: b.count,
      fill: ABILITY_COLORS[ability ?? ""] ?? FALLBACK,
    };
  });
  const abilitiesInUse = [
    ...new Set(skillBuckets.map((b) => (b.isSkill ? (SKILL_ABILITY[b.key] ?? b.ability) : b.key))),
  ].filter((a): a is string => !!a && !!ABILITY_NAMES[a]);

  const typeBars: NamedCount[] = types.map((t) => ({
    name: t.rollType,
    count: t.count,
    fill: "var(--chart-2)",
  }));

  const pactRows = stats
    .filter((s) => s.d20Rolls > 0)
    .map((s) => ({
      name: s.actorName,
      color: colors.get(s.actorName) ?? FALLBACK,
      nat20: +((s.nat20s / s.d20Rolls) * 100).toFixed(2),
      nat1: +((s.nat1s / s.d20Rolls) * 100).toFixed(2),
    }));

  const radarSeries = skillMatrix.actors.map((a) => ({
    name: a.name,
    color: colors.get(a.name) ?? FALLBACK,
  }));
  const radarData: RadarRow[] = skillMatrix.skills.map((skill, i) => ({
    skill: SKILL_NAMES[skill] ?? skill,
    ...Object.fromEntries(skillMatrix.actors.map((a) => [a.name, a.counts[i]])),
  }));

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-8 p-6">
      <LiveRefresh campaignId={id} />

      <div className="flex items-center gap-4">
        {campaign.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={campaign.image} alt="" className="h-16 w-16 rounded-lg object-cover" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted text-3xl">
            🎲
          </span>
        )}
        <div>
          <h1 className="text-2xl font-bold">{campaign.name}</h1>
          <p className="text-sm text-muted-foreground">
            {campaign.members.length} member{campaign.members.length === 1 ? "" : "s"} ·{" "}
            {member.role === "gm" ? "you're the GM" : "player"}
          </p>
        </div>
      </div>

      <FilterBar actors={options.actors} types={options.types} current={sp} />

      <StatCards totals={totals} />

      {(pcCards.length > 0 || (isCreator && monsterCards.length > 0)) && (
        <Section title="The party" description="Each character's story so far">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pcCards.map((c) => (
              <CharacterCard
                key={c.actorId}
                data={c}
                isOwn={c.assignedUserId === userId}
                ownerName={c.assignedUserId ? (memberName.get(c.assignedUserId) ?? null) : null}
                members={members}
                canAssign={isCreator}
              />
            ))}
          </div>
          {isCreator && monsterCards.length > 0 && (
            <>
              <h3 className="pt-2 text-sm font-semibold text-muted-foreground">
                Monsters &amp; NPCs (GM only — assign player characters above via the selector)
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {monsterCards.map((c) => (
                  <CharacterCard
                    key={c.actorId}
                    data={c}
                    isOwn={false}
                    ownerName={null}
                    members={members}
                    canAssign
                  />
                ))}
              </div>
            </>
          )}
        </Section>
      )}

      <Section title="What the table rolls" description="Where the dice get pointed">
        <div className="grid gap-4 lg:grid-cols-2">
          <SkillBarsCard
            data={skillBars}
            legend={abilitiesInUse.map((a) => ({ label: ABILITY_NAMES[a], color: ABILITY_COLORS[a] }))}
          />
          <RollTypesCard data={typeBars} />
        </div>
        <ItemsCard items={items} />
      </Section>

      <Section title="Dice fairness" description="Is the randomness actually random?">
        <div className="grid gap-4">
          <D20HistogramCard data={histogram} />
          <DicePactsCard rows={pactRows} />
        </div>
      </Section>

      <Section title="Characters" description="Who does what, and how well">
        <div className="grid gap-4">
          <CharacterTable stats={stats} colors={colors} />
          <SkillRadarCard data={radarData} series={radarSeries} />
        </div>
      </Section>

      <DeathSavesCard saves={deathSaves} />

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

      <Card>
        <CardHeader>
          <CardTitle>Latest rolls</CardTitle>
          <CardDescription>Raw feed — most recent first</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 font-mono text-sm">
            {events.length === 0 && (
              <p className="font-sans text-muted-foreground">
                Nothing yet — point the Foundry module at this campaign and roll.
              </p>
            )}
            {events.map((e) => {
              const p = (e.payload ?? {}) as Payload;
              const roll = p.rolls?.[0];
              return (
                <li key={e.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    <span className="font-bold">{p.actor?.name ?? p.author?.name ?? "—"}</span>
                    <span>{p.item?.name ?? p.flavor ?? ""}</span>
                    {roll && (
                      <span>
                        {roll.formula} = <span className="font-bold">{roll.total}</span>
                      </span>
                    )}
                    <span className="ml-auto text-muted-foreground">
                      {e.updatedAt.toISOString().replace("T", " ").slice(0, 19)}
                    </span>
                  </div>
                  <details className="mt-1">
                    <summary className="cursor-pointer text-muted-foreground">payload</summary>
                    <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-xs">
                      {JSON.stringify(e.payload, null, 2)}
                    </pre>
                  </details>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}
