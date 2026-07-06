"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(max-width: 639px)";

// Matches Tailwind's `sm` breakpoint so JS-sized chart parts (axis widths,
// tick intervals) agree with the CSS layout around them.
export function useIsMobile() {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(QUERY);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
