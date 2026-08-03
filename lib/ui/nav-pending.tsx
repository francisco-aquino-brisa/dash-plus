"use client";

import { createContext, useContext } from "react";

/**
 * Lets a screen report an in-flight navigation (e.g. a filter change running
 * inside a `startTransition`) up to the AppShell, which shows a subtle loading
 * shimmer on the sidebar brand until it settles. Default no-op so screens work
 * outside the shell.
 */
export const SetNavPendingContext = createContext<(pending: boolean) => void>(() => {});

export function useSetNavPending(): (pending: boolean) => void {
  return useContext(SetNavPendingContext);
}
