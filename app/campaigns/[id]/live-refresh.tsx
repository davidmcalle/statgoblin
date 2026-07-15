"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Debounce so a burst of rolls (a full initiative round) collapses into one
// re-render instead of one per roll.
const COALESCE_MS = 800;

// Subscribes to the campaign's live stream (SSE) and re-fetches the
// server-rendered page when a roll lands or a shared mutation happens. No
// polling — nothing runs until something actually changes. EventSource
// reconnects on its own if the connection drops.
export function LiveRefresh({ campaignId }: { campaignId: string }) {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let missedWhileHidden = false;

    const refreshSoon = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        // Don't re-render a hidden tab; catch up when it's focused again.
        if (document.hidden) missedWhileHidden = true;
        else router.refresh();
      }, COALESCE_MS);
    };

    const onVisible = () => {
      if (!document.hidden && missedWhileHidden) {
        missedWhileHidden = false;
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    const source = new EventSource(`/api/campaigns/${campaignId}/stream`);
    source.addEventListener("activity", refreshSoon);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (timer) clearTimeout(timer);
      source.close();
    };
  }, [campaignId, router]);

  return null;
}
