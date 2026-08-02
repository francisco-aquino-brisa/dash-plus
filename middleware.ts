import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth/jwt";

/**
 * Edge gate (ADR 0005). There is no login form: identity is resolved by the
 * Node-only `/bootstrap` route, which mints the session cookie. The middleware
 * only verifies that cookie (jose is Edge-safe; it cannot query Databricks).
 *
 * - No/invalid session → send to `/bootstrap?next=…` (which resolves + mints).
 * - Valid session + `/admin/*` but not admin → bounce to /dashboard.
 * - `/` → /dashboard.
 */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Entry point and the access-denied page must always pass through.
  if (pathname === "/bootstrap" || pathname === "/sem-acesso") {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);

  if (!session) {
    const next = pathname === "/" ? "/dashboard" : `${pathname}${search}`;
    const url = new URL("/bootstrap", req.url);

    url.searchParams.set("next", next);

    return NextResponse.redirect(url);
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Admin area is gated by the isAdmin claim — no query needed.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (!session.isAdmin) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  // Match everything except: api, _next/static, _next/image, favicon and files with an extension.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
