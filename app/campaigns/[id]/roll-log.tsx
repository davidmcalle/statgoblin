import {
  Activity,
  BookOpen,
  EyeOff,
  Compass,
  Cross,
  Dices,
  Drama,
  Dumbbell,
  Eye,
  Flame,
  Ghost,
  Hand,
  Heart,
  HeartPulse,
  Leaf,
  Megaphone,
  MessageCircle,
  Music,
  PawPrint,
  Search,
  Shield,
  Skull,
  Sparkles,
  Sun,
  Swords,
  Target,
  Telescope,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { ABILITY_NAMES, SKILL_NAMES } from "@/lib/dnd5e-meta";
import { DeleteRollButton } from "./delete-roll-button";
import type { RollLogRow } from "@/lib/stats";

const SKILL_ICONS: Record<string, LucideIcon> = {
  acr: Activity,
  ani: PawPrint,
  arc: Sparkles,
  ath: Dumbbell,
  dec: Drama,
  his: BookOpen,
  ins: Eye,
  itm: Megaphone,
  inv: Search,
  med: Cross,
  nat: Leaf,
  prc: Telescope,
  prf: Music,
  per: MessageCircle,
  rel: Sun,
  slt: Hand,
  ste: Ghost,
  sur: Compass,
};

const TYPE_ICONS: Record<string, LucideIcon> = {
  attack: Swords,
  damage: Flame,
  healing: Heart,
  save: Shield,
  concentration: Target,
  death: Skull,
  initiative: Zap,
  hitDie: HeartPulse,
  usage: Sparkles,
  recharge: Zap,
  ability: Dices,
  manual: Dices,
};

function describe(r: RollLogRow): string {
  switch (r.rollType) {
    case "skill":
      return `${r.skill ? (SKILL_NAMES[r.skill] ?? r.skill) : "Skill"} skill check`;
    case "ability":
      return `${r.ability ? (ABILITY_NAMES[r.ability] ?? r.ability) : "Ability"} check`;
    case "save":
      return `${r.ability ? (ABILITY_NAMES[r.ability] ?? r.ability) : ""} saving throw`.trim();
    case "concentration":
      return "Concentration saving throw";
    case "attack":
      return r.itemName ? `Attack · ${r.itemName}` : "Attack";
    case "damage":
      return r.damageType ? `Damage · ${r.damageType}` : "Damage";
    case "healing":
      return "Healing";
    case "death":
      return "Death saving throw";
    case "initiative":
      return "Initiative";
    case "hitDie":
      return "Rolled a hit die";
    case "usage":
      return r.itemName ? `${r.itemName} used` : "Ability used";
    case "recharge":
      return "Recharge";
    default:
      return r.formula ?? "Roll";
  }
}

const DICE_CAP = 6;

// Roll category drives the row accent — check vs save vs attack vs damage vs
// heal vs feature vs item, per the log design.
type Category = "check" | "save" | "attack" | "damage" | "healing" | "feature" | "item" | "other";

const CATEGORY_COLORS: Record<Category, string> = {
  check: "#8b7fe8", // violet
  save: "#3fa284", // teal-green
  attack: "#3b82d9", // blue
  damage: "#e05d38", // ember
  healing: "#d95d8a", // rose
  feature: "#d99a2b", // amber
  item: "#5bb8c4", // cyan
  other: "#6b7280", // gray
};

function categoryOf(r: RollLogRow): Category {
  switch (r.rollType) {
    case "skill":
    case "ability":
    case "tool":
    case "initiative":
      return "check";
    case "save":
    case "concentration":
    case "death":
      return "save";
    case "attack":
      return "attack";
    case "damage":
      return "damage";
    case "healing":
    case "hitDie":
      return "healing";
    case "usage":
    case "recharge":
      // Class/racial features are dnd5e "feat" items; everything else used
      // from the sheet (consumables, weapons, wondrous items) is an item.
      return r.itemType === "feat" ? "feature" : "item";
    default:
      return "other";
  }
}

// One SVG outline per physical die: d4 triangle, d6 square, d8 diamond,
// d10 kite, d12 pentagon, d20 hexagon, anything else a circle.
const DIE_PATHS: Record<number, string> = {
  4: "M12 2 L22.5 21 L1.5 21 Z",
  6: "M4 4 h16 v16 h-16 Z",
  8: "M12 1 L22.5 12 L12 23 L1.5 12 Z",
  10: "M12 1 L22 9.5 L12 23 L2 9.5 Z",
  12: "M12 1 L22.8 8.8 L18.7 21.5 L5.3 21.5 L1.2 8.8 Z",
  20: "M12 0.5 L22.5 6.2 L22.5 17.8 L12 23.5 L1.5 17.8 L1.5 6.2 Z",
};

function Die({ die }: { die: { f: number; r: number } }) {
  const nat20 = die.f === 20 && die.r === 20;
  const nat1 = die.f === 20 && die.r === 1;
  const fill = nat20 ? "#22c55e" : nat1 ? "#ef4444" : "var(--muted)";
  const text = nat20 || nat1 ? "white" : "var(--foreground)";
  const path = DIE_PATHS[die.f];
  // d4 numbers sit low inside the triangle.
  const nudge = die.f === 4 ? "translate-y-[4px]" : "";
  return (
    <span
      title={`d${die.f}: ${die.r}`}
      className="relative inline-flex h-9 w-9 items-center justify-center"
    >
      <svg viewBox="0 0 24 24" className="absolute inset-0 h-full w-full" aria-hidden>
        {path ? (
          <path d={path} fill={fill} stroke="var(--border)" strokeWidth="0.8" strokeLinejoin="round" />
        ) : (
          <circle cx="12" cy="12" r="10.5" fill={fill} stroke="var(--border)" strokeWidth="0.8" />
        )}
      </svg>
      <span
        className={`relative font-bold leading-none ${die.r >= 10 ? "text-[10px]" : "text-xs"} ${nudge}`}
        style={{ color: text }}
      >
        {die.r}
      </span>
    </span>
  );
}

export function RollLog({
  rows,
  colors,
  images,
  canDelete = false,
}: {
  rows: RollLogRow[];
  colors: Map<string, string>;
  images: Map<string, string>;
  canDelete?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-12 text-center text-muted-foreground">
        No rolls match these filters yet.
      </p>
    );
  }

  // Group into day sections, newest day first (rows arrive newest-first).
  const groups: { label: string; rows: RollLogRow[] }[] = [];
  for (const row of rows) {
    const label = row.rolledAt
      .toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
      .toUpperCase();
    const last = groups[groups.length - 1];
    if (last?.label === label) last.rows.push(row);
    else groups.push({ label, rows: [row] });
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.label}>
          <div className="mb-3 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <h3 className="text-xs font-semibold tracking-widest text-muted-foreground">
              {g.label}
            </h3>
            <span className="h-px flex-1 bg-border" />
          </div>
          <ul className="space-y-2">
            {g.rows.map((r) => {
              const Icon = (r.rollType === "skill" && r.skill && SKILL_ICONS[r.skill]) ||
                TYPE_ICONS[r.rollType] ||
                Dices;
              const category = categoryOf(r);
              const accent = CATEGORY_COLORS[category];
              const avatarColor = (r.actorName && colors.get(r.actorName)) || "var(--border)";
              const shown = r.dice.slice(0, DICE_CAP);
              const hidden = r.dice.length - shown.length;
              return (
                <li
                  key={r.id}
                  className="flex items-center gap-4 rounded-lg border bg-card p-4"
                  style={{ borderLeft: `3px solid ${accent}` }}
                >
                  {r.actorName && images.get(r.actorName) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={images.get(r.actorName)}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-bold text-white"
                      style={{ background: avatarColor }}
                    >
                      {(r.actorName ?? "?").slice(0, 1)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate font-semibold">{r.actorName ?? "—"}</span>
                      {r.authorName && (
                        <span className="text-xs text-muted-foreground">{r.authorName}</span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Icon size={15} aria-hidden style={{ color: accent }} />
                      <span>{describe(r)}</span>
                      {r.isHidden && (
                        <span className="ml-1 inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
                          <EyeOff size={11} /> hidden from players
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {shown.map((die, i) => (
                      <Die key={i} die={die} />
                    ))}
                    {hidden > 0 && (
                      <span className="text-xs text-muted-foreground">+{hidden}</span>
                    )}
                    {r.modifier != null && r.modifier !== 0 && (
                      <span className="ml-1 text-sm font-semibold text-muted-foreground">
                        {r.modifier > 0 ? `+${r.modifier}` : r.modifier}
                      </span>
                    )}
                  </div>
                  <div className="w-16 text-right">
                    <div
                      className={`text-2xl font-bold ${
                        r.isNat20 ? "text-green-500" : r.isNat1 ? "text-red-500" : ""
                      }`}
                    >
                      {r.total ?? ""}
                    </div>
                    {r.dc != null && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        DC {r.dc}
                      </span>
                    )}
                  </div>
                  <div className="w-12 text-right text-xs text-muted-foreground">
                    {r.rolledAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  {canDelete && <DeleteRollButton rollId={r.id} />}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
