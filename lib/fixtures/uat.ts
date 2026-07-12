import { SKILL_ABILITY } from "@/lib/dnd5e-meta";
import { sessionDayFrom, sessionDayOf } from "@/lib/session-day";
import { analyzeGroupRolls, type GroupRollReport } from "@/lib/group-rolls";
import type { ActorKind } from "@/lib/kind";
import type {
  ActorStats,
  ActorTop,
  CampaignTotals,
  D20Bucket,
  DeathSaveRow,
  GroupBy,
  ItemUsage,
  RollLogRow,
  RollTypeCount,
  SessionInfo,
  SkillAbilityBucket,
  SkillMatrix,
  StatFilters,
} from "@/lib/stats";

// Dev-only UAT dataset: a believable campaign generated from a seeded PRNG,
// with every aggregate the dashboard needs computed in memory. Never touches
// the database — /dev/uat renders the real components against this instead,
// so layout work can be verified without live rolls.

export type FixtureRoll = RollLogRow & {
  messageId: string;
  kind: ActorKind;
  advantageState: number | null;
};

export type FixtureActor = {
  actorId: string;
  fid: string;
  name: string;
  image: string;
  kind: ActorKind;
  actorType: string | null;
  cr: number | null;
  assignedUserId: string | null;
  player: string | null;
};

export const UAT_MEMBERS = [
  { userId: "uat_gm", name: "Dana", role: "gm" },
  { userId: "uat_p1", name: "Jake", role: "player" },
  { userId: "uat_p2", name: "Mia", role: "player" },
  { userId: "uat_p3", name: "Tom", role: "player" },
  { userId: "uat_p4", name: "Priya", role: "player" },
];

export const UAT_ACTORS: FixtureActor[] = [
  pc("Maeple Morningsong", "uat_p1", "Jake"),
  pc("Damien Blackwood", "uat_p2", "Mia"),
  pc("Thorin Ironfist", "uat_p3", "Tom"),
  pc("Zephyra Nightwind", "uat_p4", "Priya"),
  pc("Bramble Tosscobble", null, null),
  monster("Giant Spider", 1),
  monster("Nezznar the Spider", 8),
  monster("Bugbear Chief", 3),
  monster("Doppelganger", 3),
  npc("Sildar Hallwinter"),
];

function pc(name: string, userId: string | null, player: string | null): FixtureActor {
  return {
    actorId: `uat-actor-${slug(name)}`,
    fid: `uatfid${slug(name)}`,
    name,
    image: "",
    kind: "pc",
    actorType: "character",
    cr: null,
    assignedUserId: userId,
    player,
  };
}

function monster(name: string, cr: number): FixtureActor {
  return {
    actorId: `uat-actor-${slug(name)}`,
    fid: `uatfid${slug(name)}`,
    name,
    image: "",
    kind: "monster",
    actorType: "npc",
    cr,
    assignedUserId: null,
    player: null,
  };
}

function npc(name: string): FixtureActor {
  return { ...monster(name, 1), kind: "npc" };
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

// ---------------------------------------------------------------------------
// Generation

/** mulberry32 — tiny seeded PRNG so the dataset is identical every render. */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SESSION_DATES = ["2026-06-14", "2026-06-21", "2026-06-28", "2026-07-05"];

const WEAPONS: Record<string, string> = {
  "Maeple Morningsong": "Longbow",
  "Damien Blackwood": "Greatsword",
  "Thorin Ironfist": "Warhammer",
  "Zephyra Nightwind": "Shortsword",
  "Bramble Tosscobble": "Sling",
  "Giant Spider": "Bite",
  "Nezznar the Spider": "Iron Staff",
  "Bugbear Chief": "Morningstar",
  "Doppelganger": "Slam",
  "Sildar Hallwinter": "Longsword",
};

const FEATURES: Record<string, string[]> = {
  "Maeple Morningsong": ["Tactical Mind", "Second Wind"],
  "Damien Blackwood": ["Action Surge", "Second Wind"],
  "Thorin Ironfist": ["Divine Sense", "Lay on Hands"],
  "Zephyra Nightwind": ["Sneak Attack", "Cunning Action"],
  "Bramble Tosscobble": ["Lucky", "Halfling Nimbleness"],
  "Giant Spider": ["Spider Climb", "Web Walker"],
  "Nezznar the Spider": ["Spider Climb", "Fey Ancestry"],
  "Bugbear Chief": ["Brute", "Surprise Attack"],
  "Doppelganger": ["Shapechanger", "Ambusher"],
  "Sildar Hallwinter": ["Second Wind"],
};

const SPELLS: Record<string, string[]> = {
  "Thorin Ironfist": ["Cure Wounds", "Bless"],
  "Zephyra Nightwind": ["Minor Illusion"],
  "Nezznar the Spider": ["Web", "Lightning Bolt"],
};

const SKILLS = Object.keys(SKILL_ABILITY);
const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
const DAMAGE_TYPES = ["slashing", "piercing", "bludgeoning", "poison", "fire", "lightning"];

function d(rand: () => number, faces: number): number {
  return 1 + Math.floor(rand() * faces);
}

function buildRolls(): FixtureRoll[] {
  const rand = rng(20260705);
  const rolls: FixtureRoll[] = [];
  let id = 0;
  let msg = 0;

  const push = (
    base: Partial<FixtureRoll> & { rollType: string; actor: FixtureActor; when: Date },
    sharedMsg?: string,
  ): string => {
    const messageId = sharedMsg ?? `uat-msg-${++msg}`;
    const { actor, when, ...rest } = base;
    rolls.push({
      id: `uat-roll-${++id}`,
      rolledAt: when,
      sessionDate: sessionDayOf(when),
      actorName: actor.name,
      actorFid: actor.fid,
      authorName: actor.player ?? "Dana",
      itemName: null,
      itemType: null,
      skill: null,
      ability: null,
      damageType: null,
      formula: null,
      total: null,
      dice: [],
      modifier: null,
      dc: null,
      isNat20: false,
      isNat1: false,
      isHidden: false,
      advantageState: null,
      messageId,
      kind: actor.kind,
      ...rest,
    } as FixtureRoll);
    return messageId;
  };

  const d20Roll = (mod: number) => {
    const r = d(rand, 20);
    return {
      d20: r,
      dice: [{ f: 20, r }],
      modifier: mod,
      total: r + mod,
      isNat20: r === 20,
      isNat1: r === 1,
    };
  };

  for (const [s, date] of SESSION_DATES.entries()) {
    const at = (h: number, m: number) => new Date(`${date}T${pad(h)}:${pad(m)}:00Z`);
    let minute = 0;
    const clock = () => {
      minute += 1 + Math.floor(rand() * 4);
      return at(18 + Math.floor(minute / 60), minute % 60);
    };

    for (const actor of UAT_ACTORS) {
      // Monsters skip sessions they weren't in.
      if (actor.kind !== "pc" && rand() < 0.4) continue;
      const activity = actor.kind === "pc" ? 14 + Math.floor(rand() * 8) : 6 + Math.floor(rand() * 6);

      for (let i = 0; i < activity; i++) {
        const when = clock();
        const pick = rand();
        const mod = 2 + Math.floor(rand() * 5);

        if (pick < 0.3) {
          // Skill check
          const skill = SKILLS[Math.floor(rand() * SKILLS.length)];
          push({
            rollType: "skill",
            actor,
            when,
            skill,
            ability: SKILL_ABILITY[skill],
            dc: rand() < 0.5 ? 10 + Math.floor(rand() * 8) : null,
            ...d20Roll(mod),
          });
        } else if (pick < 0.38) {
          // Bare ability check or save
          const save = rand() < 0.5;
          push({
            rollType: save ? "save" : "ability",
            actor,
            when,
            ability: ABILITIES[Math.floor(rand() * ABILITIES.length)],
            dc: save ? 10 + Math.floor(rand() * 8) : null,
            ...d20Roll(mod),
          });
        } else if (pick < 0.62) {
          // Attack + damage in one message
          const weapon = WEAPONS[actor.name];
          const m = push({
            rollType: "attack",
            actor,
            when,
            itemName: weapon,
            itemType: "weapon",
            ...d20Roll(mod + 2),
          });
          const dice = Array.from({ length: 1 + (rand() < 0.3 ? 1 : 0) }, () => ({
            f: 8,
            r: d(rand, 8),
          }));
          const dmg = dice.reduce((n, x) => n + x.r, 0) + mod;
          push(
            {
              rollType: "damage",
              actor,
              when,
              itemName: weapon,
              itemType: "weapon",
              damageType: DAMAGE_TYPES[Math.floor(rand() * DAMAGE_TYPES.length)],
              dice,
              modifier: mod,
              total: dmg,
            },
            m,
          );
        } else if (pick < 0.78) {
          // Feature / spell usage
          const spells = SPELLS[actor.name];
          const useSpell = spells && rand() < 0.4;
          const pool = useSpell ? spells : FEATURES[actor.name];
          const item = pool[Math.floor(rand() * pool.length)];
          const m = push({
            rollType: "usage",
            actor,
            when,
            itemName: item,
            itemType: useSpell ? "spell" : "feat",
          });
          if (useSpell && item === "Cure Wounds") {
            const heal = d(rand, 8) + 3;
            push(
              {
                rollType: "healing",
                actor,
                when,
                itemName: item,
                itemType: "spell",
                dice: [{ f: 8, r: heal - 3 }],
                modifier: 3,
                total: heal,
              },
              m,
            );
          }
        } else if (pick < 0.86) {
          push({ rollType: "initiative", actor, when, ...d20Roll(mod) });
        } else if (pick < 0.94) {
          // Concentration or plain save
          push({
            rollType: "concentration",
            actor,
            when,
            ability: "con",
            dc: 10,
            ...d20Roll(mod),
          });
        } else {
          // Hit die between fights
          const r = d(rand, 10);
          push({
            rollType: "hitDie",
            actor,
            when,
            dice: [{ f: 10, r }],
            modifier: 2,
            total: r + 2,
          });
        }
      }
    }

    // A couple of death saves per session, latest session's still GM-hidden.
    const dying = UAT_ACTORS[Math.floor(rand() * 4)];
    for (let i = 0; i < 2; i++) {
      push({
        rollType: "death",
        actor: dying,
        when: at(21, 30 + i * 2),
        isHidden: s === SESSION_DATES.length - 1,
        ...d20Roll(0),
      });
    }
  }

  // Deterministic group-roll bursts in the final session, so the group-rolls
  // panel always has data: the party rolling the same check within seconds.
  const pcs = UAT_ACTORS.filter((a) => a.kind === "pc");
  const lastDate = SESSION_DATES[SESSION_DATES.length - 1];
  const burst = (
    skill: string,
    h: number,
    m: number,
    entries: { actor: FixtureActor; face: number; mod: number; adv?: number; offset: number }[],
  ) => {
    for (const e of entries) {
      const when = new Date(`${lastDate}T${pad(h)}:${pad(m)}:00Z`);
      when.setUTCSeconds(when.getUTCSeconds() + e.offset);
      push({
        rollType: "skill",
        actor: e.actor,
        when,
        skill,
        ability: SKILL_ABILITY[skill],
        dice: [{ f: 20, r: e.face }],
        modifier: e.mod,
        total: e.face + e.mod,
        isNat20: e.face === 20,
        isNat1: e.face === 1,
        advantageState: e.adv ?? 0,
      });
    }
  };
  // Party insight sweep: a nat 20 and a nat 1 in the same burst.
  burst("ins", 20, 0, [
    { actor: pcs[0], face: 20, mod: 2, offset: 0 },
    { actor: pcs[1], face: 1, mod: 1, offset: 15 },
    { actor: pcs[2], face: 11, mod: 0, offset: 32 },
    { actor: pcs[3], face: 19, mod: 4, offset: 48 },
  ]);
  // Group stealth escape: two nat 20s (double nat 20), mixed advantage.
  burst("ste", 20, 5, [
    { actor: pcs[0], face: 20, mod: 6, adv: 1, offset: 0 },
    { actor: pcs[1], face: 15, mod: 2, offset: 22 },
    { actor: pcs[2], face: 20, mod: -2, adv: -1, offset: 41 },
  ]);

  return rolls.sort((a, b) => a.rolledAt.getTime() - b.rolledAt.getTime());
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export const UAT_ROLLS: FixtureRoll[] = buildRolls();

/** Group-roll report over the fixture PCs — mirrors stats.groupRollsFor. */
export function uatGroupRolls(rolls: FixtureRoll[] = UAT_ROLLS): GroupRollReport {
  const rows = rolls
    .filter((r) => r.kind === "pc")
    .map((r) => ({
      rolledAt: r.rolledAt,
      actorFid: r.actorFid,
      actorName: r.actorName,
      rollType: r.rollType,
      skill: r.skill,
      ability: r.ability,
      d20: r.dice.find((x) => x.f === 20)?.r ?? null,
      total: r.total,
      advantageState: r.advantageState,
      isNat20: r.isNat20,
      isNat1: r.isNat1,
      sessionDate: r.sessionDate,
    }));
  return analyzeGroupRolls(rows);
}

// ---------------------------------------------------------------------------
// In-memory aggregates, mirroring lib/stats.ts shapes.

export type UatFilters = StatFilters & { kind?: string };

function subjectOf(r: FixtureRoll, by: GroupBy): string | null {
  return by === "author" ? r.authorName : r.actorName;
}

export function uatFilter(f: UatFilters): FixtureRoll[] {
  const sessionDay = f.session ? sessionDayFrom(f.session).getTime() : null;
  const cutoff = f.days ? Date.now() - f.days * 86_400_000 : null;
  return UAT_ROLLS.filter((r) => {
    if (f.actor && r.actorName !== f.actor) return false;
    if (f.type && r.rollType !== f.type) return false;
    if (f.kind && r.kind !== f.kind) return false;
    if (!f.includeHidden && r.isHidden) return false;
    if (sessionDay !== null) {
      if (r.sessionDate.getTime() !== sessionDay) return false;
    } else if (cutoff && r.rolledAt.getTime() <= cutoff) {
      return false;
    }
    return true;
  });
}

export function uatSessions(): SessionInfo[] {
  const byDay = new Map<string, number>();
  for (const r of UAT_ROLLS) {
    const day = r.sessionDate.toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, rolls], i) => ({ n: i + 1, date, rolls }));
}

export function uatActorStats(rolls: FixtureRoll[], by: GroupBy): ActorStats[] {
  const acc = new Map<string, ActorStats & { d20Sum: number }>();
  for (const r of rolls) {
    const name = subjectOf(r, by);
    if (!name) continue;
    const s =
      acc.get(name) ??
      ({ actorName: name, allRolls: 0, d20Rolls: 0, nat20s: 0, nat1s: 0, avgD20: null, damage: 0, healing: 0, d20Sum: 0 });
    s.allRolls++;
    const d20 = r.dice.length === 1 && r.dice[0].f === 20 ? r.dice[0].r : null;
    if (d20 !== null) {
      s.d20Rolls++;
      s.d20Sum += d20;
      if (r.isNat20) s.nat20s++;
      if (r.isNat1) s.nat1s++;
    }
    if (r.rollType === "damage") s.damage += r.total ?? 0;
    if (r.rollType === "healing") s.healing += r.total ?? 0;
    acc.set(name, s);
  }
  return [...acc.values()]
    .map(({ d20Sum, ...s }) => ({ ...s, avgD20: s.d20Rolls ? d20Sum / s.d20Rolls : null }))
    .sort((a, b) => b.allRolls - a.allRolls);
}

export function uatTotals(rolls: FixtureRoll[]): CampaignTotals {
  let nat20s = 0,
    nat1s = 0,
    d20Sum = 0,
    d20Count = 0;
  let highest: CampaignTotals["highest"] = null;
  for (const r of rolls) {
    const d20 = r.dice.length === 1 && r.dice[0].f === 20 ? r.dice[0].r : null;
    if (d20 !== null) {
      d20Count++;
      d20Sum += d20;
      if (r.isNat20) nat20s++;
      if (r.isNat1) nat1s++;
      if (r.total !== null && (!highest || r.total > highest.total)) {
        highest = { total: r.total, actorName: r.actorName, rolledAt: r.rolledAt };
      }
    }
  }
  return {
    totalRolls: rolls.length,
    nat20s,
    nat1s,
    avgD20: d20Count ? d20Sum / d20Count : null,
    highest,
  };
}

export function uatHistogram(rolls: FixtureRoll[], by: GroupBy): D20Bucket[] {
  const buckets: D20Bucket[] = Array.from({ length: 20 }, (_, i) => ({
    face: i + 1,
    count: 0,
    byName: [],
  }));
  const per = new Map<number, Map<string, number>>();
  for (const r of rolls) {
    const d20 = r.dice.length === 1 && r.dice[0].f === 20 ? r.dice[0].r : null;
    if (d20 === null) continue;
    buckets[d20 - 1].count++;
    const name = subjectOf(r, by) ?? "—";
    const m = per.get(d20) ?? new Map();
    m.set(name, (m.get(name) ?? 0) + 1);
    per.set(d20, m);
  }
  for (const b of buckets) {
    b.byName = [...(per.get(b.face) ?? new Map()).entries()]
      .map(([name, count]) => ({ name, count: count as number }))
      .sort((x, y) => y.count - x.count);
  }
  return buckets;
}

export function uatRollTypeCounts(rolls: FixtureRoll[]): RollTypeCount[] {
  const acc = new Map<string, number>();
  for (const r of rolls) {
    const key =
      r.rollType === "usage" ? (r.itemType === "feat" ? "feature" : "item") : r.rollType;
    acc.set(key, (acc.get(key) ?? 0) + 1);
  }
  return [...acc.entries()]
    .map(([rollType, count]) => ({ rollType, count }))
    .sort((a, b) => b.count - a.count);
}

export function uatSkillBuckets(rolls: FixtureRoll[]): SkillAbilityBucket[] {
  const acc = new Map<string, SkillAbilityBucket>();
  for (const r of rolls) {
    const d20 = r.dice.length === 1 && r.dice[0].f === 20;
    const key = r.skill ?? r.ability;
    if (!d20 || !key) continue;
    const b = acc.get(key) ?? { key, isSkill: !!r.skill, ability: r.ability, count: 0 };
    b.count++;
    acc.set(key, b);
  }
  return [...acc.values()].sort((a, b) => b.count - a.count);
}

const ABILITY_ORDER = ["str", "dex", "con", "int", "wis", "cha"];

export function uatAbilityMatrix(
  rolls: FixtureRoll[],
  by: GroupBy,
  rollTypes: string[] = ["ability"],
): SkillMatrix {
  const bySubject = new Map<string, Map<string, number>>();
  for (const r of rolls) {
    const name = subjectOf(r, by);
    const isD20 = r.dice.length === 1 && r.dice[0].f === 20;
    if (!rollTypes.includes(r.rollType) || !r.ability || !isD20 || !name) continue;
    const m = bySubject.get(name) ?? new Map();
    m.set(r.ability, (m.get(r.ability) ?? 0) + 1);
    bySubject.set(name, m);
  }
  return {
    skills: ABILITY_ORDER,
    actors: [...bySubject.entries()].map(([name, m]) => ({
      name,
      counts: ABILITY_ORDER.map((a) => m.get(a) ?? 0),
    })),
  };
}

export function uatSkillMatrix(rolls: FixtureRoll[], by: GroupBy): SkillMatrix {
  const bySubject = new Map<string, Map<string, number>>();
  for (const r of rolls) {
    const name = subjectOf(r, by);
    if (!r.skill || !name) continue;
    const m = bySubject.get(name) ?? new Map();
    m.set(r.skill, (m.get(r.skill) ?? 0) + 1);
    bySubject.set(name, m);
  }
  // All 18 axes zero-filled, mirroring lib/stats.
  const skills = Object.keys(SKILL_ABILITY).sort();
  return {
    skills,
    actors: [...bySubject.entries()].map(([name, m]) => ({
      name,
      counts: skills.map((s) => m.get(s) ?? 0),
    })),
  };
}

export function uatItemUsage(rolls: FixtureRoll[], limit = 14): ItemUsage[] {
  const acc = new Map<string, ItemUsage & { msgs: Set<string> }>();
  for (const r of rolls) {
    if (!r.itemName) continue;
    const s =
      acc.get(r.itemName) ??
      ({ itemName: r.itemName, itemType: r.itemType, uses: 0, damage: 0, healing: 0, msgs: new Set<string>() });
    s.msgs.add(r.messageId);
    if (r.rollType === "damage") s.damage += r.total ?? 0;
    if (r.rollType === "healing") s.healing += r.total ?? 0;
    acc.set(r.itemName, s);
  }
  return [...acc.values()]
    .map(({ msgs, ...s }) => ({ ...s, uses: msgs.size }))
    .sort((a, b) => b.uses - a.uses)
    .slice(0, limit);
}

export function uatActorTops(rolls: FixtureRoll[], by: GroupBy): ActorTop[] {
  const skills = new Map<string, Map<string, number>>();
  const items = new Map<string, Map<string, Set<string>>>();
  const names = new Set<string>();
  for (const r of rolls) {
    const name = subjectOf(r, by);
    if (!name) continue;
    names.add(name);
    if (r.skill) {
      const m = skills.get(name) ?? new Map();
      m.set(r.skill, (m.get(r.skill) ?? 0) + 1);
      skills.set(name, m);
    }
    if (r.itemName) {
      const m = items.get(name) ?? new Map();
      const set = m.get(r.itemName) ?? new Set();
      set.add(r.messageId);
      m.set(r.itemName, set);
      items.set(name, m);
    }
  }
  const top = <V>(m: Map<string, V> | undefined, size: (v: V) => number): string | null => {
    if (!m || m.size === 0) return null;
    return [...m.entries()].sort((a, b) => size(b[1]) - size(a[1]))[0][0];
  };
  return [...names].map((actorName) => ({
    actorName,
    topSkill: top(skills.get(actorName), (n: number) => n),
    topItem: top(items.get(actorName), (s: Set<string>) => s.size),
  }));
}

export function uatDeathSaves(rolls: FixtureRoll[], take = 10): DeathSaveRow[] {
  return rolls
    .filter((r) => r.rollType === "death")
    .sort((a, b) => b.rolledAt.getTime() - a.rolledAt.getTime())
    .slice(0, take)
    .map((r) => ({
      actorName: r.actorName,
      d20: r.dice[0]?.r ?? null,
      total: r.total,
      rolledAt: r.rolledAt,
    }));
}

export function uatRollLog(rolls: FixtureRoll[], take = 150): RollLogRow[] {
  return rolls
    .slice()
    .sort((a, b) => b.rolledAt.getTime() - a.rolledAt.getTime())
    .slice(0, take);
}

export function uatFilterOptions() {
  return {
    actors: [...new Set(UAT_ROLLS.map((r) => r.actorName).filter((n): n is string => !!n))].sort(),
    types: [...new Set(UAT_ROLLS.map((r) => r.rollType))].sort(),
  };
}
