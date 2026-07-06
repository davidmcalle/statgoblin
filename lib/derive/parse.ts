// Pure payload → derived-row parsing. No DB access here — lib/derive/index.ts
// owns persistence. Bump PARSER_VERSION whenever classification or extraction
// changes; reprocess rebuilds campaigns whose derive_state lags.

export const PARSER_VERSION = 3;

type Term = {
  class?: string;
  faces?: number;
  results?: { result?: number; active?: boolean }[];
};

type RollJson = {
  class?: string;
  formula?: string;
  total?: number;
  options?: {
    rollType?: string;
    advantageMode?: number;
    type?: string;
    isCritical?: boolean;
    target?: number;
  };
  terms?: Term[];
};

/** One kept die: faces + result. Compact keys — stored as JSONB per roll. */
export type DieResult = { f: number; r: number };

type Payload = {
  messageCreatedAt?: string;
  author?: { name?: string; role?: string } | null;
  actor?: {
    id?: string;
    name?: string;
    image?: string;
    type?: string;
    cr?: number | null;
    token?: { id?: string; name?: string } | null;
  } | null;
  item?: { name?: string; type?: string; activity?: { type?: string } | null } | null;
  flags?: {
    core?: { initiativeRoll?: boolean };
    dnd5e?: { roll?: { type?: string; skillId?: string; ability?: string } };
    rollwatch?: { rollType?: string; ability?: string; profMultiplier?: number };
    "midi-qol"?: { isHit?: boolean; isCritical?: boolean; hitTargetUuids?: string[]; targets?: unknown[] };
  };
  rolls?: RollJson[];
};

export type ParsedRoll = {
  rollIndex: number;
  rollType: string;
  actorFid: string | null;
  actorName: string | null;
  actorType: string | null;
  tokenFid: string | null;
  tokenName: string | null;
  authorName: string | null;
  authorRole: string | null;
  itemName: string | null;
  itemType: string | null;
  activityType: string | null;
  formula: string | null;
  total: number | null;
  dice: DieResult[] | null;
  modifier: number | null;
  dc: number | null;
  d20: number | null;
  advantageState: number | null;
  isNat20: boolean;
  isNat1: boolean;
  isHit: boolean | null;
  isCritical: boolean | null;
  damageTotal: number | null;
  damageType: string | null;
  targetCount: number | null;
  ability: string | null;
  skill: string | null;
  profMultiplier: number | null;
  rolledAt: Date;
};

export type ParsedActor = {
  foundryActorId: string;
  name: string;
  image: string;
  actorType: string | null;
  cr: number | null;
};

/**
 * "character" | "npc". Events from module ≥0.2.1 carry actor.type; older
 * payloads fall back to a heuristic — GM-authored rolls are almost always
 * monsters/NPCs, player-authored ones their characters.
 */
function actorTypeOf(p: Payload): string | null {
  if (!p.actor?.id) return null;
  if (p.actor.type) return p.actor.type;
  return p.author?.role === "GAMEMASTER" ? "npc" : "character";
}

/**
 * Message-level classification, in trust order: our enricher flag (knows
 * concentration/recharge at roll time) → core initiative flag → dnd5e roll
 * flag → dnd5e activity type → usage (item, no rolls) → manual.
 */
function messageRollType(p: Payload, hasRolls: boolean): string {
  const enriched = p.flags?.rollwatch?.rollType;
  if (enriched) return enriched;
  if (p.flags?.core?.initiativeRoll) return "initiative";
  const dnd5e = p.flags?.dnd5e?.roll?.type;
  if (dnd5e) return dnd5e;
  const activity = p.item?.activity?.type;
  if (activity) return activity === "heal" ? "healing" : activity;
  if (!hasRolls && p.item) return "usage";
  return "manual";
}

/** Per-roll type where the roll declares one (midi-qol/dnd5e stamp options.rollType). */
function rollLevelType(roll: RollJson, fallback: string): string {
  const t = roll.options?.rollType;
  if (!t) return fallback;
  return t === "heal" ? "healing" : t;
}

function d20Of(roll: RollJson): { result: number | null } {
  for (const term of roll.terms ?? []) {
    if (term.faces === 20 && Array.isArray(term.results)) {
      const active = term.results.find((r) => r.active);
      if (typeof active?.result === "number") return { result: active.result };
    }
  }
  return { result: null };
}

/** All kept (active) dice in the roll, in term order. */
function diceOf(roll: RollJson): DieResult[] {
  const out: DieResult[] = [];
  for (const term of roll.terms ?? []) {
    if (typeof term.faces !== "number" || !Array.isArray(term.results)) continue;
    for (const res of term.results) {
      if (res.active && typeof res.result === "number") out.push({ f: term.faces, r: res.result });
    }
  }
  return out;
}

const DAMAGE_TYPES = new Set(["damage", "healing"]);

/** All derived rolls for one message payload; empty array for null payload. */
export function parseRolls(payload: unknown, fallbackTime: Date): ParsedRoll[] {
  const p = (payload ?? {}) as Payload;
  const rolls = Array.isArray(p.rolls) ? p.rolls : [];
  const rolledAt = p.messageCreatedAt ? new Date(p.messageCreatedAt) : fallbackTime;
  const msgType = messageRollType(p, rolls.length > 0);
  const midi = p.flags?.["midi-qol"];
  const targetCount = midi?.hitTargetUuids?.length ?? midi?.targets?.length ?? null;

  const base = {
    actorFid: p.actor?.id ?? null,
    actorName: p.actor?.name ?? null,
    actorType: actorTypeOf(p),
    tokenFid: p.actor?.token?.id ?? null,
    tokenName: p.actor?.token?.name ?? null,
    authorName: p.author?.name ?? null,
    authorRole: p.author?.role ?? null,
    itemName: p.item?.name ?? null,
    itemType: p.item?.type ?? null,
    activityType: p.item?.activity?.type ?? null,
    ability: p.flags?.rollwatch?.ability ?? p.flags?.dnd5e?.roll?.ability ?? null,
    skill: p.flags?.dnd5e?.roll && "skillId" in p.flags.dnd5e.roll
      ? (p.flags.dnd5e.roll.skillId ?? null)
      : null,
    profMultiplier: p.flags?.rollwatch?.profMultiplier ?? null,
    rolledAt,
  };

  // Roll-less usage card → single synthetic row so ability uses still chart.
  if (rolls.length === 0) {
    if (!p.item) return [];
    return [
      {
        ...base,
        rollIndex: 0,
        rollType: "usage",
        formula: null,
        total: null,
        dice: null,
        modifier: null,
        dc: null,
        d20: null,
        advantageState: null,
        isNat20: false,
        isNat1: false,
        isHit: null,
        isCritical: null,
        damageTotal: null,
        damageType: null,
        targetCount,
      },
    ];
  }

  // The enricher's rollType (concentration/recharge) is resolved at roll time
  // and outranks the per-roll options.rollType (which says plain "save").
  const enriched = p.flags?.rollwatch?.rollType;

  return rolls.map((roll, rollIndex) => {
    const rollType = enriched ?? rollLevelType(roll, msgType);
    const isDamage = DAMAGE_TYPES.has(rollType);
    const { result: d20 } = d20Of(roll);
    const isD20Roll = !isDamage && d20 !== null;
    const dice = diceOf(roll);
    const total = typeof roll.total === "number" ? roll.total : null;
    const diceSum = dice.reduce((n, die) => n + die.r, 0);
    return {
      ...base,
      rollIndex,
      rollType,
      formula: roll.formula ?? null,
      total,
      dice: dice.length > 0 ? dice : null,
      modifier: total !== null && dice.length > 0 ? total - diceSum : null,
      dc: typeof roll.options?.target === "number" ? roll.options.target : null,
      d20: isD20Roll ? d20 : null,
      advantageState: isD20Roll ? (roll.options?.advantageMode ?? 0) : null,
      isNat20: isD20Roll && d20 === 20,
      isNat1: isD20Roll && d20 === 1,
      isHit: rollType === "attack" ? (midi?.isHit ?? null) : null,
      isCritical: rollType === "attack"
        ? (midi?.isCritical ?? null)
        : (roll.options?.isCritical ?? null),
      damageTotal: isDamage ? (typeof roll.total === "number" ? roll.total : null) : null,
      damageType: isDamage ? (roll.options?.type ?? null) : null,
      targetCount,
    };
  });
}

/** The actor behind the message, for auto-discovery. Null when actorless. */
export function parseActor(payload: unknown): ParsedActor | null {
  const p = (payload ?? {}) as Payload;
  if (!p.actor?.id) return null;
  return {
    foundryActorId: p.actor.id,
    name: p.actor.name ?? "",
    image: p.actor.image ?? "",
    actorType: actorTypeOf(p),
    cr: typeof p.actor.cr === "number" ? p.actor.cr : null,
  };
}
