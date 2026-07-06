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
import { actorFidsForKind, sessions } from "@/lib/stats";
import { BubblePackCard } from "./bubble-card";
import { effectiveKind } from "@/lib/kind";
import { campaignMembers } from "@/lib/members";
import { SKILL_NAMES as SKILL_LABELS } from "@/lib/dnd5e-meta";
import { CharacterCard, type CharacterCardData } from "./character-cards";
import { MonsterBrowser } from "./monster-browser";
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
  searchParams: Promise<{
    actor?: string;
    type?: string;
    days?: string;
    kind?: string;
    session?: string;
    by?: string;
  }>;
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
  const kind = ["pc", "npc", "monster"].includes(sp.kind ?? "") ? sp.kind : undefined;
  // Grouping axis: metrics keyed by character (actor) or by player (author).
  const by = sp.by === "player" ? ("author" as const) : ("actor" as const);
  const filters: StatFilters = {
    actor: sp.actor || undefined,
    type: sp.type || undefined,
    days: days && Number.isFinite(days) ? days : undefined,
    session: /^\d{4}-\d{2}-\d{2}$/.test(sp.session ?? "") ? sp.session : undefined,
    // Kind is an actors-table property (override + auto rule); resolve to ids.
    actorFids: kind ? await actorFidsForKind(id, kind) : undefined,
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
    actorStats(id, filters, by),
    d20Histogram(id, filters, by),
    rollTypeCounts(id, filters),
    recentDeathSaves(id, filters),
    campaignTotals(id, filters),
    skillAbilityBuckets(id, filters),
    actorSkillMatrix(id, filters, by),
    filterOptions(id),
    itemUsage(id, filters),
    actorTops(id, filters, by),
    prisma.actor.findMany({ where: { campaignId: id } }),
    campaignMembers(id),
  ]);
  const sessionList = await sessions(id);

  // Subject = whatever the grouping axis produces (character or player names).
  const colors = characterColors([...options.actors, ...stats.map((s) => s.actorName)]);
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
    actorType: a.actorType,
    cr: a.cr,
    kind: effectiveKind(a),
    kindOverride: a.kindOverride,
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
  // Party row = effective pc; everything else (monsters + friendly NPCs) lives
  // in the GM's browser, badges telling them apart.
  const pcCards = actors
    .filter((a) => effectiveKind(a) === "pc")
    .map(cardOf)
    .sort((x, y) => Number(y.assignedUserId === userId) - Number(x.assignedUserId === userId) || byRolls(x, y));
  const monsterCards = actors
    .filter((a) => effectiveKind(a) !== "pc")
    .map(cardOf)
    .sort(byRolls);

  const skillBars: NamedCount[] = skillBuckets.map((b) => {
    const ability = b.isSkill ? (SKILL_ABILITY[b.key] ?? b.ability) : b.key;
    return {
      name: b.isSkill ? (SKILL_NAMES[b.key] ?? b.key) : (ABILITY_NAMES[b.key] ?? b.key),
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

  // Bubble packs — same filtered dataset, so slicers cascade PowerBI-style.
  const skillBubbles = skillBars.map((b) => ({ name: b.name, value: b.count, color: b.fill }));
  const subjectBubbles = stats.map((s) => ({
    name: s.actorName,
    value: s.allRolls,
    color: colors.get(s.actorName) ?? FALLBACK,
  }));
  const subjectWord = by === "author" ? "player" : "character";

  // Card sections obey the slicers too: kind hides whole groups, the
  // character filter narrows to that one card.
  const matchesActor = (c: CharacterCardData) => !filters.actor || c.name === filters.actor;
  const visiblePcCards = !kind || kind === "pc" ? pcCards.filter(matchesActor) : [];
  const visibleMonsterCards =
    kind === "pc" ? [] : monsterCards.filter((c) => (!kind || c.kind === kind) && matchesActor(c));

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

      <FilterBar
        pcActors={actors
          .filter((a) => effectiveKind(a) === "pc")
          .map((a) => a.name)
          .sort()}
        monsterActors={actors
          .filter((a) => effectiveKind(a) !== "pc")
          .map((a) => a.name)
          .sort()}
        types={options.types}
        sessions={sessionList}
        current={sp}
      />

      <StatCards totals={totals} />

      {(visiblePcCards.length > 0 || (isCreator && visibleMonsterCards.length > 0)) && (
        <Section title="The party" description="Each character's story so far">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visiblePcCards.map((c) => (
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
          {isCreator && visibleMonsterCards.length > 0 && (
            <MonsterBrowser cards={visibleMonsterCards} members={members} />
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
        <div className="grid gap-4 lg:grid-cols-2">
          <BubblePackCard
            title="Skill bubbles"
            description="Bubble size = times rolled, colored by ability"
            bubbles={skillBubbles}
            legend={abilitiesInUse.map((a) => ({ label: ABILITY_NAMES[a], color: ABILITY_COLORS[a] }))}
          />
          <BubblePackCard
            title={`Rolls by ${subjectWord}`}
            description={`Bubble size = total rolls per ${subjectWord}`}
            bubbles={subjectBubbles}
          />
        </div>
        <ItemsCard items={items} />
      </Section>

      <Section title="Dice fairness" description="Is the randomness actually random?">
        <div className="grid gap-4">
          <D20HistogramCard data={histogram} />
          <DicePactsCard rows={pactRows} />
        </div>
      </Section>

      <Section
        title={by === "author" ? "Players" : "Characters"}
        description="Who does what, and how well"
      >
        <div className="grid gap-4">
          <CharacterTable stats={stats} colors={colors} subjectLabel={subjectWord} />
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
