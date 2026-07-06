"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const TIMEFRAMES = [
  { value: "1", label: "Last 24 hours" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

const ALL = "__all__";

const KINDS = [
  { value: "pc", label: "Player characters" },
  { value: "npc", label: "NPCs" },
  { value: "monster", label: "Monsters" },
];

const BY = [
  { value: "character", label: "By character" },
  { value: "player", label: "By player" },
];

// URL-param driven filters: the server page re-queries on navigation, so
// every panel below reflects the selection. Base UI's Select renders labels
// from the `items` map passed to the root.
export function FilterBar({
  pcActors,
  monsterActors,
  types,
  sessions,
  current,
}: {
  pcActors: string[];
  monsterActors: string[];
  types: string[];
  sessions: { n: number; date: string }[];
  current: {
    actor?: string;
    type?: string;
    days?: string;
    kind?: string;
    session?: string;
    by?: string;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === ALL) params.delete(key);
    else params.set(key, value);
    // Changing kind invalidates a name picked from the other bucket's list.
    if (key === "kind") params.delete("actor");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const hasFilters = !!(
    current.actor ||
    current.type ||
    current.days ||
    current.kind ||
    current.session
  );
  const kindItems = [{ value: ALL, label: "Everyone" }, ...KINDS];
  const sessionItems = [
    { value: ALL, label: "All sessions" },
    ...sessions
      .slice()
      .reverse()
      .map((s) => ({
        value: s.date,
        label: `Session ${s.n} — ${new Date(`${s.date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
      })),
  ];

  const pcItems = [
    { value: ALL, label: "All characters" },
    ...pcActors.map((a) => ({ value: a, label: a })),
  ];
  const monsterItems = [
    { value: ALL, label: "All monsters & NPCs" },
    ...monsterActors.map((a) => ({ value: a, label: a })),
  ];
  // Kind narrows which name dropdowns even appear.
  const showPcSelect = !current.kind || current.kind === "pc";
  const showMonsterSelect = !current.kind || current.kind !== "pc";
  const typeItems = [
    { value: ALL, label: "All roll types" },
    ...types.map((t) => ({ value: t, label: t })),
  ];
  const timeItems = [{ value: ALL, label: "All time" }, ...TIMEFRAMES];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showPcSelect && (
        <Select
          items={pcItems}
          value={pcActors.includes(current.actor ?? "") ? current.actor! : ALL}
          onValueChange={(v) => setParam("actor", v ?? ALL)}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pcItems.map((i) => (
              <SelectItem key={i.value} value={i.value}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {showMonsterSelect && (
        <Select
          items={monsterItems}
          value={monsterActors.includes(current.actor ?? "") ? current.actor! : ALL}
          onValueChange={(v) => setParam("actor", v ?? ALL)}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monsterItems.map((i) => (
              <SelectItem key={i.value} value={i.value}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select
        items={kindItems}
        value={current.kind ?? ALL}
        onValueChange={(v) => setParam("kind", v ?? ALL)}
      >
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {kindItems.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={typeItems}
        value={current.type ?? ALL}
        onValueChange={(v) => setParam("type", v ?? ALL)}
      >
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {typeItems.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={timeItems}
        value={current.days ?? ALL}
        onValueChange={(v) => setParam("days", v ?? ALL)}
      >
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {timeItems.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={sessionItems}
        value={current.session ?? ALL}
        onValueChange={(v) => setParam("session", v ?? ALL)}
      >
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sessionItems.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={BY}
        value={current.by === "player" ? "player" : "character"}
        onValueChange={(v) => setParam("by", v === "player" ? "player" : ALL)}
      >
        <SelectTrigger className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {BY.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => router.replace(pathname, { scroll: false })}>
          Clear
        </Button>
      )}
    </div>
  );
}
