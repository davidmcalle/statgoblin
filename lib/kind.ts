// Actor kind: the metrics axis. "pc" | "npc" (friendly) | "monster" (enemy).
// Manual GM override wins; otherwise assigned-or-character → pc, everything
// else → monster. "npc" only ever comes from the override — the payload can't
// tell friend from foe.

export type ActorKind = "pc" | "npc" | "monster";

export const KINDS: { value: ActorKind; label: string }[] = [
  { value: "pc", label: "Player characters" },
  { value: "npc", label: "NPCs" },
  { value: "monster", label: "Monsters" },
];

type KindSource = {
  kindOverride: string | null;
  assignedUserId: string | null;
  actorType: string | null;
};

export function effectiveKind(a: KindSource): ActorKind {
  if (a.kindOverride === "pc" || a.kindOverride === "npc" || a.kindOverride === "monster") {
    return a.kindOverride;
  }
  return a.assignedUserId || a.actorType === "character" ? "pc" : "monster";
}
