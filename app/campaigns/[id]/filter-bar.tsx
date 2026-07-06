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

// URL-param driven filters: the server page re-queries on navigation, so
// every panel below reflects the selection.
export function FilterBar({
  actors,
  types,
  current,
}: {
  actors: string[];
  types: string[];
  current: { actor?: string; type?: string; days?: string };
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

  const hasFilters = !!(current.actor || current.type || current.days);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={current.actor ?? ALL} onValueChange={(v) => setParam("actor", v ?? ALL)}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Character" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All characters</SelectItem>
          {actors.map((a) => (
            <SelectItem key={a} value={a}>
              {a}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={current.type ?? ALL} onValueChange={(v) => setParam("type", v ?? ALL)}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Roll type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All roll types</SelectItem>
          {types.map((t) => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={current.days ?? ALL} onValueChange={(v) => setParam("days", v ?? ALL)}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Timeframe" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All time</SelectItem>
          {TIMEFRAMES.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              {t.label}
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
