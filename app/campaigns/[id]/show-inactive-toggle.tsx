"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

// Creatures with zero rolls (under the active filters) are hidden from the
// card sections by default; this reveals them. URL-param driven like the
// filter bar, so the server page recomputes visibility.
export function ShowInactiveToggle({ hiddenCount, showAll }: { hiddenCount: number; showAll: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (hiddenCount === 0 && !showAll) return null;

  const toggle = () => {
    const params = new URLSearchParams(searchParams);
    if (showAll) params.delete("showAll");
    else params.set("showAll", "1");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <Button variant="ghost" size="sm" onClick={toggle} className="text-muted-foreground">
      {showAll ? <EyeOff size={14} /> : <Eye size={14} />}
      {showAll ? "Hide inactive" : `Show inactive (${hiddenCount})`}
    </Button>
  );
}
