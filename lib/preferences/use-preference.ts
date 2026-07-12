"use client";

import { useCallback, useEffect, useState } from "react";
import { readPreference, writePreference } from "./store";

/**
 * Hydration-safe preference hook. Returns `defaultValue` on the server and the
 * first client render (so SSR markup matches), then swaps in the stored value
 * after mount — the same pattern AppShell uses for its collapsed flag.
 *
 * `setValue` accepts a value or an updater and persists it immediately.
 * `hydrated` is false until the stored value has been read, letting callers
 * avoid writing back the default before the real preference loads.
 */
export function usePreference<T>(
  key: string,
  defaultValue: T,
): [T, (next: T | ((prev: T) => T)) => void, boolean] {
  const [value, setValue] = useState<T>(defaultValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setValue(readPreference<T>(key, defaultValue));
    setHydrated(true);
    // Only re-hydrate when the key changes; defaultValue is a render-stable seed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        writePreference(key, resolved);

        return resolved;
      });
    },
    [key],
  );

  return [value, update, hydrated];
}
