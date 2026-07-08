import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/campaigns";
import {
  actorAbilityMatrix,
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
import { actorFidsForKind, rollLog, sessions } from "@/lib/stats";
import { BubblePackCard } from "./bubble-card";
import { RollLog } from "./roll-log";
import { ViewToggle } from "./view-toggle";
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
import { Badge } from "@/components/ui/badge";
import { CampaignSettings } from "./settings";
import { ClearRolls } from "./clear-rolls";
import { SendSummary } from "./send-summary";
import { ShowInactiveToggle } from "./show-inactive-toggle";
import { LiveRefresh } from "./live-refresh";
import { FilterBar } from "./filter-bar";
import { CharacterTable, DeathSavesCard, ItemsCard, Section, StatCards } from "./panels";
import {
  D20HistogramCard,
  DicePactsCard,
  RadarCard,
  RollTypesCard,
  SkillBarsCard,
  type NamedCount,
  type RadarRow,
} from "./dashboard-charts";

export const dynamic = "force-dynamic";


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
    view?: string;
    showAll?: string;
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

  const view = sp.view === "log" ? ("log" as const) : ("charts" as const);
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
    // Only the GM sees death saves inside the hiding window.
    includeHidden: isCreator,
  };

  const [
    stats,
    histogram,
    types,
    deathSaves,
    totals,
    skillBuckets,
    skillMatrix,
    checkMatrix,
    saveMatrix,
    options,
    items,
    tops,
    actors,
    members,
  ] = await Promise.all([
    actorStats(id, filters, by),
    d20Histogram(id, filters, by),
    rollTypeCounts(id, filters),
    recentDeathSaves(id, filters),
    campaignTotals(id, filters),
    skillAbilityBuckets(id, filters),
    actorSkillMatrix(id, filters, by),
    actorAbilityMatrix(id, filters, by, ["ability"]),
    actorAbilityMatrix(id, filters, by, ["save", "concentration"]),
    filterOptions(id),
    itemUsage(id, filters),
    actorTops(id, filters, by),
    prisma.actor.findMany({ where: { campaignId: id } }),
    campaignMembers(id),
  ]);
  const sessionList = await sessions(id);
  const logRows = view === "log" ? await rollLog(id, filters) : [];
  const summaryKeys = isCreator
    ? (
        await prisma.sessionSummary.findMany({
          where: { campaignId: id },
          select: { datesKey: true },
        })
      ).map((s) => s.datesKey)
    : [];

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
    axis: SKILL_NAMES[skill] ?? skill,
    ...Object.fromEntries(skillMatrix.actors.map((a) => [a.name, a.counts[i]])),
  }));

  const abilityRadar = (matrix: typeof checkMatrix) => ({
    series: matrix.actors.map((a) => ({
      name: a.name,
      color: colors.get(a.name) ?? FALLBACK,
    })),
    data: matrix.skills.map((ability, i) => ({
      axis: ABILITY_NAMES[ability] ?? ability,
      ...Object.fromEntries(matrix.actors.map((a) => [a.name, a.counts[i]])),
    })) as RadarRow[],
  });
  const checkRadar = abilityRadar(checkMatrix);
  const saveRadar = abilityRadar(saveMatrix);

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
  const slicedPcCards = !kind || kind === "pc" ? pcCards.filter(matchesActor) : [];
  const slicedMonsterCards =
    kind === "pc" ? [] : monsterCards.filter((c) => (!kind || c.kind === kind) && matchesActor(c));

  // Zero-roll creatures stay hidden until the GM asks for them.
  const showAll = sp.showAll === "1";
  const isActive = (c: CharacterCardData) => (c.stats?.allRolls ?? 0) > 0;
  const visiblePcCards = showAll ? slicedPcCards : slicedPcCards.filter(isActive);
  const visibleMonsterCards = showAll ? slicedMonsterCards : slicedMonsterCards.filter(isActive);
  const inactiveCount =
    slicedPcCards.filter((c) => !isActive(c)).length +
    slicedMonsterCards.filter((c) => !isActive(c)).length;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-4 sm:space-y-8 sm:p-6">
      <LiveRefresh campaignId={id} />

      <div className="flex items-center gap-3 border-b pb-4 sm:gap-4 sm:pb-6">
        {campaign.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={campaign.image} alt="" className="h-12 w-12 rounded-xl object-cover sm:h-14 sm:w-14" />
        ) : (
          <span className="flex h-12 w-12 items-center justify-center rounded-md bg-muted text-xl font-bold sm:h-14 sm:w-14">
            {campaign.name.slice(0, 1)}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{campaign.name}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant={member.role === "gm" ? "default" : "secondary"}>
              {member.role === "gm" ? "GM" : "Player"}
            </Badge>
            <span>
              {campaign.members.length} member{campaign.members.length === 1 ? "" : "s"}
            </span>
            {sessionList.length > 0 && (
              <span>
                · {sessionList.length} session{sessionList.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>
        {isCreator && (
          <span className="ml-auto self-start">
            <SendSummary
              campaignId={id}
              sessions={sessionList}
              webhookConfigured={!!campaign.discordWebhookUrl}
              generatedKeys={summaryKeys}
            />
          </span>
        )}
      </div>

      {/* View toggle above, labelled filter grid beneath. */}
      <div className="flex flex-col-reverse gap-4">
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
        <ViewToggle view={view} />
      </div>

      {view === "log" && (
        <RollLog
          campaignId={id}
          rows={logRows}
          colors={colors}
          images={new Map(actors.filter((a) => a.image).map((a) => [a.name, a.image]))}
          isCreator={isCreator}
          ownedFids={actors.filter((a) => a.assignedUserId === userId).map((a) => a.foundryActorId)}
          sessionDates={sessionList.map((s) => s.date)}
        />
      )}

      {view === "charts" && (
        <>
          <StatCards totals={totals} />

      {(visiblePcCards.length > 0 ||
        (isCreator && visibleMonsterCards.length > 0) ||
        inactiveCount > 0) && (
        <Section title="The party" description="Each character's story so far">
          <ShowInactiveToggle hiddenCount={inactiveCount} showAll={showAll} />
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
        <div className="grid gap-4">
          <SkillBarsCard
            data={skillBars}
            legend={abilitiesInUse.map((a) => ({ label: ABILITY_NAMES[a], color: ABILITY_COLORS[a] }))}
          />
          <RollTypesCard data={typeBars} />
        </div>
        <div className="grid gap-4">
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
          <RadarCard
            title="Ability checks"
            description="Bare ability checks by ability"
            data={checkRadar.data}
            series={checkRadar.series}
          />
          <RadarCard
            title="Saving throws"
            description="Saves and concentration by ability"
            data={saveRadar.data}
            series={saveRadar.series}
          />
          <RadarCard
            title="Skill checks"
            description="Who leans on which skills"
            data={radarData}
            series={radarSeries}
          />
        </div>
      </Section>

          <DeathSavesCard saves={deathSaves} />
        </>
      )}

      <ClearRolls
        campaignId={id}
        isCreator={isCreator}
        actors={(isCreator ? actors : actors.filter((a) => a.assignedUserId === userId))
          .map((a) => ({ fid: a.foundryActorId, name: a.name }))
          .sort((x, y) => x.name.localeCompare(y.name))}
        sessions={sessionList}
      />

      {isCreator && (
        <CampaignSettings
          campaign={campaign}
          members={members}
          apiKeys={campaign.apiKeys.map((k) => ({
            id: k.id,
            name: k.name,
            keyPrefix: k.keyPrefix,
            createdAt: k.createdAt.toISOString(),
            lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          }))}
        />
      )}
    </main>
  );
}
