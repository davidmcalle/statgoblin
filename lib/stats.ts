import { prisma } from "@/lib/db/prisma";

// Dashboard aggregates over the derived rolls table. Raw SQL: single-pass
// FILTER aggregates that Prisma's groupBy can't express. BigInt counts are
// normalized to Number before leaving this module.

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

export async function actorStats(campaignId: string): Promise<ActorStats[]> {
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
           COUNT(*)                                                         AS all_rolls,
           COUNT(*) FILTER (WHERE d20 IS NOT NULL)                          AS d20_rolls,
           COUNT(*) FILTER (WHERE is_nat20)                                 AS nat20s,
           COUNT(*) FILTER (WHERE is_nat1)                                  AS nat1s,
           AVG(d20)                                                         AS avg_d20,
           COALESCE(SUM(damage_total) FILTER (WHERE roll_type = 'damage'), 0)  AS damage,
           COALESCE(SUM(damage_total) FILTER (WHERE roll_type = 'healing'), 0) AS healing
    FROM rolls
    WHERE campaign_id = ${campaignId}::uuid
      AND deleted_at IS NULL
      AND actor_name IS NOT NULL AND actor_name <> ''
    GROUP BY actor_name
    ORDER BY d20_rolls DESC`;
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

export type D20Bucket = { face: number; count: number };

/** Full 1–20 histogram (zero-filled) of every d20 rolled in the campaign. */
export async function d20Histogram(campaignId: string): Promise<D20Bucket[]> {
  const rows = await prisma.roll.groupBy({
    by: ["d20"],
    where: { campaignId, deletedAt: null, d20: { not: null } },
    _count: { _all: true },
  });
  const byFace = new Map(rows.map((r) => [r.d20 as number, r._count._all]));
  return Array.from({ length: 20 }, (_, i) => ({
    face: i + 1,
    count: byFace.get(i + 1) ?? 0,
  }));
}

export type RollTypeCount = { rollType: string; count: number };

export async function rollTypeCounts(campaignId: string): Promise<RollTypeCount[]> {
  const rows = await prisma.roll.groupBy({
    by: ["rollType"],
    where: { campaignId, deletedAt: null },
    _count: { _all: true },
    orderBy: { _count: { rollType: "desc" } },
  });
  return rows.map((r) => ({ rollType: r.rollType, count: r._count._all }));
}

export type CampaignTotals = {
  totalRolls: number;
  nat20s: number;
  nat1s: number;
  avgD20: number | null;
  highest: { total: number; actorName: string | null; rolledAt: Date } | null;
};

export async function campaignTotals(campaignId: string): Promise<CampaignTotals> {
  const [agg] = await prisma.$queryRaw<
    { total_rolls: bigint; nat20s: bigint; nat1s: bigint; avg_d20: number | null }[]
  >`
    SELECT COUNT(*)                          AS total_rolls,
           COUNT(*) FILTER (WHERE is_nat20)  AS nat20s,
           COUNT(*) FILTER (WHERE is_nat1)   AS nat1s,
           AVG(d20)                          AS avg_d20
    FROM rolls
    WHERE campaign_id = ${campaignId}::uuid AND deleted_at IS NULL`;
  const highest = await prisma.roll.findFirst({
    where: { campaignId, deletedAt: null, d20: { not: null }, total: { not: null } },
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

export type SkillAbilityBucket = {
  /** Skill id ("prc") or ability id ("dex") when the check had no skill. */
  key: string;
  isSkill: boolean;
  ability: string | null;
  count: number;
};

/** d20 checks bucketed by skill (or bare ability for skill-less checks/saves). */
export async function skillAbilityBuckets(campaignId: string): Promise<SkillAbilityBucket[]> {
  const rows = await prisma.$queryRaw<
    { key: string; is_skill: boolean; ability: string | null; count: bigint }[]
  >`
    SELECT COALESCE(skill, ability)  AS key,
           skill IS NOT NULL         AS is_skill,
           ability,
           COUNT(*)                  AS count
    FROM rolls
    WHERE campaign_id = ${campaignId}::uuid
      AND deleted_at IS NULL
      AND d20 IS NOT NULL
      AND COALESCE(skill, ability) IS NOT NULL
    GROUP BY 1, 2, 3`;
  return rows.map((r) => ({
    key: r.key,
    isSkill: r.is_skill,
    ability: r.ability,
    count: Number(r.count),
  }));
}

export type SkillMatrix = {
  /** Skill ids present in the campaign, alphabetical by display order of use. */
  skills: string[];
  actors: { name: string; counts: number[] }[];
};

/** Actor × skill counts for the radar chart. */
export async function actorSkillMatrix(campaignId: string): Promise<SkillMatrix> {
  const rows = await prisma.$queryRaw<{ actor_name: string; skill: string; count: bigint }[]>`
    SELECT actor_name, skill, COUNT(*) AS count
    FROM rolls
    WHERE campaign_id = ${campaignId}::uuid
      AND deleted_at IS NULL
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

export async function recentDeathSaves(campaignId: string, take = 10): Promise<DeathSaveRow[]> {
  return prisma.roll.findMany({
    where: { campaignId, deletedAt: null, rollType: "death" },
    orderBy: { rolledAt: "desc" },
    take,
    select: { actorName: true, d20: true, total: true, rolledAt: true },
  });
}
