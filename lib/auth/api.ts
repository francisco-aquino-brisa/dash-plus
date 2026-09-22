import { NextResponse } from "next/server";
import { getSession } from "./session";
import { hasCap } from "./permissions";
import { canOpenRoute } from "./routes";
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

/**
 * The middleware's page gate does not cover `/api`, so an endpoint backing a
 * gated screen repeats the check — otherwise the screen is closed and its data
 * is not. `rota` is the `tb_paginas.rota` of the screen it serves.
 */
export async function requirePageSession(rota: string): Promise<SessionUser | NextResponse> {
  const session = await requireSession();

  if (session instanceof NextResponse) return session;

  if (!canOpenRoute(session, rota, session.catalogo)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return session;
}

/** Capability guard for an `/api/*` route — a hidden control is not a check. */
export async function requireCap(label: string): Promise<SessionUser | NextResponse> {
  const session = await requireSession();

  if (session instanceof NextResponse) return session;

  if (!hasCap(session, label)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  return session;
}
