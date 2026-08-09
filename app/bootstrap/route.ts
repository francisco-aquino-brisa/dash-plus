import { NextRequest, NextResponse } from "next/server";
import { getForwardedEmail } from "@/lib/auth/identity";
import { authorizeByEmail } from "@/lib/auth/gate";
import { signSession, SESSION_COOKIE, getSessionTtlSeconds } from "@/lib/auth/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /bootstrap?next=/path
 *
 * The session entry point (there is no login form — ADR 0005). Reads the
 * forwarded email, gates it against `tb_usuarios`, and on success mints the
 * session cookie and redirects to `next`. On failure sends to /sem-acesso.
 * The middleware routes here whenever the cookie is missing/expired.
 */
export async function GET(req: NextRequest) {
  const nextParam = req.nextUrl.searchParams.get("next");
  // Only allow same-origin relative paths (guards against open redirects).
  const target =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";

  const email = getForwardedEmail();

  if (!email) {
    return NextResponse.redirect(new URL("/sem-acesso", req.url));
  }

  let user;

  try {
    user = await authorizeByEmail(email);
  } catch (err) {
    // Databricks query failed — usually the app principal lacks access to the
    // table. Log the full error (no secrets in here) so the cause is visible.
    console.error("[bootstrap] tb_usuarios lookup failed:", err);

    return NextResponse.redirect(new URL("/sem-acesso?erro=lookup", req.url));
  }

  if (!user) {
    return NextResponse.redirect(new URL("/sem-acesso", req.url));
  }

  let token: string;

  try {
    token = await signSession(user);
  } catch (err) {
    console.error("[bootstrap] session signing failed:", (err as Error)?.message);

    return NextResponse.redirect(new URL("/sem-acesso?erro=sessao", req.url));
  }

  const res = NextResponse.redirect(new URL(target, req.url));

  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: getSessionTtlSeconds(),
  });

  return res;
}
