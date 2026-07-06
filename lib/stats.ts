import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { effectiveKind } from "@/lib/kind";

// Dashboard aggregates over the derived rolls table, all filterable by
// character, roll type, and recency. Raw SQL where Prisma's groupBy can't
// express single-pass FILTER aggregates; BigInt counts normalized to Number.

export type StatFilters = {
  actor?: string;
  type?: string;
  days?: number;
  /** ISO date ("2026-07-06") — one session = one distinct play date. */
  session?: string;
  /**
   * Foundry actor ids to include — the resolved form of a kind filter
   * (pc/npc/monster). Kind is an actors-table property (override + auto rule),
   * so callers resolve it to ids via actorFidsForKind before querying rolls.
   */
  actorFids?: string[];
  /** GM view: include death saves currently hidden from players. */
  includeHidden?: boolean;
};

/**
 * Grouping axis for the per-subject panels: by character (actor_name) or by
 * player (author_name). Static strings only — never user input.
 */
export type GroupBy = "actor" | "author";

function subjectCol(by: GroupBy): Prisma.Sql {
  return by === "author" ? Prisma.raw("author_name") : Prisma.raw("actor_name");
}

/** Resolve a kind (pc/npc/monster) to the campaign's matching actor fids. */
export async function actorFidsForKind(
  campaignId: string,
  kind: string,
): Promise<string[]> {
  const actors = await prisma.actor.findMany({
    where: { campaignId },
    select: { foundryActorId: true, kindOverride: true, assignedUserId: true, actorType: true },
  });
  return actors.filter((a) => effectiveKind(a) === kind).map((a) => a.foundryActorId);
}

function sqlFilters(campaignId: string, f: StatFilters): Prisma.Sql {
  return Prisma.sql`
    campaign_id = ${campaignId}::uuid
    AND deleted_at IS NULL
    ${f.actor ? Prisma.sql`AND actor_name = ${f.actor}` : Prisma.empty}
    ${f.type ? Prisma.sql`AND roll_type = ${f.type}` : Prisma.empty}
    ${f.actorFids ? Prisma.sql`AND actor_fid = ANY(${f.actorFids})` : Prisma.empty}
    ${f.includeHidden ? Prisma.empty : Prisma.sql`AND is_hidden = false`}
    ${f.session ? Prisma.sql`AND rolled_at::date = ${f.session}::date` : Prisma.empty}
    ${f.days ? Prisma.sql`AND rolled_at > now() - make_interval(days => ${f.days})` : Prisma.empty}`;
}

function whereFilters(campaignId: string, f: StatFilters) {
  const sessionStart = f.session ? new Date(`${f.session}T00:00:00Z`) : undefined;
  return {
    campaignId,
    deletedAt: null,
    ...(f.actor ? { actorName: f.actor } : {}),
    ...(f.type ? { rollType: f.type } : {}),
    ...(f.actorFids ? { actorFid: { in: f.actorFids } } : {}),
    ...(f.includeHidden ? {} : { isHidden: false }),
    ...(sessionStart
      ? { rolledAt: { gte: sessionStart, lt: new Date(sessionStart.getTime() + 86_400_000) } }
      : f.days
        ? { rolledAt: { gt: new Date(Date.now() - f.days * 86_400_000) } }
        : {}),
  };
}

export type SessionInfo = { n: number; date: string; rolls: number };

/**
 * One session per distinct play date, numbered oldest-first. Numbering is
 * derived fresh each time, so deleting a whole day's rolls renumbers the rest.
 */
export async function sessions(campaignId: string): Promise<SessionInfo[]> {
  const rows = await prisma.$queryRaw<{ day: Date; rolls: bigint }[]>`
    SELECT rolled_at::date AS day, COUNT(*) AS rolls
    FROM rolls
    WHERE campaign_id = ${campaignId}::uuid AND deleted_at IS NULL
    GROUP BY 1
    ORDER BY 1`;
  return rows.map((r, i) => ({
    n: i + 1,
    date: r.day.toISOString().slice(0, 10),
    rolls: Number(r.rolls),
  }));
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

/** Per-subject stats; `actorName` holds the actor OR player name per `by`. */
export async function actorStats(
  campaignId: string,
  f: StatFilters = {},
  by: GroupBy = "actor",
): Promise<ActorStats[]> {
  const col = subjectCol(by);
  const rows = await prisma.$queryRaw<
    {
      subject: string;
      all_rolls: bigint;
      d20_rolls: bigint;
      nat20s: bigint;
      nat1s: bigint;
      avg_d20: number | null;
      damage: number | null;
      healing: number | null;
    }[]
  >`
    SELECT ${col}                                                              AS subject,
           COUNT(*)                                                            AS all_rolls,
           COUNT(*) FILTER (WHERE d20 IS NOT NULL)                             AS d20_rolls,
           COUNT(*) FILTER (WHERE is_nat20)                                    AS nat20s,
           COUNT(*) FILTER (WHERE is_nat1)                                     AS nat1s,
           AVG(d20)                                                            AS avg_d20,
           COALESCE(SUM(damage_total) FILTER (WHERE roll_type = 'damage'), 0)  AS damage,
           COALESCE(SUM(damage_total) FILTER (WHERE roll_type = 'healing'), 0) AS healing
    FROM rolls
    WHERE ${sqlFilters(campaignId, f)}
      AND ${col} IS NOT NULL AND ${col} <> ''
    GROUP BY ${col}
    ORDER BY all_rolls DESC`;
  return rows.map((r) => ({
    actorName: r.subject,
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

export type D20Bucket = {
  face: number;
  count: number;
  byName: { name: string; count: number }[];
};

/**
 * Full 1–20 histogram (zero-filled), with a per-subject breakdown for each
 * face so the tooltip can say who rolled what.
 */
export async function d20Histogram(
  campaignId: string,
  f: StatFilters = {},
  by: GroupBy = "actor",
): Promise<D20Bucket[]> {
  const col = subjectCol(by);
  const rows = await prisma.$queryRaw<{ d20: number; subject: string | null; count: bigint }[]>`
    SELECT d20, ${col} AS subject, COUNT(*) AS count
    FROM rolls
    WHERE ${sqlFilters(campaignId, f)} AND d20 IS NOT NULL
    GROUP BY 1, 2`;
  const buckets = Array.from({ length: 20 }, (_, i) => ({
    face: i + 1,
    count: 0,
    byName: [] as { name: string; count: number }[],
  }));
  for (const r of rows) {
    const b = buckets[r.d20 - 1];
    if (!b) continue;
    b.count += Number(r.count);
    b.byName.push({ name: r.subject ?? "—", count: Number(r.count) });
  }
  for (const b of buckets) b.byName.sort((x, y) => y.count - x.count);
  return buckets;
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

/** Subject × skill counts for the radar chart. */
export async function actorSkillMatrix(
  campaignId: string,
  f: StatFilters = {},
  by: GroupBy = "actor",
): Promise<SkillMatrix> {
  const col = subjectCol(by);
  const rows = await prisma.$queryRaw<{ subject: string; skill: string; count: bigint }[]>`
    SELECT ${col} AS subject, skill, COUNT(*) AS count
    FROM rolls
    WHERE ${sqlFilters(campaignId, f)}
      AND skill IS NOT NULL
      AND ${col} IS NOT NULL AND ${col} <> ''
    GROUP BY 1, 2`;
  const skills = [...new Set(rows.map((r) => r.skill))].sort();
  const byActor = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const m = byActor.get(r.subject) ?? new Map<string, number>();
    m.set(r.skill, Number(r.count));
    byActor.set(r.subject, m);
  }
  return {
    skills,
    actors: [...byActor.entries()].map(([name, m]) => ({
      name,
      counts: skills.map((s) => m.get(s) ?? 0),
    })),
  };
}

export type ItemUsage = {
  itemName: string;
  itemType: string | null;
  /** Distinct messages, so an attack (attack+damage rolls) counts once. */
  uses: number;
  damage: number;
  healing: number;
};

/** Weapons, spells, feats, consumables — what gets reached for. */
export async function itemUsage(
  campaignId: string,
  f: StatFilters = {},
  limit = 14,
): Promise<ItemUsage[]> {
  const rows = await prisma.$queryRaw<
    { item_name: string; item_type: string | null; uses: bigint; damage: number | null; healing: number | null }[]
  >`
    SELECT item_name,
           MIN(item_type)                                                      AS item_type,
           COUNT(DISTINCT message_id)                                          AS uses,
           COALESCE(SUM(damage_total) FILTER (WHERE roll_type = 'damage'), 0)  AS damage,
           COALESCE(SUM(damage_total) FILTER (WHERE roll_type = 'healing'), 0) AS healing
    FROM rolls
    WHERE ${sqlFilters(campaignId, f)}
      AND item_name IS NOT NULL AND item_name <> ''
    GROUP BY item_name
    ORDER BY uses DESC
    LIMIT ${limit}`;
  return rows.map((r) => ({
    itemName: r.item_name,
    itemType: r.item_type,
    uses: Number(r.uses),
    damage: Number(r.damage ?? 0),
    healing: Number(r.healing ?? 0),
  }));
}

export type ActorTop = { actorName: string; topSkill: string | null; topItem: string | null };

/** Each subject's most-rolled skill and most-used item. */
export async function actorTops(
  campaignId: string,
  f: StatFilters = {},
  by: GroupBy = "actor",
): Promise<ActorTop[]> {
  const col = subjectCol(by);
  const rows = await prisma.$queryRaw<
    { subject: string; top_skill: string | null; top_item: string | null }[]
  >`
    WITH skills AS (
      SELECT ${col} AS subject, skill,
             ROW_NUMBER() OVER (PARTITION BY ${col} ORDER BY COUNT(*) DESC) rn
      FROM rolls
      WHERE ${sqlFilters(campaignId, f)} AND skill IS NOT NULL AND ${col} IS NOT NULL
      GROUP BY ${col}, skill
    ), items AS (
      SELECT ${col} AS subject, item_name,
             ROW_NUMBER() OVER (PARTITION BY ${col} ORDER BY COUNT(DISTINCT message_id) DESC) rn
      FROM rolls
      WHERE ${sqlFilters(campaignId, f)} AND item_name IS NOT NULL AND item_name <> '' AND ${col} IS NOT NULL
      GROUP BY ${col}, item_name
    ), names AS (
      SELECT DISTINCT ${col} AS subject FROM rolls
      WHERE ${sqlFilters(campaignId, f)} AND ${col} IS NOT NULL AND ${col} <> ''
    )
    SELECT n.subject,
           s.skill      AS top_skill,
           i.item_name  AS top_item
    FROM names n
    LEFT JOIN skills s ON s.subject = n.subject AND s.rn = 1
    LEFT JOIN items i ON i.subject = n.subject AND i.rn = 1`;
  return rows.map((r) => ({
    actorName: r.subject,
    topSkill: r.top_skill,
    topItem: r.top_item,
  }));
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

export type MyCharacterRow = {
  actorId: string;
  campaignId: string;
  campaignName: string;
  name: string;
  image: string;
  stats: ActorStats;
};

/** All characters assigned to a user across every campaign, with their stats. */
export async function myCharacters(userId: string): Promise<MyCharacterRow[]> {
  const rows = await prisma.$queryRaw<
    {
      actor_id: string;
      campaign_id: string;
      campaign_name: string;
      name: string;
      image: string;
      all_rolls: bigint;
      d20_rolls: bigint;
      nat20s: bigint;
      nat1s: bigint;
      avg_d20: number | null;
      damage: number | null;
      healing: number | null;
    }[]
  >`
    SELECT a.id AS actor_id, a.campaign_id, c.name AS campaign_name, a.name, a.image,
           COUNT(r.*)                                                            AS all_rolls,
           COUNT(r.*) FILTER (WHERE r.d20 IS NOT NULL)                           AS d20_rolls,
           COUNT(r.*) FILTER (WHERE r.is_nat20)                                  AS nat20s,
           COUNT(r.*) FILTER (WHERE r.is_nat1)                                   AS nat1s,
           AVG(r.d20)                                                            AS avg_d20,
           COALESCE(SUM(r.damage_total) FILTER (WHERE r.roll_type = 'damage'), 0)  AS damage,
           COALESCE(SUM(r.damage_total) FILTER (WHERE r.roll_type = 'healing'), 0) AS healing
    FROM actors a
    JOIN campaigns c ON c.id = a.campaign_id
    LEFT JOIN rolls r
      ON r.campaign_id = a.campaign_id
     AND r.actor_fid = a.foundry_actor_id
     AND r.deleted_at IS NULL
    WHERE a.assigned_user_id = ${userId}
    GROUP BY a.id, a.campaign_id, c.name, a.name, a.image
    ORDER BY all_rolls DESC`;
  return rows.map((r) => ({
    actorId: r.actor_id,
    campaignId: r.campaign_id,
    campaignName: r.campaign_name,
    name: r.name,
    image: r.image,
    stats: {
      actorName: r.name,
      allRolls: Number(r.all_rolls),
      d20Rolls: Number(r.d20_rolls),
      nat20s: Number(r.nat20s),
      nat1s: Number(r.nat1s),
      avgD20: r.avg_d20 === null ? null : Number(r.avg_d20),
      damage: Number(r.damage ?? 0),
      healing: Number(r.healing ?? 0),
    },
  }));
}

export type RollLogRow = {
  id: string;
  rolledAt: Date;
  rollType: string;
  actorName: string | null;
  authorName: string | null;
  itemName: string | null;
  itemType: string | null;
  skill: string | null;
  ability: string | null;
  damageType: string | null;
  formula: string | null;
  total: number | null;
  dice: { f: number; r: number }[];
  modifier: number | null;
  dc: number | null;
  isNat20: boolean;
  isHidden: boolean;
  isNat1: boolean;
};

/** Newest-first roll stream for the log view. */
export async function rollLog(
  campaignId: string,
  f: StatFilters = {},
  take = 150,
): Promise<RollLogRow[]> {
  const rows = await prisma.roll.findMany({
    where: whereFilters(campaignId, f),
    orderBy: [{ rolledAt: "desc" }, { rollIndex: "asc" }],
    take,
    select: {
      id: true,
      rolledAt: true,
      rollType: true,
      actorName: true,
      authorName: true,
      itemName: true,
      itemType: true,
      skill: true,
      ability: true,
      damageType: true,
      formula: true,
      total: true,
      dice: true,
      modifier: true,
      dc: true,
      isNat20: true,
      isHidden: true,
      isNat1: true,
    },
  });
  return rows.map((r) => ({
    ...r,
    dice: Array.isArray(r.dice) ? (r.dice as { f: number; r: number }[]) : [],
  }));
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
