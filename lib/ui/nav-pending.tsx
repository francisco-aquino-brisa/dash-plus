"use client";

import { createContext, useContext, useEffect } from "react";

/**
 * Lets a screen report an in-flight data request (a filter change / refresh /
 * auto-reload running inside a `startTransition`) up to the AppShell, which
 * shows a loading shimmer on the sidebar brand until it settles. Default no-op
 * so screens work outside the shell.
 *
 * The AppShell also drives this globally for link navigations (menu / any
 * internal `<a>`); use `useReportNavPending` in a screen for the request-driven
 * cases the shell can't see (URL filters, `router.refresh`).
 */
export const SetNavPendingContext = createContext<(pending: boolean) => void>(() => {});

export function useSetNavPending(): (pending: boolean) => void {
  return useContext(SetNavPendingContext);
}

/** Sync a screen's boolean pending state into the shell loader. */
export function useReportNavPending(pending: boolean): void {
  const setPending = useSetNavPending();

  useEffect(() => {
    setPending(pending);

    return () => setPending(false);
  }, [pending, setPending]);
}
