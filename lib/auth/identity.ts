import { headers } from "next/headers";

/**
 * Resolve the authenticated user's email without a login form (ADR 0005).
 *
 * In production the app runs behind Databricks Apps, which authenticates the
 * user at the edge and forwards their email in `X-Forwarded-Email`. That header
 * is trusted ONLY in production (the platform sets and strips it). In dev there
 * is no platform, so a `DEV_USER_EMAIL` env var stands in — never in production.
 */
export function getForwardedEmail(): string | null {
  const fromHeader = headers().get("x-forwarded-email");

  if (fromHeader) return fromHeader.trim().toLowerCase();

  if (process.env.NODE_ENV !== "production") {
    const dev = process.env.DEV_USER_EMAIL;

    if (dev) return dev.trim().toLowerCase();
  }

  return null;
}
