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
  isCreator = false,
  ownedFids = [],
}: {
  rows: RollLogRow[];
  colors: Map<string, string>;
  images: Map<string, string>;
  isCreator?: boolean;
  ownedFids?: string[];
}) {
  const owned = new Set(ownedFids);
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
          <ul className="divide-y divide-border border-y border-border">
            {g.rows.map((r) => {
              const Icon = (r.rollType === "skill" && r.skill && SKILL_ICONS[r.skill]) ||
                TYPE_ICONS[r.rollType] ||
                Dices;
              const avatarColor = (r.actorName && colors.get(r.actorName)) || "var(--border)";
              const shown = r.dice.slice(0, DICE_CAP);
              const hidden = r.dice.length - shown.length;
              const time = r.rolledAt.toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              });
              const diceStrip = (
                <>
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
                </>
              );
              return (
                <li key={r.id} className="py-3 sm:py-3.5">
                  <div className="flex items-center gap-3 sm:gap-4">
                    {/* Identity color rides the avatar's border, matching the
                        character's series color in the charts. */}
                    {r.actorName && images.get(r.actorName) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={images.get(r.actorName)}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-full border-2 object-cover sm:h-11 sm:w-11"
                        style={{ borderColor: avatarColor }}
                      />
                    ) : (
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-muted font-bold text-foreground sm:h-11 sm:w-11"
                        style={{ borderColor: avatarColor }}
                      >
                        {(r.actorName ?? "?").slice(0, 1)}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="truncate font-semibold">{r.actorName ?? "—"}</span>
                        {r.authorName && (
                          <span className="hidden text-xs text-muted-foreground sm:inline">
                            {r.authorName}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Icon size={15} className="shrink-0" aria-hidden />
                        <span className="truncate">{describe(r)}</span>
                        {r.isHidden && (
                          <span className="ml-1 inline-flex shrink-0 items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
                            <EyeOff size={11} /> hidden from players
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Dice inline on desktop; on phones they drop to the second line. */}
                    <div className="hidden items-center gap-1.5 sm:flex">{diceStrip}</div>
                    <div className="shrink-0 text-right sm:w-16">
                      <div
                        className={`text-xl font-bold sm:text-2xl ${
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
                    <div className="hidden w-12 text-right text-xs text-muted-foreground sm:block">
                      {time}
                    </div>
                    {(isCreator || (r.actorFid && owned.has(r.actorFid))) && (
                      <DeleteRollButton rollId={r.id} />
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 pl-[52px] sm:hidden">
                    {diceStrip}
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">{time}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
