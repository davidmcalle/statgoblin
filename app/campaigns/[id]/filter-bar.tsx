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

// URL-param driven filters: the server page re-queries on navigation, so
// every panel below reflects the selection. Base UI's Select renders labels
// from the `items` map passed to the root.
export function FilterBar({
  actors,
  types,
  current,
}: {
  actors: string[];
  types: string[];
  current: { actor?: string; type?: string; days?: string; kind?: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === ALL) params.delete(key);
    else params.set(key, value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const hasFilters = !!(current.actor || current.type || current.days || current.kind);
  const kindItems = [{ value: ALL, label: "Everyone" }, ...KINDS];

  const actorItems = [
    { value: ALL, label: "All characters" },
    ...actors.map((a) => ({ value: a, label: a })),
  ];
  const typeItems = [
    { value: ALL, label: "All roll types" },
    ...types.map((t) => ({ value: t, label: t })),
  ];
  const timeItems = [{ value: ALL, label: "All time" }, ...TIMEFRAMES];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        items={actorItems}
        value={current.actor ?? ALL}
        onValueChange={(v) => setParam("actor", v ?? ALL)}
      >
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {actorItems.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => router.replace(pathname, { scroll: false })}>
          Clear
        </Button>
      )}
    </div>
  );
}
