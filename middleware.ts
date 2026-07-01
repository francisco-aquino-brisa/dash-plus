import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth/jwt";

/**
 * Protects the app routes by validating the session JWT (httpOnly cookie).
 *
 * - No session + accessing a protected route → redirect to /login.
 * - Session present + accessing /login → send to /dashboard.
 * - `/` → redirect based on session state.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);

  if (pathname === "/login") {
    if (session) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL(session ? "/dashboard" : "/login", req.url));
  }

  // Any other route matched by the matcher is protected.
  if (!session) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Match everything except: api, _next/static, _next/image, favicon and files with an extension.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
