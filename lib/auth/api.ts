import { NextResponse } from "next/server";
import { getSession } from "./session";
import type { SessionUser } from "./jwt";

/**
 * Session guard for `/api/*` route handlers.
 *
 * The auth middleware deliberately excludes `/api` (see middleware.ts matcher),
 * so every data route must guard itself. Returns the session when valid, or a
 * 401 `NextResponse` the caller should return immediately:
 *
 * ```ts
 * const session = await requireSession();
 * if (session instanceof NextResponse) return session;
 * ```
 */
export async function requireSession(): Promise<SessionUser | NextResponse> {
  const session = await getSession();

  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  return session;
}
