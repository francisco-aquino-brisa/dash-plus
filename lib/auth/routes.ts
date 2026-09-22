/**
 * Route side of the permission model (ADR 0007).
 *
 * Must stay free of `server-only`, `next/headers` and `@databricks/sql`: the Edge
 * middleware gates on these helpers, and a Node-only import here breaks the build.
 */

const ALWAYS_OPEN = ["/perfil", "/sem-acesso", "/entrar", "/logout", "/bootstrap"];

export const ADMIN_ROOT = "/admin";

/** Lowercased, no trailing slash. Returns "" for anything unusable as a path. */
export function normalizeRoute(value: unknown): string {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();

  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "";

  const trimmed = raw.split(/[?#]/)[0].replace(/\/+$/, "");

  return trimmed || "/";
}

export function isAdminRoute(pathname: string): boolean {
  const path = normalizeRoute(pathname);

  return path === ADMIN_ROOT || path.startsWith(`${ADMIN_ROOT}/`);
}

export function isAlwaysOpen(pathname: string): boolean {
  const path = normalizeRoute(pathname);

  return ALWAYS_OPEN.some((open) => path === open || path.startsWith(`${open}/`));
}

/** Does `pathname` sit on `rota` — the page itself or one of its sub-paths? */
export function matchesRoute(pathname: string, rota: string): boolean {
  const path = normalizeRoute(pathname);
  const base = normalizeRoute(rota);

  if (!path || !base) return false;

  return path === base || path.startsWith(`${base}/`);
}

/** Longest match wins, so a page nested under another is gated by its own grant. */
export function matchCatalogRoute(pathname: string, catalog: readonly string[]): string {
  let best = "";

  for (const rota of catalog) {
    if (matchesRoute(pathname, rota) && normalizeRoute(rota).length > best.length) {
      best = normalizeRoute(rota);
    }
  }

  return best;
}

/**
 * `catalog` is every registered `tb_paginas.rota`. A path matching no entry is
 * NOT gated — screens outside the catalog stay open until somebody registers
 * them. Only `/admin/*` is closed without being in it.
 */
export function canOpenRoute(
  session: { isAdmin: boolean; rotas: string[] },
  pathname: string,
  catalog: readonly string[],
): boolean {
  if (session.isAdmin) return true;

  if (isAlwaysOpen(pathname)) return true;

  if (isAdminRoute(pathname)) return false;

  const gated = matchCatalogRoute(pathname, catalog);

  if (!gated) return true;

  return session.rotas.some((rota) => normalizeRoute(rota) === gated);
}

/** `rotas` arrives ordered by `tb_paginas.id`, so the first is the closest screen. */
export function firstAccessibleRoute(session: { isAdmin: boolean; rotas: string[] }): string {
  if (session.isAdmin) return "/dashboard";

  const first = session.rotas.map(normalizeRoute).find(Boolean);

  return first || "/sem-acesso?motivo=permissao";
}
