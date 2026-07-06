"use client";

import { useMemo, useState } from "react";
import { CharacterCard, type CharacterCardData } from "./character-cards";
import type { MemberInfo } from "@/lib/members";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SORTS = [
  { value: "cr", label: "Highest CR" },
  { value: "rolls", label: "Most rolls" },
  { value: "damage", label: "Most damage" },
  { value: "name", label: "Name" },
];

// GM-only browser over the monster/NPC bucket: type-ahead name filter +
// sortable by CR / activity. Purely client-side — the bucket is small.
export function MonsterBrowser({
  cards,
  members,
}: {
  cards: CharacterCardData[];
  members: MemberInfo[];
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("cr");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? cards.filter((c) => c.name.toLowerCase().includes(q)) : [...cards];
    const by: Record<string, (a: CharacterCardData, b: CharacterCardData) => number> = {
      cr: (a, b) => (b.cr ?? -1) - (a.cr ?? -1),
      rolls: (a, b) => (b.stats?.allRolls ?? 0) - (a.stats?.allRolls ?? 0),
      damage: (a, b) => (b.stats?.damage ?? 0) - (a.stats?.damage ?? 0),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return filtered.sort(by[sort] ?? by.cr);
  }, [cards, query, sort]);

  if (cards.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground">
          Monsters &amp; NPCs <span className="font-normal">(GM only)</span>
        </h3>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search monsters…"
          className="ml-auto h-8 w-44 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <Select items={SORTS} value={sort} onValueChange={(v) => setSort(v ?? "cr")}>
          <SelectTrigger className="w-36" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((c) => (
          <CharacterCard
            key={c.actorId}
            data={c}
            isOwn={false}
            ownerName={null}
            members={members}
            canAssign
          />
        ))}
      </div>
      {shown.length === 0 && (
        <p className="text-sm text-muted-foreground">No monsters match “{query}”.</p>
      )}
    </div>
  );
}
