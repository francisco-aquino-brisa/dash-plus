// Standalone Databricks connectivity smoke test (READ-ONLY).
// Usage: node scripts/test-databricks.mjs
//
// Loads .env.local, connects to the SQL Warehouse via @databricks/sql using
// OAuth M2M (service principal) — PATs are disabled org-wide — and runs a few
// read queries against projeto_brisa_performance. No writes.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { FilePersistence } from "../lib/data/databricks-oauth-cache.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Minimal .env.local loader (no dependency).
function loadEnv() {
  try {
    const txt = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);

      if (m && !line.trim().startsWith("#") && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* no .env.local — rely on real env */
  }
}
loadEnv();

const host = process.env.DATABRICKS_HOST;
const path = process.env.DATABRICKS_HTTP_PATH;
const clientId = process.env.DATABRICKS_SP_CLIENT_ID;
const clientSecret = process.env.DATABRICKS_SP_CLIENT_SECRET;
const token = process.env.DATABRICKS_TOKEN;
const catalog = process.env.DATABRICKS_CITIES_CATALOG ?? "gdb_brisanet_comunidade_dev";
const schema = process.env.DATABRICKS_CITIES_SCHEMA ?? "projeto_brisa_performance";

function fail(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

const u2m = process.env.DATABRICKS_AUTH === "oauth-u2m";

if (!host) fail("DATABRICKS_HOST is not set in .env.local");

if (!path) fail("DATABRICKS_HTTP_PATH is not set (SQL Warehouse → Connection details → HTTP path)");

if (!token && !(clientId && clientSecret) && !u2m)
  fail(
    "No auth: set DATABRICKS_SP_CLIENT_ID + DATABRICKS_SP_CLIENT_SECRET (M2M), or DATABRICKS_AUTH=oauth-u2m (browser login)",
  );

function connectionOptions() {
  if (clientId && clientSecret) {
    return {
      host,
      path,
      authType: "databricks-oauth",
      oauthClientId: clientId,
      oauthClientSecret: clientSecret,
    };
  }

  if (token) {
    return { host, path, authType: "access-token", token };
  }

  // U2M: interactive browser login as the current user (token cached to file).
  return { host, path, authType: "databricks-oauth", persistence: new FilePersistence() };
}

async function main() {
  const mod = await import("@databricks/sql");
  const DBSQLClient = mod.DBSQLClient ?? mod.default?.DBSQLClient ?? mod.default;

  console.log(`→ Connecting to ${host}${path}`);
  console.log(
    `  auth: ${clientId && clientSecret ? "OAuth M2M (service principal)" : token ? "PAT" : "OAuth U2M (browser login)"}`,
  );

  if (u2m) console.log("  (a browser window will open for you to sign in)");

  const client = new DBSQLClient();
  await client.connect(connectionOptions());
  const session = await client.openSession();

  const run = async (label, sql) => {
    const op = await session.executeStatement(sql, { runAsync: true });
    const rows = await op.fetchAll();
    await op.close();
    console.log(`\n✓ ${label}`);

    return rows;
  };

  try {
    await run("SELECT 1", "SELECT 1 AS ok");

    const tables = await run("SHOW TABLES", `SHOW TABLES IN \`${catalog}\`.\`${schema}\``);
    console.log("  tables:", tables.map((t) => t.tableName ?? t.table_name ?? JSON.stringify(t)).join(", "));

    for (const tbl of ["indicadores_cidades", "indicadores_cidades_5g"]) {
      const cnt = await run(
        `COUNT ${tbl}`,
        `SELECT COUNT(*) AS n, MAX(data) AS max_data FROM \`${catalog}\`.\`${schema}\`.\`${tbl}\``,
      );
      console.log(`  ${tbl}:`, JSON.stringify(cnt[0]));
    }

    console.log("\n✅ Databricks connection OK (read-only).\n");
  } finally {
    await session.close();
    await client.close();
  }
}

main().catch((e) => fail(`Connection/query failed: ${e?.message ?? e}`));
