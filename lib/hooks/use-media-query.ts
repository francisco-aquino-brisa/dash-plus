"use client";

import { useEffect, useState } from "react";

/**
 * Hydration-safe media-query hook. Returns `false` on the server and the first
 * client render (so SSR markup matches), then reflects the real match after
 * mount — the same pattern AppShell uses for its collapsed flag.
 *
 * Used by the cross-cutting filter primitives to decide popover (desktop) vs.
 * bottom-sheet (mobile). The breakpoint mirrors AppShell's Tailwind `lg` (1024px).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);

    setMatches(mql.matches);

    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);

    mql.addEventListener("change", onChange);

    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** True below AppShell's `lg` breakpoint — the point where filters become sheets. */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 1023px)");
}
