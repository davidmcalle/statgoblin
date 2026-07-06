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

export const ABILITY_COLORS: Record<string, string> = {
  str: "#d08a3d",
  dex: "#3fa284",
  con: "#c4586e",
  int: "#8dab3a",
  wis: "#8b7fe8",
  cha: "#dd7663",
};

// Stable per-character palette: sorted names index into this list.
export const CHARACTER_PALETTE = [
  "#d99a2b", // amber
  "#8b7fe8", // violet
  "#3b82d9", // blue
  "#3fa284", // teal
  "#4d9e35", // green
  "#dd7663", // salmon
  "#c4586e", // rose
  "#8dab3a", // olive
];

export function characterColors(names: string[]): Map<string, string> {
  const sorted = [...names].sort((a, b) => a.localeCompare(b));
  return new Map(sorted.map((n, i) => [n, CHARACTER_PALETTE[i % CHARACTER_PALETTE.length]]));
}
