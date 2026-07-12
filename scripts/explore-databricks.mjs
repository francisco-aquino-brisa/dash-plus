// One-shot READ-ONLY catalog/schema/table explorer, used to map what the other
// screens (and the docs/CSVs) need against what actually exists in Databricks.
// Tolerant of permission errors. Run once: node scripts/explore-databricks.mjs
//
// No writes — only SHOW / DESCRIBE.

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
    return {
      host,
      path,
      authType: "databricks-oauth",
      oauthClientId: clientId,
      oauthClientSecret: clientSecret,
    };

  if (token) return { host, path, authType: "access-token", token };

  return { host, path, authType: "databricks-oauth", persistence: new FilePersistence() };
}

const CAT = "gdb_brisanet_comunidade_dev";

// Tables the docs/CSVs reference (full names). We try to DESCRIBE each.
const CANDIDATE_TABLES = [
  `${CAT}.projeto_brisa_performance.indicadores_cidades`,
  `${CAT}.projeto_brisa_performance.indicadores_cidades_5g`,
  `${CAT}.projeto_brisa_performance.vw_hc_zerado_vendedor`,
  `${CAT}.inteligencia_comercial_e_mercado.waves_consolidado_orcamento`,
  `${CAT}.inteligencia_comercial_e_mercado.indicadores_b2c`,
  `${CAT}.inteligencia_comercial_e_mercado.base_5g_ativa_churn`,
  `${CAT}.inteligencia_comercial_e_mercado.organograma_cidades`,
  `${CAT}.inteligencia_comercial_e_mercado.consolidado_5g_pedido`,
  `${CAT}.diego_barros_inteligencia_comercial_e_mercado.hc_folha`,
  `${CAT}.diego_barros_inteligencia_comercial_e_mercado.organograma_cidades`,
  `gdb_brisanet_comercial.gestao_clientes.relatorio_chamados_fidelizacoes`,
];

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
  const tryQ = async (label, sql) => {
    try {
      const rows = await q(sql);

      return { label, ok: true, rows };
    } catch (e) {
      return {
        label,
        ok: false,
        error: String(e?.message ?? e)
          .split("\n")[0]
          .slice(0, 160),
      };
    }
  };

  const argvTables = process.argv.slice(2);

  if (argvTables.length) {
    try {
      console.log("===== DESCRIBE (argv tables) =====");
      for (const full of argvTables) {
        const [c, s, t] = full.split(".");
        const d = await tryQ(full, `DESCRIBE TABLE \`${c}\`.\`${s}\`.\`${t}\``);

        if (!d.ok) {
          console.log(`\n## ${full}\n  NOT ACCESSIBLE — ${d.error}`);
          continue;
        }

        const cols = d.rows
          .filter((r) => r.col_name && !String(r.col_name).startsWith("#") && r.col_name !== "")
          .map((r) => `${r.col_name}:${r.data_type}`);
        console.log(`\n## ${full}  (${cols.length} cols)\n  ${cols.join(", ")}`);
      }
      console.log("\n✅ done (read-only).");
    } finally {
      await session.close();
      await client.close();
    }

    return;
  }

  try {
    console.log("===== CATALOGS =====");
    const cats = await tryQ("catalogs", "SHOW CATALOGS");
    console.log(
      cats.ok ? cats.rows.map((r) => r.catalog ?? Object.values(r)[0]).join(", ") : `ERR: ${cats.error}`,
    );

    for (const c of [CAT, "gdb_brisanet_comercial"]) {
      console.log(`\n===== SCHEMAS in ${c} =====`);
      const sc = await tryQ("schemas", `SHOW SCHEMAS IN \`${c}\``);
      console.log(
        sc.ok
          ? sc.rows.map((r) => r.databaseName ?? r.namespace ?? Object.values(r)[0]).join(", ")
          : `ERR: ${sc.error}`,
      );
    }

    for (const sch of [
      `${CAT}.inteligencia_comercial_e_mercado`,
      `${CAT}.projeto_brisa_performance`,
      `${CAT}.diego_barros_inteligencia_comercial_e_mercado`,
    ]) {
      console.log(`\n===== TABLES in ${sch} =====`);
      const t = await tryQ("tables", `SHOW TABLES IN \`${sch.split(".")[0]}\`.\`${sch.split(".")[1]}\``);
      console.log(t.ok ? t.rows.map((r) => r.tableName ?? r.table_name).join(", ") : `ERR: ${t.error}`);
    }

    console.log("\n===== DESCRIBE candidate tables =====");
    for (const full of CANDIDATE_TABLES) {
      const [c, s, t] = full.split(".");
      const d = await tryQ(full, `DESCRIBE TABLE \`${c}\`.\`${s}\`.\`${t}\``);

      if (!d.ok) {
        console.log(`\n## ${full}\n  NOT ACCESSIBLE — ${d.error}`);
        continue;
      }

      const cols = d.rows
        .filter((r) => r.col_name && !String(r.col_name).startsWith("#") && r.col_name !== "")
        .map((r) => `${r.col_name}:${r.data_type}`);
      console.log(`\n## ${full}  (${cols.length} cols)\n  ${cols.join(", ")}`);
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
