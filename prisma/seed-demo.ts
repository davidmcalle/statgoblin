import type { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/db/prisma";
import { deriveRawEvent } from "../lib/derive";

// Demo data: synthetic Foundry-shaped events run through the REAL parser, so
// the dashboard shows exactly what live play would. All messageIds are
// prefixed "demo-" for clean removal.
//
//   npm run seed:demo             seed into the first campaign
//   npm run seed:demo -- --clean  remove demo data again

// Deterministic PRNG so reruns produce the same story.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260706);
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
const d = (faces: number) => 1 + Math.floor(rand() * faces);

const CHARACTERS = [
  { id: "demoActorDamien0", name: "Damien Rosenthal", player: "Jake", weapon: "Rapier", luck: 0.0 },
  { id: "demoActorOlivia0", name: "Olivia Sagewood", player: "Rio", weapon: "Quarterstaff", luck: 0.05 },
  { id: "demoActorMaeple0", name: "Maeple Morningsong", player: "Sam", weapon: "Shortbow", luck: -0.08 },
  { id: "demoActorSyl0000", name: "Syl", player: "Alex", weapon: "Dagger", luck: 0.1 },
  { id: "demoActorLucia00", name: "Lucia Steorr'Pleiades", player: "Kay", weapon: "Longsword", luck: -0.03 },
] as const;

const MONSTERS = [
  { id: "demoActorGoblin0", name: "Goblin", weapon: "Scimitar", cr: 0.25 },
  { id: "demoActorOgre000", name: "Ogre", weapon: "Greatclub", cr: 2 },
  { id: "demoActorWraith0", name: "Wraith", weapon: "Life Drain", cr: 5 },
  { id: "demoActorBanshee", name: "Banshee", weapon: "Corrupting Touch", cr: 4 },
  { id: "demoActorZombie0", name: "Zombie", weapon: "Slam", cr: 0.25 },
] as const;

const SKILLS = ["acr", "arc", "ath", "dec", "his", "ins", "inv", "med", "prc", "per", "slt", "ste", "sur"] as const;
const SKILL_ABILITY: Record<string, string> = {
  acr: "dex", arc: "int", ath: "str", dec: "cha", his: "int", ins: "wis", inv: "int",
  med: "wis", prc: "wis", per: "cha", slt: "dex", ste: "dex", sur: "wis",
};
const DAMAGE_TYPES = ["slashing", "piercing", "bludgeoning", "fire", "radiant", "necrotic"] as const;
const SPELLS = ["Fire Bolt", "Guiding Bolt", "Eldritch Blast", "Shatter", "Toll the Dead"] as const;
const FEATS = ["Second Wind", "Unleash Incarnation", "Bardic Inspiration", "Channel Divinity"] as const;

// Luck-biased d20: nudges a character's rolls up/down without breaking 1-20.
function d20For(luck: number): number {
  const raw = d(20);
  if (luck > 0 && rand() < luck) return Math.min(20, raw + d(4));
  if (luck < 0 && rand() < -luck) return Math.max(1, raw - d(4));
  return raw;
}

function d20Roll(die: number, mod: number, rollType: string, extra: Record<string, unknown> = {}) {
  return {
    class: "D20Roll",
    options: { rollType, advantageMode: rand() < 0.2 ? 1 : rand() < 0.1 ? -1 : 0, ...extra },
    formula: `1d20 + ${mod}`,
    total: die + mod,
    terms: [
      { class: "D20Die", faces: 20, results: [{ result: die, active: true }] },
      { class: "OperatorTerm", operator: "+" },
      { class: "NumericTerm", number: mod },
    ],
  };
}

function damageRoll(dice: number, faces: number, mod: number, type: string, rollType = "damage") {
  const results = Array.from({ length: dice }, () => ({ result: d(faces), active: true }));
  const total = results.reduce((n, r) => n + r.result, 0) + mod;
  return {
    class: "DamageRoll",
    options: { rollType, type, types: [type] },
    formula: `${dice}d${faces} + ${mod}`,
    total,
    terms: [
      { class: "BasicDie", faces, results },
      { class: "OperatorTerm", operator: "+" },
      { class: "NumericTerm", number: mod },
    ],
  };
}

type Actor = { id: string; name: string; type: string; cr: number | null };

const pcActor = (c: { id: string; name: string }): Actor => ({
  id: c.id,
  name: c.name,
  type: "character",
  cr: null,
});
const npcActor = (m: { id: string; name: string; cr: number }): Actor => ({
  id: m.id,
  name: m.name,
  type: "npc",
  cr: m.cr,
});

function base(actor: Actor, author: { name: string; role: string }, at: Date) {
  return {
    messageCreatedAt: at.toISOString(),
    author: { id: `demoUser${author.name}`, name: author.name, avatar: "", role: author.role },
    actor: { id: actor.id, name: actor.name, image: "", type: actor.type, cr: actor.cr, token: null },
    visibility: { whisper: [], blind: false },
    world: { id: "demo", title: "Demo", image: "" },
    system: { id: "dnd5e", version: "5.3.3" },
    flavor: "",
    flags: {} as Record<string, unknown>,
    rolls: [] as unknown[],
    item: null as unknown,
  };
}

// One synthetic event ≈ one chat message.
function makeEvent(at: Date): { payload: Record<string, unknown> } {
  const kind = rand();
  const pc = pick(CHARACTERS);
  const author = { name: pc.player, role: "PLAYER" };

  // 15%: monster attack by the GM.
  if (kind < 0.15) {
    const m = pick(MONSTERS);
    const die = d(20);
    const p = base(npcActor(m), { name: "Gamemaster", role: "GAMEMASTER" }, at);
    const dmg = damageRoll(2, 6, 3, pick(DAMAGE_TYPES));
    p.item = { id: `demoItem${m.id}`, uuid: "demo", type: "weapon", name: m.weapon, image: "", activity: { id: "a", type: "attack", name: "Attack" } };
    p.flags = {
      dnd5e: { item: { type: "weapon" }, activity: { type: "attack" } },
      "midi-qol": { isHit: die + 4 >= 14, isCritical: die === 20, hitTargetUuids: die + 4 >= 14 ? ["x"] : [], damageTotal: dmg.total },
    };
    p.rolls = [d20Roll(die, 4, "attack"), dmg];
    return { payload: p };
  }
  // 30%: PC weapon/spell attack + damage.
  if (kind < 0.45) {
    const die = d20For(pc.luck);
    const spell = rand() < 0.4;
    const itemName = spell ? pick(SPELLS) : pc.weapon;
    const p = base(pcActor(pc), author, at);
    const dmg = damageRoll(spell ? 2 : 1, spell ? 10 : 8, 4, spell ? pick(["fire", "radiant", "necrotic"]) : pick(["slashing", "piercing"]));
    p.item = { id: `demoItem${itemName.replace(/\W/g, "")}`, uuid: "demo", type: spell ? "spell" : "weapon", name: itemName, image: "", activity: { id: "a", type: "attack", name: "Attack" } };
    p.flags = {
      dnd5e: { item: { type: spell ? "spell" : "weapon" }, activity: { type: "attack" } },
      "midi-qol": { isHit: die + 6 >= 13, isCritical: die === 20, hitTargetUuids: die + 6 >= 13 ? ["x"] : [], damageTotal: dmg.total },
    };
    p.rolls = [d20Roll(die, 6, "attack"), dmg];
    return { payload: p };
  }
  // 30%: skill check.
  if (kind < 0.75) {
    const skill = pick(SKILLS);
    const ability = SKILL_ABILITY[skill];
    const die = d20For(pc.luck);
    const mod = 1 + Math.floor(rand() * 5);
    const p = base(pcActor(pc), author, at);
    p.flags = {
      dnd5e: { messageType: "roll", roll: { skillId: skill, type: "skill" } },
      statgoblin: { rolls: [{ parts: [{ source: `@abilities.${ability}.mod`, value: mod }] }], ability, profMultiplier: pick([0, 0, 1, 1, 2]) },
    };
    p.rolls = [d20Roll(die, mod, "skill")];
    return { payload: p };
  }
  // 10%: saving throw (some concentration).
  if (kind < 0.85) {
    const ability = pick(["dex", "con", "wis", "str"]);
    const die = d20For(pc.luck);
    const conc = ability === "con" && rand() < 0.4;
    const p = base(pcActor(pc), author, at);
    p.flags = {
      dnd5e: { messageType: "roll", roll: { ability, type: "save" } },
      statgoblin: {
        ...(conc ? { rollType: "concentration" } : {}),
        rolls: [{ parts: [{ source: `@abilities.${ability}.mod`, value: 3 }] }],
        ability,
        profMultiplier: pick([0, 1]),
      },
    };
    p.rolls = [d20Roll(die, 3, "save")];
    return { payload: p };
  }
  // 8%: healing (potion / feat).
  if (kind < 0.93) {
    const feat = pick(FEATS);
    const p = base(pcActor(pc), author, at);
    const heal = damageRoll(2, 4, 2, "healing", "healing");
    p.item = { id: `demoItem${feat.replace(/\W/g, "")}`, uuid: "demo", type: "feat", name: feat, image: "", activity: { id: "a", type: "heal", name: "Healing" } };
    p.flags = { dnd5e: { item: { type: "feat" }, activity: { type: "heal" } } };
    p.rolls = [heal];
    return { payload: p };
  }
  // 4%: usage card, no roll.
  if (kind < 0.97) {
    const feat = pick(FEATS);
    const p = base(pcActor(pc), author, at);
    p.item = { id: `demoItem${feat.replace(/\W/g, "")}`, uuid: "demo", type: "feat", name: feat, image: "", activity: null };
    p.flags = { dnd5e: { item: { type: "feat" } } };
    return { payload: p };
  }
  // 3%: death save.
  {
    const die = d(20);
    const p = base(pcActor(pc), author, at);
    p.flavor = "Death Saving Throw";
    p.flags = { dnd5e: { messageType: "roll", roll: { type: "death" } } };
    p.rolls = [d20Roll(die, 0, "death", { target: 10 })];
    return { payload: p };
  }
}

async function main() {
  const campaign = await prisma.campaign.findFirst({ orderBy: { createdAt: "asc" } });
  if (!campaign) throw new Error("No campaign — create one in the app first.");

  if (process.argv.includes("--clean")) {
    const events = await prisma.rawEvent.findMany({
      where: { campaignId: campaign.id, messageId: { startsWith: "demo-" } },
      select: { id: true },
    });
    await prisma.roll.deleteMany({ where: { rawEventId: { in: events.map((e) => e.id) } } });
    await prisma.rawEvent.deleteMany({ where: { id: { in: events.map((e) => e.id) } } });
    await prisma.actor.deleteMany({
      where: { campaignId: campaign.id, foundryActorId: { startsWith: "demoActor" } },
    });
    console.log(`removed ${events.length} demo events from "${campaign.name}"`);
    return;
  }

  // 8 weekly sessions, 35–60 events each, spread over a 4-hour evening.
  let n = 0;
  for (let session = 0; session < 8; session++) {
    const sessionStart = new Date(Date.now() - (7 * session + 1) * 86_400_000);
    sessionStart.setHours(19, 0, 0, 0);
    const count = 35 + Math.floor(rand() * 26);
    for (let i = 0; i < count; i++) {
      const at = new Date(sessionStart.getTime() + (i / count) * 4 * 3_600_000);
      const payload = makeEvent(at).payload as Prisma.InputJsonValue;
      const messageId = `demo-${session}-${i}`;
      const row = await prisma.rawEvent.upsert({
        where: { campaignId_messageId: { campaignId: campaign.id, messageId } },
        create: { campaignId: campaign.id, messageId, lastEventType: "created", payload },
        update: { payload, lastEventType: "created" },
      });
      await deriveRawEvent(row);
      n++;
    }
  }
  console.log(`seeded ${n} demo events into "${campaign.name}" (npm run seed:demo -- --clean to remove)`);
}

main().finally(() => prisma.$disconnect());
