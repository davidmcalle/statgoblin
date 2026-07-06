import {
  Activity,
  BookOpen,
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

function Die({ die }: { die: { f: number; r: number } }) {
  const nat20 = die.f === 20 && die.r === 20;
  const nat1 = die.f === 20 && die.r === 1;
  const color = nat20 ? "#22c55e" : nat1 ? "#ef4444" : "var(--muted)";
  const text = nat20 || nat1 ? "white" : "var(--foreground)";
  return (
    <span
      title={`d${die.f}: ${die.r}`}
      className="relative inline-flex h-8 w-8 items-center justify-center"
    >
      <svg viewBox="0 0 24 24" className="absolute inset-0 h-full w-full" aria-hidden>
        <path
          d="M12 1.5 L21.5 7 L21.5 17 L12 22.5 L2.5 17 L2.5 7 Z"
          fill={color}
          stroke="var(--border)"
          strokeWidth="1"
        />
      </svg>
      <span className="relative text-xs font-bold" style={{ color: text }}>
        {die.r}
      </span>
    </span>
  );
}

export function RollLog({
  rows,
  colors,
  images,
}: {
  rows: RollLogRow[];
  colors: Map<string, string>;
  images: Map<string, string>;
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
              const color = (r.actorName && colors.get(r.actorName)) || "var(--border)";
              const shown = r.dice.slice(0, DICE_CAP);
              const hidden = r.dice.length - shown.length;
              return (
                <li
                  key={r.id}
                  className="flex items-center gap-4 rounded-lg border bg-card p-4"
                  style={{ borderLeft: `3px solid ${color}` }}
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
                      style={{ background: color }}
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
                      <Icon size={15} aria-hidden />
                      <span>{describe(r)}</span>
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
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
