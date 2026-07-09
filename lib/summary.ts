import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { sessionDayFrom } from "@/lib/session-day";
import { effectiveKind } from "@/lib/kind";
import { ABILITY_NAMES, SKILL_NAMES } from "@/lib/dnd5e-meta";
import {
  actorStats,
  campaignTotals,
  itemUsage,
  recentDeathSaves,
  type ActorStats,
  type SessionInfo,
} from "@/lib/stats";

// Session-summary generation for Discord: deterministic awards from the roll
// data, an optional Claude-written narrative + per-award commentary on top,
// and the whole result cached in session_summaries so resends are free.

export type Speaker = "zog" | "zaela";

export type DialogueLine = { speaker: Speaker; line: string };

export const SPEAKER_NAMES: Record<Speaker, string> = { zog: "Zog", zaela: "Zaela" };

export type Award = {
  key: string;
  title: string;
  actorName: string;
  statLine: string;
  comment?: string;
  commentBy?: Speaker;
  kind?: "pc" | "npc" | "monster";
};

/** Named-count pairs: "Fireball ×3", "Sneak Attack ×5", "Stealth ×4"… */
type Tally = { name: string; count: number };

export type CharacterDetail = {
  name: string;
  kind: "pc" | "npc" | "monster";
  cr: number | null;
  rolls: number;
  avgD20: number | null;
  nat20s: number;
  nat1s: number;
  damageDealt: number;
  healingDone: number;
  attacks: Tally[];
  spells: Tally[];
  features: Tally[];
  skills: Tally[];
  saves: number;
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
  /** Legacy single-voice recap (payloads generated before the duo). */
  narrative: string | null;
  /** The Zog & Zaela exchange — the recap body from v2 payloads on. */
  dialogue?: DialogueLine[];
  highlights?: (string | DialogueLine)[];
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

/** Deterministic awards — the LLM only writes flavor on top of these. */
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

export type NotableRoll = {
  actorName: string;
  total: number;
  d20: number;
  label: string;
};

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

/**
 * Per-character loadout breakdown for the picked sessions: which weapons
 * attacked, which spells were cast, which features fired, which skills got
 * rolled — the material the narrative needs to notice "the cleric healed"
 * or "the rogue sneak-attacked all night".
 */
async function characterDetails(
  campaignId: string,
  dates: string[],
  stats: ActorStats[],
): Promise<CharacterDetail[]> {
  const [rows, actors] = await Promise.all([
    prisma.roll.groupBy({
      by: ["actorName", "rollType", "itemName", "itemType", "skill"],
      where: {
        campaignId,
        deletedAt: null,
        isHidden: false,
        actorName: { not: null },
        sessionDate: { in: dates.map(sessionDayFrom) },
      },
      _count: { _all: true },
    }),
    prisma.actor.findMany({
      where: { campaignId },
      select: { name: true, actorType: true, kindOverride: true, assignedUserId: true, cr: true },
    }),
  ]);

  const kindOf = new Map(
    actors.map((a) => [a.name, { kind: effectiveKind(a), cr: a.cr }] as const),
  );

  const detail = new Map<string, CharacterDetail>();
  const statByName = new Map(stats.map((s) => [s.actorName, s]));
  const bump = (list: Tally[], name: string, count: number) => {
    const hit = list.find((t) => t.name === name);
    if (hit) hit.count += count;
    else list.push({ name, count });
  };

  for (const row of rows) {
    const name = row.actorName!;
    let d = detail.get(name);
    if (!d) {
      const s = statByName.get(name);
      const meta = kindOf.get(name);
      d = {
        name,
        kind: meta?.kind ?? "monster",
        cr: meta?.cr ?? null,
        rolls: s?.allRolls ?? 0,
        avgD20: s?.avgD20 ?? null,
        nat20s: s?.nat20s ?? 0,
        nat1s: s?.nat1s ?? 0,
        damageDealt: s?.damage ?? 0,
        healingDone: s?.healing ?? 0,
        attacks: [],
        spells: [],
        features: [],
        skills: [],
        saves: 0,
      };
      detail.set(name, d);
    }
    const n = row._count._all;
    if (row.rollType === "attack" && row.itemName) bump(d.attacks, row.itemName, n);
    else if (row.rollType === "usage" && row.itemType === "spell" && row.itemName)
      bump(d.spells, row.itemName, n);
    else if (row.rollType === "usage" && row.itemType === "feat" && row.itemName)
      bump(d.features, row.itemName, n);
    else if (row.rollType === "skill" && row.skill)
      bump(d.skills, SKILL_NAMES[row.skill] ?? row.skill, n);
    else if (row.rollType === "save" || row.rollType === "concentration") d.saves += n;
  }

  const sortTallies = (d: CharacterDetail) => {
    for (const list of [d.attacks, d.spells, d.features, d.skills]) {
      list.sort((a, b) => b.count - a.count);
    }
  };
  const all = [...detail.values()];
  all.forEach(sortTallies);
  return all.sort((a, b) => b.rolls - a.rolls);
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

const speakerSchema = z.enum(["zog", "zaela"]);

const narrativeSchema = z.object({
  dialogue: z
    .array(
      z.object({
        speaker: speakerSchema,
        line: z.string().describe("One natural spoken line — no stage directions"),
      }),
    )
    .describe(
      "6-12 lines of natural back-and-forth between Zog and Zaela recapping the session's " +
        "dice — a real conversation, not alternating monologues. They interrupt, disagree, " +
        "and pick up threads from their previous recaps.",
    ),
  awardComments: z
    .array(
      z.object({
        key: z.string().describe("The award key this comment belongs to"),
        speaker: speakerSchema.describe("Who delivers it"),
        comment: z.string().describe("One punchy in-character line for this award"),
      }),
    )
    .describe("One comment per award, matched by key — split them between the two speakers"),
  highlights: z
    .array(z.object({ speaker: speakerSchema, line: z.string() }))
    .describe(
      "2-4 extra observations about the dice the awards missed — a crit drought, a flood of " +
        "nat 1s, someone hogging the healing, a suspiciously fair d20. One line each, in " +
        "character for whoever says it.",
    ),
});

/**
 * Claude narrative over the stat packet. Character names only — no emails or
 * account ids ever enter the prompt. Absent API key or any failure returns
 * null and the caller falls back to the plain stat summary.
 */
/**
 * Compact banter history from earlier summaries, so Zog and Zaela pick up
 * where they left off — running opinions on characters, callbacks, grudges.
 */
async function previousBanter(campaignId: string, excludeKey: string) {
  const prior = await prisma.sessionSummary.findMany({
    where: { campaignId, datesKey: { not: excludeKey } },
    orderBy: { createdAt: "desc" },
    take: 3,
  });
  return prior
    .map((row) => {
      const p = row.payload as SummaryPayload;
      const label =
        p.sessions?.length === 1 ? `Session ${p.sessions[0].n}` : `Sessions ${p.sessions?.map((s) => s.n).join(", ")}`;
      const lines = p.dialogue
        ? p.dialogue.map((l) => `${SPEAKER_NAMES[l.speaker]}: ${l.line}`).join("\n")
        : (p.narrative ?? "");
      return lines ? `— ${label} —\n${lines}` : null;
    })
    .filter((s): s is string => !!s)
    .reverse()
    .join("\n\n")
    .slice(0, 6000);
}

async function generateNarrative(
  campaignName: string,
  sessions: SessionInfo[],
  totals: SummaryPayload["totals"],
  characters: CharacterDetail[],
  awards: Award[],
  items: { itemName: string; uses: number }[],
  notables: NonNullable<SummaryPayload["notables"]>,
  banterHistory: string,
): Promise<{
  dialogue: DialogueLine[];
  comments: Map<string, { speaker: Speaker; comment: string }>;
  highlights: DialogueLine[];
} | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "change-me") return null;
  try {
    const client = new Anthropic();
    const packet = {
      campaign: campaignName,
      sessions: sessions.map((s) => ({ n: s.n, date: s.date, rolls: s.rolls })),
      totals,
      party: characters.filter((c) => c.kind === "pc"),
      friendlyNpcs: characters.filter((c) => c.kind === "npc"),
      monsters: characters.filter((c) => c.kind === "monster"),
      awards: awards.map(({ key, title, actorName, statLine, kind }) => ({
        key,
        title,
        actorName,
        statLine,
        side: kind ?? "pc",
      })),
      favouriteItems: items.slice(0, 5),
      bestRolls: notables.best,
      worstRolls: notables.worst,
      biggestHit: notables.biggestHit,
      previousRecaps: banterHistory || "(none yet — this is their first recap together)",
    };
    const response = await client.messages.parse({
      model: "claude-opus-4-8",
      max_tokens: 3000,
      thinking: { type: "adaptive" },
      system:
        "You write the double act that recaps a D&D group's dice statistics on Discord: " +
        "ZOG, a filthy drunk goblin, and ZAELA, an elf cleric — regulars at the same tavern " +
        "table, bickering their way through the party's results.\n\n" +
        "Zog: crass, crude, vulgar, loud. This is an adult table and they've asked for it — " +
        "he swears hard and often (piss, shit, shag, whatever serves the heckle); nothing is " +
        "too vulgar for him. He mocks failures viciously and toasts wins grudgingly.\n" +
        "Zaela: fun, kind, polite — she defends the party, celebrates their wins, scolds Zog " +
        "(\"Hey now Zog!\", \"you miserable sod\") without ever matching his filth. She's " +
        "warm but not soppy, and she's allowed to be funny.\n\n" +
        "They COUNTER each other — a real conversation with interruptions, comebacks and " +
        "running jokes, not two monologues. Example register:\n" +
        "Zog: \"Another shitshow from Maeple, useless as always.\"\n" +
        "Zaela: \"Hey now Zog! She's not that bad you miserable sod — did you not see the " +
        "damage she did? Much better than last week.\"\n\n" +
        "`previousRecaps` holds their earlier conversations about this campaign. Continue " +
        "that relationship: keep running opinions on characters, call back to past sessions " +
        "(\"better than last week\"), hold grudges, concede points. If it's empty, just start " +
        "the double act.\n\n" +
        "Sides matter: `party` are the heroes, `monsters` the opposition — monster damage is " +
        "damage the party TOOK; never narrate a monster as a team player. `friendlyNpcs` are " +
        "allies. A monster's name usually says what it is — use that flavour. Read the " +
        "loadouts (attacks by weapon, spells, features, skills, saves — all with counts) and " +
        "infer playstyle: healing stacks read cleric, Sneak Attack reads rogue, bow plus " +
        "nature-y skills reads ranger. Weave real names and counts in. Notice the shape of " +
        "the luck: crit droughts, nat-1 floods, suspiciously average d20s.\n\n" +
        "Talk about characters in the third person. Do not invent story events — you only " +
        "know what the dice did. Session numbers only mark when roll-tracking started, not " +
        "campaign age — never call anything a debut or a young campaign. British English.",
      messages: [
        {
          role: "user",
          content: `Write the recap dialogue, one comment per award, and the highlights for this data:\n${JSON.stringify(packet)}`,
        },
      ],
      output_config: { format: zodOutputFormat(narrativeSchema) },
    });
    const parsed = response.parsed_output;
    if (!parsed) return null;
    return {
      dialogue: parsed.dialogue,
      comments: new Map(
        parsed.awardComments.map((c) => [c.key, { speaker: c.speaker, comment: c.comment }]),
      ),
      highlights: parsed.highlights,
    };
  } catch (error) {
    // The banter is garnish — never block the summary on the LLM. But say why.
    console.error("summary narrative generation failed:", error);
    return null;
  }
}

/**
 * Uniform view over old and new payloads: pre-duo summaries carried a plain
 * narrative string and string highlights; those render as Zog solo.
 */
export function recapLines(payload: SummaryPayload): {
  dialogue: DialogueLine[];
  highlights: DialogueLine[];
} {
  const dialogue =
    payload.dialogue ??
    (payload.narrative
      ? payload.narrative
          .split(/\n{2,}/)
          .filter(Boolean)
          .map((line) => ({ speaker: "zog" as const, line }))
      : []);
  const highlights = (payload.highlights ?? []).map((h) =>
    typeof h === "string" ? { speaker: "zog" as const, line: h } : h,
  );
  return { dialogue, highlights };
}

/** Whether narrative generation is available at all. */
export function llmConfigured(): boolean {
  const key = process.env.ANTHROPIC_API_KEY;
  return !!key && key !== "change-me";
}

/** Build (or fetch cached) summary payload for the picked sessions. */
export async function getOrCreateSummary(
  campaignId: string,
  campaignName: string,
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
  const [totals, stats, items, diversity, notables] = await Promise.all([
    campaignTotals(campaignId, filters),
    actorStats(campaignId, filters),
    itemUsage(campaignId, filters, 5),
    rollDiversity(campaignId, dates),
    notableRolls(campaignId, dates),
  ]);
  const characters = await characterDetails(campaignId, dates, stats);
  // Death saves already excluded for players via includeHidden: false.
  await recentDeathSaves(campaignId, filters, 6);

  const awards = computeAwards(stats, diversity);
  const kindByName = new Map(characters.map((c) => [c.name, c.kind]));
  for (const award of awards) award.kind = kindByName.get(award.actorName) ?? "monster";
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
  const slimTotals = {
    totalRolls: totals.totalRolls,
    nat20s: totals.nat20s,
    nat1s: totals.nat1s,
    avgD20: totals.avgD20,
    highest: totals.highest
      ? { total: totals.highest.total, actorName: totals.highest.actorName }
      : null,
  };

  const banterHistory = await previousBanter(campaignId, key);
  const llm = await generateNarrative(
    campaignName,
    picked,
    slimTotals,
    characters,
    awards,
    items,
    notables,
    banterHistory,
  );
  if (llm) {
    for (const award of awards) {
      const c = llm.comments.get(award.key);
      if (c) {
        award.comment = c.comment;
        award.commentBy = c.speaker;
      }
    }
  }

  const payload: SummaryPayload = {
    version: 1,
    sessions: picked,
    totals: slimTotals,
    awards,
    narrative: null,
    dialogue: llm?.dialogue ?? undefined,
    highlights: llm?.highlights ?? [],
    notables,
    generatedAt: new Date().toISOString(),
  };

  await prisma.sessionSummary.create({
    data: { campaignId, datesKey: key, payload },
  });
  return { payload, cached: false };
}
