"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChartColumn, ScrollText } from "lucide-react";

// Segmented slider between the roll log and the charts dashboard.
export function ViewToggle({ view }: { view: "log" | "charts" }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const set = (v: "log" | "charts") => {
    const params = new URLSearchParams(searchParams);
    if (v === "charts") params.delete("view");
    else params.set("view", v);
    if (params.toString() === searchParams.toString()) return;
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const base =
    "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors";
  const active = "border-primary font-semibold text-foreground";
  const idle = "border-transparent text-muted-foreground hover:text-foreground";

  return (
    // Underline tabs on a hairline — reads as a section divider, not a widget.
    <div role="tablist" className="flex border-b border-border">
      <button
        role="tab"
        aria-selected={view === "charts"}
        className={`${base} ${view === "charts" ? active : idle}`}
        onClick={() => set("charts")}
      >
        <ChartColumn size={15} /> Charts
      </button>
      <button
        role="tab"
        aria-selected={view === "log"}
        className={`${base} ${view === "log" ? active : idle}`}
        onClick={() => set("log")}
      >
        <ScrollText size={15} /> Rolls
      </button>
    </div>
  );
}
