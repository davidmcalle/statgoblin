import { prisma } from "@/lib/db/prisma";
import { sessionDayFrom } from "@/lib/session-day";
import { ABILITY_NAMES, SKILL_NAMES } from "@/lib/dnd5e-meta";
import {
  actorStats,
  campaignTotals,
  itemUsage,
  type ActorStats,
  type SessionInfo,
} from "@/lib/stats";

// Session-summary generation for Discord: deterministic awards and notable
// rolls straight from the data, cached in session_summaries so resends are
// free. Pure stats — no generated prose.

export type Award = {
  key: string;
  title: string;
  actorName: string;
  statLine: string;
};

export type NotableRoll = {
  actorName: string;
  total: number;
  d20: number;
  label: string;
};

export type SummaryPayload = {
  version: 1;
  sessions: SessionInfo[];
  totals: {
    totalRolls: number;
    nat20s: number;
    nat1s: number;
    avgD20: number | null;
    highest: { total: number; actorName: string | null } | null;
  };
  awards: Award[];
  notables?: {
    best: NotableRoll[];
    worst: NotableRoll[];
    biggestHit: { actorName: string; damage: number; itemName: string | null; damageType: string | null } | null;
  };
  generatedAt: string;
};

export function datesKeyOf(dates: string[]): string {
  return [...dates].sort().join(",");
}

/** Deterministic awards computed from the roll data. */
function computeAwards(stats: ActorStats[], diversity: Map<string, number>): Award[] {
  const awards: Award[] = [];
  const qualified = stats.filter((s) => s.d20Rolls >= 3);

  const highest = [...qualified].sort((a, b) => (b.avgD20 ?? 0) - (a.avgD20 ?? 0))[0];
  if (highest?.avgD20 != null) {
    awards.push({
      key: "highest_roller",
      title: "Highest Roller",
      actorName: highest.actorName,
      statLine: `avg d20 ${highest.avgD20.toFixed(1)} over ${highest.d20Rolls} rolls`,
    });
  }

  const lowest = [...qualified].sort((a, b) => (a.avgD20 ?? 21) - (b.avgD20 ?? 21))[0];
  if (lowest?.avgD20 != null && lowest.actorName !== highest?.actorName) {
    awards.push({
      key: "cursed_dice",
      title: "Cursed Dice",
      actorName: lowest.actorName,
      statLine: `avg d20 ${lowest.avgD20.toFixed(1)} over ${lowest.d20Rolls} rolls`,
    });
  }

  const bruiser = [...stats].sort((a, b) => b.damage - a.damage)[0];
  if (bruiser && bruiser.damage > 0) {
    awards.push({
      key: "top_damage",
      title: "Top Damage",
      actorName: bruiser.actorName,
      statLine: `${bruiser.damage} damage dealt`,
    });
  }

  const medic = [...stats].sort((a, b) => b.healing - a.healing)[0];
  if (medic && medic.healing > 0) {
    awards.push({
      key: "field_medic",
      title: "Field Medic",
      actorName: medic.actorName,
      statLine: `${medic.healing} healing done`,
    });
  }

  const diverse = [...diversity.entries()].sort((a, b) => b[1] - a[1])[0];
  if (diverse && diverse[1] >= 4) {
    awards.push({
      key: "most_diverse",
      title: "Jack of All Trades",
      actorName: diverse[0],
      statLine: `${diverse[1]} different kinds of roll`,
    });
  }

  const workhorse = [...stats].sort((a, b) => b.allRolls - a.allRolls)[0];
  if (workhorse) {
    awards.push({
      key: "workhorse",
      title: "Busiest Dice",
      actorName: workhorse.actorName,
      statLine: `${workhorse.allRolls} rolls`,
    });
  }

  // One award per character where possible: keep first occurrence order,
  // drop duplicates beyond two mentions of the same actor.
  const counts = new Map<string, number>();
  return awards.filter((a) => {
    const n = counts.get(a.actorName) ?? 0;
    counts.set(a.actorName, n + 1);
    return n < 2;
  });
}

/** What a d20 roll was for, in words: "Stealth check", "Longbow attack"… */
function rollLabel(r: {
  rollType: string;
  skill: string | null;
  ability: string | null;
  itemName: string | null;
}): string {
  if (r.skill) return `${SKILL_NAMES[r.skill] ?? r.skill} check`;
  if (r.rollType === "save") return `${r.ability ? (ABILITY_NAMES[r.ability] ?? r.ability) + " " : ""}save`;
  if (r.rollType === "attack") return r.itemName ? `${r.itemName} attack` : "attack";
  if (r.rollType === "ability") return `${r.ability ? (ABILITY_NAMES[r.ability] ?? r.ability) + " " : ""}check`;
  if (r.rollType === "initiative") return "initiative";
  if (r.rollType === "death") return "death save";
  if (r.rollType === "concentration") return "concentration save";
  return r.rollType;
}

/** The session's top d20 rolls and the single biggest damage hit. */
async function notableRolls(campaignId: string, dates: string[]) {
  const base = {
    campaignId,
    deletedAt: null,
    isHidden: false,
    actorName: { not: null },
    sessionDate: { in: dates.map(sessionDayFrom) },
  };
  const [top, low, hit] = await Promise.all([
    prisma.roll.findMany({
      where: { ...base, d20: { not: null }, total: { not: null } },
      orderBy: { total: "desc" },
      take: 5,
      select: { actorName: true, total: true, d20: true, rollType: true, skill: true, ability: true, itemName: true },
    }),
    prisma.roll.findMany({
      where: { ...base, d20: { not: null }, total: { not: null } },
      orderBy: { total: "asc" },
      take: 3,
      select: { actorName: true, total: true, d20: true, rollType: true, skill: true, ability: true, itemName: true },
    }),
    prisma.roll.findFirst({
      where: { ...base, rollType: "damage", damageTotal: { not: null } },
      orderBy: { damageTotal: "desc" },
      select: { actorName: true, damageTotal: true, itemName: true, damageType: true },
    }),
  ]);
  const shape = (r: (typeof top)[number]): NotableRoll => ({
    actorName: r.actorName!,
    total: r.total!,
    d20: r.d20!,
    label: rollLabel(r),
  });
  return {
    best: top.map(shape),
    worst: low.map(shape),
    biggestHit: hit
      ? {
          actorName: hit.actorName!,
          damage: hit.damageTotal!,
          itemName: hit.itemName,
          damageType: hit.damageType,
        }
      : null,
  };
}

/** Distinct roll variety (types + skills) per actor for the diversity award. */
async function rollDiversity(campaignId: string, dates: string[]): Promise<Map<string, number>> {
  const rows = await prisma.roll.findMany({
    where: {
      campaignId,
      deletedAt: null,
      isHidden: false,
      actorName: { not: null },
      sessionDate: { in: dates.map(sessionDayFrom) },
    },
    select: { actorName: true, rollType: true, skill: true },
  });
  const sets = new Map<string, Set<string>>();
  for (const r of rows) {
    const set = sets.get(r.actorName!) ?? new Set<string>();
    set.add(r.skill ? `skill:${r.skill}` : r.rollType);
    sets.set(r.actorName!, set);
  }
  return new Map([...sets.entries()].map(([name, set]) => [name, set.size]));
}

/** Build (or fetch cached) summary payload for the picked sessions. */
export async function getOrCreateSummary(
  campaignId: string,
  picked: SessionInfo[],
  regenerate = false,
): Promise<{ payload: SummaryPayload; cached: boolean }> {
  const dates = picked.map((s) => s.date);
  const key = datesKeyOf(dates);
  if (regenerate) {
    await prisma.sessionSummary.deleteMany({
      where: { campaignId, datesKey: key },
    });
  } else {
    const existing = await prisma.sessionSummary.findUnique({
      where: { campaignId_datesKey: { campaignId, datesKey: key } },
    });
    if (existing) return { payload: existing.payload as SummaryPayload, cached: true };
  }

  const filters = { dates, includeHidden: false };
  const [totals, stats, diversity, notables] = await Promise.all([
    campaignTotals(campaignId, filters),
    actorStats(campaignId, filters),
    rollDiversity(campaignId, dates),
    notableRolls(campaignId, dates),
  ]);
  // itemUsage keeps "most used" available to future panels; not stored today.
  await itemUsage(campaignId, filters, 5);

  const awards = computeAwards(stats, diversity);
  // Enrich award stat lines with concrete detail from the notable rolls.
  const bestOf = new Map<string, NotableRoll>();
  for (const n of notables.best) if (!bestOf.has(n.actorName)) bestOf.set(n.actorName, n);
  for (const award of awards) {
    if (award.key === "highest_roller") {
      const best = bestOf.get(award.actorName);
      if (best) award.statLine += ` · best: ${best.total} on a ${best.label}`;
    }
    if (award.key === "top_damage" && notables.biggestHit?.actorName === award.actorName) {
      const hit = notables.biggestHit;
      award.statLine += ` · biggest hit: ${hit.damage}${hit.itemName ? ` with ${hit.itemName}` : ""}`;
    }
  }

  const payload: SummaryPayload = {
    version: 1,
    sessions: picked,
    totals: {
      totalRolls: totals.totalRolls,
      nat20s: totals.nat20s,
      nat1s: totals.nat1s,
      avgD20: totals.avgD20,
      highest: totals.highest
        ? { total: totals.highest.total, actorName: totals.highest.actorName }
        : null,
    },
    awards,
    notables,
    generatedAt: new Date().toISOString(),
  };

  await prisma.sessionSummary.create({
    data: { campaignId, datesKey: key, payload },
  });
  return { payload, cached: false };
}
