// Content-Security-Policy. Next.js injects inline bootstrap/hydration scripts and
// the charts use inline styles, so script/style-src keep 'unsafe-inline' (a strict
// nonce setup is out of scope here); the value still locks down framing, base-uri,
// form targets and plugins — the parts that matter for this internal dashboard.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "form-action 'self'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "connect-src 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output so Databricks Apps can run `node server.js` (see ADR 0001).
  output: "standalone",
  reactStrictMode: true,
  // Don't advertise the framework/version to attackers.
  poweredByHeader: false,
  experimental: {
    // The Databricks driver has native deps (lz4) that must not be bundled by
    // webpack — load them at runtime via Node's require instead.
    serverComponentsExternalPackages: ["@databricks/sql", "lz4"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
