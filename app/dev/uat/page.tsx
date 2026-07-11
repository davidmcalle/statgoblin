import { notFound } from "next/navigation";
import {
  UAT_ACTORS,
  UAT_MEMBERS,
  uatAbilityMatrix,
  uatActorStats,
  uatActorTops,
  uatDeathSaves,
  uatFilter,
  uatFilterOptions,
  uatHistogram,
  uatItemUsage,
  uatRollLog,
  uatRollTypeCounts,
  uatSessions,
  uatSkillBuckets,
  uatSkillMatrix,
  uatTotals,
  type UatFilters,
} from "@/lib/fixtures/uat";
import { RollLog } from "@/app/campaigns/[id]/roll-log";
import { ViewToggle } from "@/app/campaigns/[id]/view-toggle";
import { FilterBar } from "@/app/campaigns/[id]/filter-bar";
import { MonsterBrowser } from "@/app/campaigns/[id]/monster-browser";
import { CharacterCard, type CharacterCardData } from "@/app/campaigns/[id]/character-cards";
import { BubblePackCard } from "@/app/campaigns/[id]/bubble-card";
import {
  CharacterTable,
  DeathSavesCard,
  ItemsCard,
  Section,
  StatCards,
} from "@/app/campaigns/[id]/panels";
import {
  D20HistogramCard,
  DicePactsCard,
  RadarCard,
  RollTypesCard,
  SkillBarsCard,
  type NamedCount,
  type RadarRow,
} from "@/app/campaigns/[id]/dashboard-charts";
import {
  ABILITY_COLORS,
  ABILITY_NAMES,
  SKILL_ABILITY,
  SKILL_NAMES,
  characterColors,
} from "@/lib/dnd5e-meta";
import { SKILL_NAMES as SKILL_LABELS } from "@/lib/dnd5e-meta";
import { Badge } from "@/components/ui/badge";

const FALLBACK = "#6b7280";

// UAT sandbox: the campaign dashboard rendered against the in-memory fixture
// dataset — no auth, no database. Dev builds only.
export default async function UatPage({
  searchParams,
}: {
  searchParams: Promise<{
    actor?: string;
    type?: string;
    days?: string;
    kind?: string;
    session?: string;
    by?: string;
    view?: string;
  }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;

  const view = sp.view === "log" ? ("log" as const) : ("charts" as const);
  const days = sp.days ? Number(sp.days) : undefined;
  const kind = ["pc", "npc", "monster"].includes(sp.kind ?? "") ? sp.kind : undefined;
  const by = sp.by === "player" ? ("author" as const) : ("actor" as const);
  const filters: UatFilters = {
    actor: sp.actor || undefined,
    type: sp.type || undefined,
    days: days && Number.isFinite(days) ? days : undefined,
    session: /^\d{4}-\d{2}-\d{2}$/.test(sp.session ?? "") ? sp.session : undefined,
    kind,
    includeHidden: true, // render as the GM so hidden badges are visible
  };

  const rolls = uatFilter(filters);
  const stats = uatActorStats(rolls, by);
  const histogram = uatHistogram(rolls, by);
  const types = uatRollTypeCounts(rolls);
  const deathSaves = uatDeathSaves(rolls);
  const totals = uatTotals(rolls);
  const skillBuckets = uatSkillBuckets(rolls);
  const skillMatrix = uatSkillMatrix(rolls, by);
  const checkMatrix = uatAbilityMatrix(rolls, by, ["ability"]);
  const saveMatrix = uatAbilityMatrix(rolls, by, ["save", "concentration"]);
  const options = uatFilterOptions();
  const items = uatItemUsage(rolls);
  const tops = uatActorTops(rolls, by);
  const sessionList = uatSessions();
  const logRows = view === "log" ? uatRollLog(rolls) : [];

  const colors = characterColors([...options.actors, ...stats.map((s) => s.actorName)]);
  const statsByName = new Map(stats.map((s) => [s.actorName, s]));
  const topsByName = new Map(tops.map((t) => [t.actorName, t]));
  const memberName = new Map(UAT_MEMBERS.map((m) => [m.userId, m.name]));

  const cardOf = (a: (typeof UAT_ACTORS)[number]): CharacterCardData => ({
    actorId: a.actorId,
    name: a.name,
    image: a.image,
    color: colors.get(a.name) ?? FALLBACK,
    actorType: a.actorType,
    cr: a.cr,
    kind: a.kind,
    kindOverride: null,
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
  const pcCards = UAT_ACTORS.filter((a) => a.kind === "pc").map(cardOf).sort(byRolls);
  const monsterCards = UAT_ACTORS.filter((a) => a.kind !== "pc").map(cardOf).sort(byRolls);

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

  const skillBubbles = skillBars.map((b) => ({ name: b.name, value: b.count, color: b.fill }));
  const subjectBubbles = stats.map((s) => ({
    name: s.actorName,
    value: s.allRolls,
    color: colors.get(s.actorName) ?? FALLBACK,
  }));
  const subjectWord = by === "author" ? "player" : "character";

  const matchesActor = (c: CharacterCardData) => !filters.actor || c.name === filters.actor;
  const visiblePcCards = !kind || kind === "pc" ? pcCards.filter(matchesActor) : [];
  const visibleMonsterCards =
    kind === "pc" ? [] : monsterCards.filter((c) => (!kind || c.kind === kind) && matchesActor(c));

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-4 sm:space-y-8 sm:p-6">
      <div className="flex items-center gap-3 border-b pb-4 sm:gap-4 sm:pb-6">
        <span className="flex h-12 w-12 items-center justify-center rounded-md bg-muted text-xl font-bold sm:h-14 sm:w-14">
          U
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">UAT Fixtures</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Badge>GM</Badge>
            <span>{UAT_MEMBERS.length} members</span>
            <span>
              · {sessionList.length} session{sessionList.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-4">
        <FilterBar
          pcActors={UAT_ACTORS.filter((a) => a.kind === "pc").map((a) => a.name).sort()}
          monsterActors={UAT_ACTORS.filter((a) => a.kind !== "pc").map((a) => a.name).sort()}
          types={options.types}
          sessions={sessionList}
          current={sp}
        />
        <ViewToggle view={view} />
      </div>

      {view === "log" && (
        <RollLog
          rows={logRows}
          colors={colors}
          images={new Map()}
          isCreator
          ownedFids={[]}
        />
      )}

      {view === "charts" && (
        <>
          <StatCards totals={totals} />

          {(visiblePcCards.length > 0 || visibleMonsterCards.length > 0) && (
            <Section title="The party" description="Each character's story so far">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visiblePcCards.map((c) => (
                  <CharacterCard
                    key={c.actorId}
                    data={c}
                    isOwn={c.assignedUserId === "uat_p1"}
                    ownerName={c.assignedUserId ? (memberName.get(c.assignedUserId) ?? null) : null}
                    members={UAT_MEMBERS}
                    canAssign={false}
                  />
                ))}
              </div>
              {visibleMonsterCards.length > 0 && (
                <MonsterBrowser cards={visibleMonsterCards} members={UAT_MEMBERS} />
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
    </main>
  );
}
