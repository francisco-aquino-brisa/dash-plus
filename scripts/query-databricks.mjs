// Generic READ-ONLY query runner over the app's Databricks connection (U2M token
// cache / SP / PAT, same as the other scripts). Prints rows as JSON.
//
// Usage:
//   node scripts/query-databricks.mjs "SELECT 1 AS x"
//   node scripts/query-databricks.mjs --file path/to/query.sql [--max 200]
//
// Refuses anything that isn't a read (SELECT/WITH/SHOW/DESCRIBE/EXPLAIN/VALUES/
// TABLE/USE) — same hard rule as the MCP guard. No writes, ever.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { FilePersistence } from "../lib/data/databricks-oauth-cache.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
function loadEnv() {
  try {
    const txt = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !line.trim().startsWith("#") && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {}
}
loadEnv();

const host = process.env.DATABRICKS_HOST;
const path = process.env.DATABRICKS_HTTP_PATH;
const clientId = process.env.DATABRICKS_SP_CLIENT_ID ?? process.env.DATABRICKS_CLIENT_ID;
const clientSecret = process.env.DATABRICKS_SP_CLIENT_SECRET ?? process.env.DATABRICKS_CLIENT_SECRET;
const token = process.env.DATABRICKS_TOKEN;

function connectionOptions() {
  if (clientId && clientSecret)
    return { host, path, authType: "databricks-oauth", oauthClientId: clientId, oauthClientSecret: clientSecret };
  if (token) return { host, path, authType: "access-token", token };
  return { host, path, authType: "databricks-oauth", persistence: new FilePersistence() };
}

const READ_OK = /^(SELECT|WITH|SHOW|DESCRIBE|DESC|EXPLAIN|VALUES|TABLE|USE)\b/i;
function assertReadOnly(sql) {
  const stripped = sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "").trim();
  if (!READ_OK.test(stripped)) {
    console.error("❌ Refused: not a read-only statement. Allowed: SELECT/WITH/SHOW/DESCRIBE/EXPLAIN/VALUES/TABLE/USE.");
    process.exit(2);
  }
}

function parseArgs() {
  const a = process.argv.slice(2);
  let sql = "";
  let max = 200;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "--file") sql = readFileSync(a[++i], "utf8");
    else if (a[i] === "--max") max = parseInt(a[++i], 10) || max;
    else sql += (sql ? " " : "") + a[i];
  }
  return { sql: sql.trim(), max };
}

async function main() {
  const { sql, max } = parseArgs();
  if (!sql) {
    console.error("Usage: node scripts/query-databricks.mjs \"SELECT …\"  |  --file q.sql [--max N]");
    process.exit(1);
  }
  assertReadOnly(sql);

  const mod = await import("@databricks/sql");
  const DBSQLClient = mod.DBSQLClient ?? mod.default?.DBSQLClient ?? mod.default;
  const client = new DBSQLClient();
  await client.connect(connectionOptions());
  const session = await client.openSession();
  try {
    const op = await session.executeStatement(sql, { runAsync: true, maxRows: max });
    const rows = await op.fetchAll();
    await op.close();
    console.log(JSON.stringify(rows.slice(0, max), null, 2));
    console.error(`✅ ${rows.length} row(s) (read-only).`);
  } finally {
    await session.close();
    await client.close();
  }
}

main().catch((e) => {
  console.error("❌", String(e?.message ?? e).split("\n").slice(0, 3).join(" | "));
  process.exit(1);
});
