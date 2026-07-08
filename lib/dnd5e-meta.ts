// dnd5e id → display metadata used by the dashboard.

export const ABILITY_NAMES: Record<string, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

export const SKILL_NAMES: Record<string, string> = {
  acr: "Acrobatics",
  ani: "Animal Handling",
  arc: "Arcana",
  ath: "Athletics",
  dec: "Deception",
  his: "History",
  ins: "Insight",
  itm: "Intimidation",
  inv: "Investigation",
  med: "Medicine",
  nat: "Nature",
  prc: "Perception",
  prf: "Performance",
  per: "Persuasion",
  rel: "Religion",
  slt: "Sleight of Hand",
  ste: "Stealth",
  sur: "Survival",
};

export const SKILL_ABILITY: Record<string, string> = {
  acr: "dex",
  ani: "wis",
  arc: "int",
  ath: "str",
  dec: "cha",
  his: "int",
  ins: "wis",
  itm: "cha",
  inv: "int",
  med: "wis",
  nat: "int",
  prc: "wis",
  prf: "cha",
  per: "cha",
  rel: "int",
  slt: "dex",
  ste: "dex",
  sur: "wis",
};

// Series colors come from the validated categorical palette in globals.css
// (--series-1..8), which re-steps the same hues per theme. Abilities take a
// fixed slot each so a stat keeps its color everywhere.
export const ABILITY_COLORS: Record<string, string> = {
  str: "var(--series-8)", // orange
  dex: "var(--series-2)", // aqua
  con: "var(--series-6)", // red
  int: "var(--series-1)", // blue
  wis: "var(--series-4)", // green
  cha: "var(--series-5)", // violet
};

// Stable per-character palette: sorted names index into the slot order.
export const CHARACTER_PALETTE = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
];

export function characterColors(names: string[]): Map<string, string> {
  const sorted = [...names].sort((a, b) => a.localeCompare(b));
  return new Map(sorted.map((n, i) => [n, CHARACTER_PALETTE[i % CHARACTER_PALETTE.length]]));
}
