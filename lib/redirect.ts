import { NextResponse } from "next/server";

/**
 * Redirect to a same-origin path using a RELATIVE `Location` header.
 *
 * Route handlers must NOT use `NextResponse.redirect(new URL(path, req.url))`.
 * On Databricks Apps the server is started as
 * `next start -H 0.0.0.0 -p $DATABRICKS_APP_PORT` (app.yaml), and Next builds
 * the request URL from that bind address rather than from the public host:
 * `initURL = ${x-forwarded-proto}://${-H host}:${port}${req.url}`
 * (next/dist/server/next-server.js → `attachRequestMeta`). So in production
 * `req.url` is `https://0.0.0.0:8000/…`, and any absolute redirect derived from
 * it sends the browser to an address it cannot reach.
 *
 * Next relativizes the `Location` of a *middleware* redirect for us
 * (`resolve-routes.js` → `relativizeURL`), but the equivalent code in the app
 * route handler module is commented out — so a route handler's `Location` goes
 * out verbatim. Hence this helper.
 *
 * A relative `Location` is valid per RFC 7231 §7.1.2 and resolves against the
 * host the browser actually used, so it is correct behind any proxy.
 *
 * MIDDLEWARE IS THE EXCEPTION: keep `new URL(path, req.url)` there. A relative
 * `Location` from middleware makes Next throw `TypeError: Invalid URL` while
 * normalizing the response (`web/adapter.js` → `new NextURL(redirect, …)`).
 */
export function redirectToPath(path: string): NextResponse {
  return new NextResponse(null, { status: 307, headers: { Location: path } });
}
