// Assemble the deployable Databricks Apps bundle from a `next build` with
// `output: 'standalone'`. Next emits .next/standalone/server.js with a pruned
// node_modules, but does NOT copy the static assets or public/ — we do that here,
// plus the app.yaml manifest, so `.next/standalone` is self-contained.
//
// Run after `next build` (see the `package:app` npm script).

import { cpSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const standalone = join(root, ".next", "standalone");

if (!existsSync(join(standalone, "server.js"))) {
  console.error("❌ .next/standalone/server.js not found. Run `next build` first (output: 'standalone').");
  process.exit(1);
}

function copy(from, to, label) {
  const src = join(root, from);
  if (!existsSync(src)) {
    console.warn(`• skip ${label}: ${from} not found`);
    return;
  }
  const dest = join(standalone, to);
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true });
  console.log(`• copied ${label}: ${from} → .next/standalone/${to}`);
}

// Next standalone serves these relative to server.js's directory.
copy(".next/static", ".next/static", "static assets");
copy("public", "public", "public/");
copy("app.yaml", "app.yaml", "Databricks Apps manifest");

console.log("\n✅ Bundle ready at .next/standalone — deploy this directory to Databricks Apps.");
