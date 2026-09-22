import "server-only";

/**
 * Permission checks for Server Components, layouts and server actions (ADR 0007).
 *
 * Everything is read off the session cookie, so no check here costs a query.
 */

import { getSession } from "./session";
import { canOpenRoute, firstAccessibleRoute } from "./routes";
import type { SessionUser } from "./jwt";

export async function can(label: string): Promise<boolean> {
  return hasCap(await getSession(), label);
}

export async function canAny(...labels: string[]): Promise<boolean> {
  const session = await getSession();

  return labels.some((label) => hasCap(session, label));
}

export function hasCap(session: SessionUser | null, label: string): boolean {
  if (!session) return false;

  if (session.isAdmin) return true;

  return session.caps.includes(label);
}

export interface PageAccess {
  session: SessionUser;
  /** Where to bounce the user when `allowed` is false. */
  fallback: string;
  allowed: boolean;
}

/** Does not redirect, so the layout can decide once and API routes can answer 403. */
export async function resolvePageAccess(pathname: string): Promise<PageAccess | null> {
  const session = await getSession();

  if (!session) return null;

  return {
    session,
    allowed: canOpenRoute(session, pathname, session.catalogo),
    fallback: firstAccessibleRoute(session),
  };
}
