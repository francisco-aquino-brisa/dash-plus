"use client";

/**
 * Client-side permission checks (ADR 0007). Grants are handed down by
 * `app/(app)/layout.tsx`; nothing is fetched here.
 *
 * This decides what is worth rendering, never what is allowed — the server
 * action behind a gated control must call `can()` on its own, and a card whose
 * data is restricted must not be rendered server-side at all.
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { normalizeRoute } from "./routes";

interface Permissions {
  caps: string[];
  rotas: string[];
  isAdmin: boolean;
}

const PermissionsContext = createContext<Permissions>({ caps: [], rotas: [], isAdmin: false });

export function PermissionsProvider({
  caps,
  rotas,
  isAdmin,
  children,
}: Permissions & { children: ReactNode }) {
  const value = useMemo(() => ({ caps, rotas, isAdmin }), [caps, rotas, isAdmin]);

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function usePermissions(): Permissions {
  return useContext(PermissionsContext);
}

export function useCan(cap: string): boolean {
  const { caps, isAdmin } = usePermissions();

  return isAdmin || caps.includes(cap);
}

export function useCanOpen(rota: string): boolean {
  const { rotas, isAdmin } = usePermissions();
  const target = normalizeRoute(rota);

  return isAdmin || rotas.some((r) => normalizeRoute(r) === target);
}

/**
 * `fallback` is the read-only variant — usually the same content without its
 * controls, which is the "gestor edita / vendedor só visualiza" shape. Omit it
 * to hide the block entirely.
 */
export function Can({
  cap,
  fallback = null,
  children,
}: {
  cap: string;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  return useCan(cap) ? <>{children}</> : <>{fallback}</>;
}
