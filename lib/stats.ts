import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

// Dashboard aggregates over the derived rolls table, all filterable by
// character, roll type, and recency. Raw SQL where Prisma's groupBy can't
// express single-pass FILTER aggregates; BigInt counts normalized to Number.

export type StatFilters = {
  actor?: string;
  type?: string;
  days?: number;
};

function sqlFilters(campaignId: string, f: StatFilters): Prisma.Sql {
  return Prisma.sql`
    campaign_id = ${campaignId}::uuid
    AND deleted_at IS NULL
    ${f.actor ? Prisma.sql`AND actor_name = ${f.actor}` : Prisma.empty}
    ${f.type ? Prisma.sql`AND roll_type = ${f.type}` : Prisma.empty}
    ${f.days ? Prisma.sql`AND rolled_at > now() - make_interval(days => ${f.days})` : Prisma.empty}`;
}

function whereFilters(campaignId: string, f: StatFilters) {
  return {
    campaignId,
    deletedAt: null,
    ...(f.actor ? { actorName: f.actor } : {}),
    ...(f.type ? { rollType: f.type } : {}),
    ...(f.days ? { rolledAt: { gt: new Date(Date.now() - f.days * 86_400_000) } } : {}),
  };
}

export type ActorStats = {
  actorName: string;
  allRolls: number;
  d20Rolls: number;
  nat20s: number;
  nat1s: number;
  avgD20: number | null;
  damage: number;
  healing: number;
};

export async function actorStats(campaignId: string, f: StatFilters = {}): Promise<ActorStats[]> {
  const rows = await prisma.$queryRaw<
    {
      actor_name: string;
      all_rolls: bigint;
      d20_rolls: bigint;
      nat20s: bigint;
      nat1s: bigint;
      avg_d20: number | null;
      damage: number | null;
      healing: number | null;
    }[]
  >`
    SELECT actor_name,
           COUNT(*)                                                            AS all_rolls,
           COUNT(*) FILTER (WHERE d20 IS NOT NULL)                             AS d20_rolls,
           COUNT(*) FILTER (WHERE is_nat20)                                    AS nat20s,
           COUNT(*) FILTER (WHERE is_nat1)                                     AS nat1s,
           AVG(d20)                                                            AS avg_d20,
           COALESCE(SUM(damage_total) FILTER (WHERE roll_type = 'damage'), 0)  AS damage,
           COALESCE(SUM(damage_total) FILTER (WHERE roll_type = 'healing'), 0) AS healing
    FROM rolls
    WHERE ${sqlFilters(campaignId, f)}
      AND actor_name IS NOT NULL AND actor_name <> ''
    GROUP BY actor_name
    ORDER BY all_rolls DESC`;
  return rows.map((r) => ({
    actorName: r.actor_name,
    allRolls: Number(r.all_rolls),
    d20Rolls: Number(r.d20_rolls),
    nat20s: Number(r.nat20s),
    nat1s: Number(r.nat1s),
    avgD20: r.avg_d20 === null ? null : Number(r.avg_d20),
    damage: Number(r.damage ?? 0),
    healing: Number(r.healing ?? 0),
  }));
}

export type CampaignTotals = {
  totalRolls: number;
  nat20s: number;
  nat1s: number;
  avgD20: number | null;
  highest: { total: number; actorName: string | null; rolledAt: Date } | null;
};

export async function campaignTotals(
  campaignId: string,
  f: StatFilters = {},
): Promise<CampaignTotals> {
  const [agg] = await prisma.$queryRaw<
    { total_rolls: bigint; nat20s: bigint; nat1s: bigint; avg_d20: number | null }[]
  >`
    SELECT COUNT(*)                          AS total_rolls,
           COUNT(*) FILTER (WHERE is_nat20)  AS nat20s,
           COUNT(*) FILTER (WHERE is_nat1)   AS nat1s,
           AVG(d20)                          AS avg_d20
    FROM rolls
    WHERE ${sqlFilters(campaignId, f)}`;
  const highest = await prisma.roll.findFirst({
    where: { ...whereFilters(campaignId, f), d20: { not: null }, total: { not: null } },
    orderBy: { total: "desc" },
    select: { total: true, actorName: true, rolledAt: true },
  });
  return {
    totalRolls: Number(agg?.total_rolls ?? 0),
    nat20s: Number(agg?.nat20s ?? 0),
    nat1s: Number(agg?.nat1s ?? 0),
    avgD20: agg?.avg_d20 === null || agg === undefined ? null : Number(agg.avg_d20),
    highest: highest?.total != null ? { ...highest, total: highest.total } : null,
  };
}

export type D20Bucket = { face: number; count: number };

/** Full 1–20 histogram (zero-filled) of every d20 rolled. */
export async function d20Histogram(campaignId: string, f: StatFilters = {}): Promise<D20Bucket[]> {
  const rows = await prisma.roll.groupBy({
    by: ["d20"],
    where: { ...whereFilters(campaignId, f), d20: { not: null } },
    _count: { _all: true },
  });
  const byFace = new Map(rows.map((r) => [r.d20 as number, r._count._all]));
  return Array.from({ length: 20 }, (_, i) => ({ face: i + 1, count: byFace.get(i + 1) ?? 0 }));
}

export type RollTypeCount = { rollType: string; count: number };

export async function rollTypeCounts(
  campaignId: string,
  f: StatFilters = {},
): Promise<RollTypeCount[]> {
  const rows = await prisma.roll.groupBy({
    by: ["rollType"],
    where: whereFilters(campaignId, f),
    _count: { _all: true },
  });
  return rows
    .map((r) => ({ rollType: r.rollType, count: r._count._all }))
    .sort((a, b) => b.count - a.count);
}

export type SkillAbilityBucket = {
  /** Skill id ("prc") or ability id ("dex") when the check had no skill. */
  key: string;
  isSkill: boolean;
  ability: string | null;
  count: number;
};

/** d20 checks bucketed by skill (or bare ability for skill-less checks/saves). */
export async function skillAbilityBuckets(
  campaignId: string,
  f: StatFilters = {},
): Promise<SkillAbilityBucket[]> {
  const rows = await prisma.$queryRaw<
    { key: string; is_skill: boolean; ability: string | null; count: bigint }[]
  >`
    SELECT COALESCE(skill, ability)  AS key,
           skill IS NOT NULL         AS is_skill,
           ability,
           COUNT(*)                  AS count
    FROM rolls
    WHERE ${sqlFilters(campaignId, f)}
      AND d20 IS NOT NULL
      AND COALESCE(skill, ability) IS NOT NULL
    GROUP BY 1, 2, 3
    ORDER BY count DESC`;
  return rows.map((r) => ({
    key: r.key,
    isSkill: r.is_skill,
    ability: r.ability,
    count: Number(r.count),
  }));
}

export type SkillMatrix = {
  skills: string[];
  actors: { name: string; counts: number[] }[];
};

/** Actor × skill counts for the radar chart. */
export async function actorSkillMatrix(
  campaignId: string,
  f: StatFilters = {},
): Promise<SkillMatrix> {
  const rows = await prisma.$queryRaw<{ actor_name: string; skill: string; count: bigint }[]>`
    SELECT actor_name, skill, COUNT(*) AS count
    FROM rolls
    WHERE ${sqlFilters(campaignId, f)}
      AND skill IS NOT NULL
      AND actor_name IS NOT NULL AND actor_name <> ''
    GROUP BY 1, 2`;
  const skills = [...new Set(rows.map((r) => r.skill))].sort();
  const byActor = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const m = byActor.get(r.actor_name) ?? new Map<string, number>();
    m.set(r.skill, Number(r.count));
    byActor.set(r.actor_name, m);
  }
  return {
    skills,
    actors: [...byActor.entries()].map(([name, m]) => ({
      name,
      counts: skills.map((s) => m.get(s) ?? 0),
    })),
  };
}

export type DeathSaveRow = {
  actorName: string | null;
  d20: number | null;
  total: number | null;
  rolledAt: Date;
};

export async function recentDeathSaves(
  campaignId: string,
  f: StatFilters = {},
  take = 10,
): Promise<DeathSaveRow[]> {
  return prisma.roll.findMany({
    where: { ...whereFilters(campaignId, f), rollType: "death" },
    orderBy: { rolledAt: "desc" },
    take,
    select: { actorName: true, d20: true, total: true, rolledAt: true },
  });
}

/** Distinct values for the filter bar — always unfiltered. */
export async function filterOptions(campaignId: string) {
  const [actors, types] = await Promise.all([
    prisma.roll.findMany({
      where: { campaignId, deletedAt: null, actorName: { not: null } },
      distinct: ["actorName"],
      select: { actorName: true },
      orderBy: { actorName: "asc" },
    }),
    prisma.roll.findMany({
      where: { campaignId, deletedAt: null },
      distinct: ["rollType"],
      select: { rollType: true },
      orderBy: { rollType: "asc" },
    }),
  ]);
  return {
    actors: actors.map((a) => a.actorName).filter((n): n is string => !!n),
    types: types.map((t) => t.rollType),
  };
}
