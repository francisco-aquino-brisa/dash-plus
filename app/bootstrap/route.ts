import { NextRequest } from "next/server";
import { getForwardedEmail } from "@/lib/auth/identity";
import { authorizeByEmail } from "@/lib/auth/gate";
import { signSession, SESSION_COOKIE, getSessionTtlSeconds } from "@/lib/auth/jwt";
import { redirectToPath } from "@/lib/redirect";
import { firstAccessibleRoute } from "@/lib/auth/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /bootstrap?next=/path
 *
 * The session entry point (there is no login form — ADR 0005). Reads the
 * forwarded email, gates it against `tb_usuarios`, and on success mints the
 * session cookie and redirects to `next`. On failure sends to /sem-acesso.
 * The middleware routes here whenever the cookie is missing/expired.
 *
 * `next` is only a request: a user sent here on the way to a screen their nível
 * does not reach lands on the closest one they do (the page gate in
 * `app/(app)/layout.tsx` still has the final say, since only it knows whether
 * the route is in the catalog at all). With no `next`, entry resolves to the
 * user's first page rather than to a hardcoded dashboard.
 */
export async function GET(req: NextRequest) {
  const nextParam = req.nextUrl.searchParams.get("next");
  // Only allow same-origin relative paths (guards against open redirects).
  const requested =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") && nextParam !== "/"
      ? nextParam
      : "";

  const email = getForwardedEmail();

  if (!email) {
    return redirectToPath("/sem-acesso");
  }

  let user;

  try {
    user = await authorizeByEmail(email);
  } catch (err) {
    // Databricks query failed — usually the app principal lacks access to the
    // table. Log the full error (no secrets in here) so the cause is visible.
    console.error("[bootstrap] tb_usuarios lookup failed:", err);

    return redirectToPath("/sem-acesso?erro=lookup");
  }

  if (!user) {
    return redirectToPath("/sem-acesso");
  }

  let token: string;

  try {
    token = await signSession(user);
  } catch (err) {
    console.error("[bootstrap] session signing failed:", (err as Error)?.message);

    return redirectToPath("/sem-acesso?erro=sessao");
  }

  const res = redirectToPath(requested || firstAccessibleRoute(user));

  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: getSessionTtlSeconds(),
  });

  return res;
}
