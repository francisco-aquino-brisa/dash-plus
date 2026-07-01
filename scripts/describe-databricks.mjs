// One-shot READ-ONLY schema explorer: DESCRIBE + sample the cities objects so we
// can align lib/data/cities/types.ts and the SQL in databricks.ts to the real
// schema. Run once: node scripts/describe-databricks.mjs
//
// Reuses the same env + auth as test-databricks.mjs. No writes.

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
const catalog = process.env.DATABRICKS_CITIES_CATALOG ?? "gdb_brisanet_comunidade_dev";
const schema = process.env.DATABRICKS_CITIES_SCHEMA ?? "projeto_brisa_performance";

function connectionOptions() {
  if (clientId && clientSecret)
    return { host, path, authType: "databricks-oauth", oauthClientId: clientId, oauthClientSecret: clientSecret };
  if (token) return { host, path, authType: "access-token", token };
  return { host, path, authType: "databricks-oauth", persistence: new FilePersistence() }; // U2M
}

const OBJECTS = ["indicadores_cidades", "indicadores_cidades_5g", "vw_hc_zerado_vendedor"];

async function main() {
  const mod = await import("@databricks/sql");
  const DBSQLClient = mod.DBSQLClient ?? mod.default?.DBSQLClient ?? mod.default;
  const client = new DBSQLClient();
  await client.connect(connectionOptions());
  const session = await client.openSession();

  const q = async (sql) => {
    const op = await session.executeStatement(sql, { runAsync: true });
    const rows = await op.fetchAll();
    await op.close();
    return rows;
  };

  try {
    for (const obj of OBJECTS) {
      const fqn = `\`${catalog}\`.\`${schema}\`.\`${obj}\``;
      console.log(`\n================ ${obj} ================`);
      const cols = await q(`DESCRIBE TABLE ${fqn}`);
      const clean = cols.filter((c) => c.col_name && !String(c.col_name).startsWith("#") && c.col_name !== "");
      console.log("COLUMNS:");
      for (const c of clean) console.log(`  ${c.col_name}\t${c.data_type}`);
      const sample = await q(`SELECT * FROM ${fqn} LIMIT 2`);
      console.log("SAMPLE (2 rows):");
      console.log(JSON.stringify(sample, null, 2));
    }
    console.log("\n✅ done (read-only).");
  } finally {
    await session.close();
    await client.close();
  }
}

main().catch((e) => {
  console.error("❌", e?.message ?? e);
  process.exit(1);
});
