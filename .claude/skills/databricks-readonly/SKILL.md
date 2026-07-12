---
name: databricks-readonly
description: How to query the Brisanet Databricks warehouse — READ-ONLY — via the scripts in scripts/. Use when exploring catalogs/schemas/tables, inspecting real column schemas, validating SQL, pulling sample data for the dashboard (real verified objects: indicadores_cidades, indicadores_cidades_5g, metas_cidades, desempenho_hc, cadastro_usuario), or checking any Databricks config. The MCP was removed — always go through the scripts. Never write. Always verify an object exists before using it (see databricks-first).
---

# Querying Databricks (READ-ONLY, via scripts)

Databricks access goes through the **read-only scripts in `scripts/`**, which use
the app's own connection (`@databricks/sql` with the U2M OAuth token cache / SP /
PAT from `.env.local`). The `databricks` MCP was **removed** (its
`~/.databrickscfg` host was a placeholder) — do not add it back; use the scripts.

## Absolute rule: read-only

NEVER run `INSERT`, `UPDATE`, `DELETE`, `MERGE`, `DROP`, `CREATE`, `ALTER`,
`TRUNCATE`, `GRANT`, `REVOKE`, `COPY INTO`, `OPTIMIZE`, `VACUUM`, `REFRESH`,
`SET`, or any other write/DDL/DML statement.

Only these statement forms are permitted: `SELECT`, `WITH … SELECT`, `SHOW`,
`DESCRIBE`/`DESC`, `EXPLAIN`, `VALUES`, `TABLE`, `USE`.

Defense in depth: `scripts/query-databricks.mjs` refuses anything that isn't a
read (matches the allow-list above) before it reaches the warehouse; the
credential should also carry read-only grants only. Don't try to circumvent this.

## The scripts

- `node scripts/query-databricks.mjs "SELECT … LIMIT 50"` — run one read query;
  prints rows as JSON. Use `--file path/to/q.sql` for long SQL and `--max N` to
  cap rows (default 200). This is the primary tool.
- `node scripts/explore-databricks.mjs` — map catalogs → schemas → tables and
  DESCRIBE a candidate set (tolerant of permission errors). Pass full table names
  as args to DESCRIBE specific ones.
- `node scripts/describe-databricks.mjs` — schema of specific tables.
- `node scripts/test-databricks.mjs` — smoke-test the connection / auth.

The `@databricks/sql` driver prints `{"level":"info",…}` lines to stdout. When
you need clean JSON, strip them: `… 2>/dev/null | grep -v '^{"level"'`.

## How to work efficiently (and cheaply)

- **Explore top-down**: SHOW SCHEMAS → SHOW TABLES → DESCRIBE before writing SQL.
  Don't `SELECT *` to learn columns — use `DESCRIBE`.
- **Always bound result size**: small `--max`, add `LIMIT` to every `SELECT`,
  filter by `data`/competência, project only needed columns. The warehouse is
  metered — minimize scanned data.
- **Sample, then aggregate**: peek at a few rows to learn shapes, then write the
  real aggregate query.
- **Quote fully-qualified names**: `catalog.schema.table`.

## Known facts / locations

- Cities source: `gdb_brisanet_comunidade_dev.projeto_brisa_performance`
  (`indicadores_cidades`, `indicadores_cidades_5g`, `vw_hc_zerado_vendedor`,
  `ficha_indicadores`). Sales: `…diego_barros_inteligencia_comercial_e_mercado`
  (`desempenho_hc`). Overridable via the `DATABRICKS_*_CATALOG/_SCHEMA` env vars.
- `ficha_indicadores` is the source of truth for indicator formulas — columns
  `indicador_geral` / `indicador_servico` / `descricao_indicador` / `metrica` /
  `funcao` / `tabela` / `colunas` (there is **no** literal `formula` column; the
  formula lives in `metrica`).
- Some schemas are permission-denied (e.g. `inteligencia_comercial_e_mercado`,
  `gdb_brisanet_gd`) — those indicators stay blocked in the app.

After validating something against the warehouse, sync the app + docs with the
`databricks-schema-sync` skill, and keep `DATA_SOURCE=mock` working unchanged.
