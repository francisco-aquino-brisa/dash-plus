import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth/jwt";
import { firstAccessibleRoute, isAdminRoute } from "@/lib/auth/routes";

/**
 * Edge gate (ADR 0005 / 0007). There is no login form: `/bootstrap` (Node) mints
 * the cookie; this only verifies it, since jose is Edge-safe but Databricks is
 * not reachable from here.
 *
 * The per-page gate runs in `app/(app)/layout.tsx` instead: deciding it needs the
 * page catalog, and "outside the catalog stays open" is a distinction the Edge
 * cannot make without a query. `x-pathname` is forwarded so that layout knows
 * which page was asked for.
 *
 * Redirects keep the absolute `new URL(path, req.url)` form: Next relativizes a
 * middleware `Location`, and a relative one makes it throw `Invalid URL`. Route
 * handlers are the opposite case and must use `redirectToPath` (lib/redirect.ts).
 */ export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Entry point, access-denied, logout and the re-entry screen always pass
  // through (the last two are the logged-out state — no session by design).
  if (
    pathname === "/bootstrap" ||
    pathname === "/sem-acesso" ||
    pathname === "/logout" ||
    pathname === "/entrar"
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);

  if (!session) {
    const next = pathname === "/" ? "/" : `${pathname}${search}`;
    const url = new URL("/bootstrap", req.url);

    url.searchParams.set("next", next);

    return NextResponse.redirect(url);
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL(firstAccessibleRoute(session), req.url));
  }

  // Admin area is gated by the isAdmin claim — no query needed.
  if (isAdminRoute(pathname) && !session.isAdmin) {
    return NextResponse.redirect(new URL(firstAccessibleRoute(session), req.url));
  }

  // Next does not pass the path to layouts, and that is where the page gate runs.
  const headers = new Headers(req.headers);

  headers.set("x-pathname", pathname);

  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Match everything except: api, _next/static, _next/image, favicon and files with an extension.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
