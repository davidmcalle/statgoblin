"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const POLL_MS = 4000;

// Polls the campaign's freshness probe and re-fetches the server-rendered
// page when new rolls have landed. Skips ticks while the tab is hidden.
export function LiveRefresh({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const last = useRef<string | null>(null);

  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      if (stopped || document.hidden) return;
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/latest`, { cache: "no-store" });
        if (!res.ok) return;
        const { t, n } = (await res.json()) as { t: string | null; n: number };
        const stamp = `${t}:${n}`;
        if (last.current !== null && last.current !== stamp) router.refresh();
        last.current = stamp;
      } catch {
        // transient network hiccup — try again next tick
      }
    };
    const timer = setInterval(tick, POLL_MS);
    void tick();
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [campaignId, router]);

  return null;
}
