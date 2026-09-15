import { SESSION_COOKIE } from "@/lib/auth/jwt";
import { redirectToPath } from "@/lib/redirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /logout — clears the session cookie and sends the user to the re-entry
 * screen. There is no password to forget (ADR 0005): the platform still forwards
 * the identity, so "sair" means dropping the app's own token; re-entry re-mints it.
 */
export async function GET() {
  const res = redirectToPath("/entrar");

  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return res;
}
