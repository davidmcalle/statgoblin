"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Subscribes to the campaign's SSE stream and re-fetches the server-rendered
// page on each event. Debounced — midi-qol fires create + several updates per
// action, one refresh covers the burst. EventSource auto-reconnects.
export function LiveRefresh({ campaignId }: { campaignId: string }) {
  const router = useRouter();

  useEffect(() => {
    const source = new EventSource(`/api/campaigns/${campaignId}/stream`);
    let timer: ReturnType<typeof setTimeout> | undefined;
    source.onmessage = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 300);
    };
    return () => {
      clearTimeout(timer);
      source.close();
    };
  }, [campaignId, router]);

  return null;
}
