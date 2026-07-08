"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ListFilter } from "lucide-react";
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

type Item = { value: string; label: string };

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
  // Mobile: filters live behind a toggle so the bar doesn't swallow the page.
  const [open, setOpen] = useState(false);

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === ALL) params.delete(key);
    else params.set(key, value);
    // Changing kind invalidates a name picked from the other bucket's list.
    if (key === "kind") params.delete("actor");
    // No-op guard: selects can fire on hydration; refetching the same URL
    // remounts the route (and restarts loading states) for nothing.
    if (params.toString() === searchParams.toString()) return;
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

  const activeCount = [
    current.actor,
    current.type,
    current.days,
    current.kind,
    current.session,
  ].filter(Boolean).length;

  return (
    <div className="w-full">
      <Button
        variant="outline"
        size="sm"
        className="sm:hidden"
        onClick={() => setOpen((o) => !o)}
      >
        <ListFilter size={15} />
        Filters
        {activeCount > 0 && ` (${activeCount})`}
      </Button>
      {/* Micro-labelled fields in an aligned grid — every control says what
          it filters instead of relying on its placeholder value. */}
      <div
        className={`${open ? "grid" : "hidden"} mt-2 grid-cols-2 gap-x-2 gap-y-3 sm:mt-0 sm:grid sm:grid-cols-3 lg:grid-cols-4`}
      >
        {showPcSelect && (
          <FilterField label="Character">
            <FilterSelect
              items={pcItems}
              value={pcActors.includes(current.actor ?? "") ? current.actor! : ALL}
              onChange={(v) => setParam("actor", v)}
            />
          </FilterField>
        )}

        {showMonsterSelect && (
          <FilterField label="Monster / NPC">
            <FilterSelect
              items={monsterItems}
              value={monsterActors.includes(current.actor ?? "") ? current.actor! : ALL}
              onChange={(v) => setParam("actor", v)}
            />
          </FilterField>
        )}

        <FilterField label="Who">
          <FilterSelect
            items={kindItems}
            value={current.kind ?? ALL}
            onChange={(v) => setParam("kind", v)}
          />
        </FilterField>

        <FilterField label="Roll type">
          <FilterSelect
            items={typeItems}
            value={current.type ?? ALL}
            onChange={(v) => setParam("type", v)}
          />
        </FilterField>

        <FilterField label="Timeframe">
          <FilterSelect
            items={timeItems}
            value={current.days ?? ALL}
            onChange={(v) => setParam("days", v)}
          />
        </FilterField>

        <FilterField label="Session">
          <FilterSelect
            items={sessionItems}
            value={current.session ?? ALL}
            onChange={(v) => setParam("session", v)}
          />
        </FilterField>

        <FilterField label="Group by">
          <FilterSelect
            items={BY}
            value={current.by === "player" ? "player" : "character"}
            onChange={(v) => setParam("by", v === "player" ? "player" : ALL)}
          />
        </FilterField>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="col-span-2 self-end justify-self-start sm:col-span-1"
            onClick={() => router.replace(pathname, { scroll: false })}
          >
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <span className="mb-1 block font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}

function FilterSelect({
  items,
  value,
  onChange,
}: {
  items: Item[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select items={items} value={value} onValueChange={(v) => onChange(v ?? ALL)}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((i) => (
          <SelectItem key={i.value} value={i.value}>
            {i.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
