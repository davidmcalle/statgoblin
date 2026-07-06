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

  const base = "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors";
  const active = "bg-background font-semibold shadow-sm";
  const idle = "text-muted-foreground hover:text-foreground";

  return (
    <div className="inline-flex rounded-lg border bg-muted p-1">
      <button className={`${base} ${view === "charts" ? active : idle}`} onClick={() => set("charts")}>
        <ChartColumn size={15} /> Charts
      </button>
      <button className={`${base} ${view === "log" ? active : idle}`} onClick={() => set("log")}>
        <ScrollText size={15} /> Rolls
      </button>
    </div>
  );
}
