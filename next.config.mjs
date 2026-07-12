/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output so Databricks Apps can run `node server.js` (see ADR 0001).
  output: "standalone",
  reactStrictMode: true,
  experimental: {
    // The Databricks driver has native deps (lz4) that must not be bundled by
    // webpack — load them at runtime via Node's require instead.
    serverComponentsExternalPackages: ["@databricks/sql", "lz4"],
  },
};

export default nextConfig;
