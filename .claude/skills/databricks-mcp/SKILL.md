---
name: databricks-mcp
description: How to query the Brisanet Databricks warehouse via the databricks MCP server — READ-ONLY. Use when exploring catalogs/schemas/tables, inspecting real column schemas, validating SQL, or pulling sample data for the dashboard (e.g. indicadores_cidades, metas, organograma_cidades). Never write.
---

# Using the Databricks MCP (READ-ONLY)

The `databricks` MCP server connects to Brisanet's Databricks workspace. It is for
**reading only** — exploring the data model and validating queries while we wire
the dashboard to real data.

## Absolute rule: read-only

NEVER send `INSERT`, `UPDATE`, `DELETE`, `MERGE`, `DROP`, `CREATE`, `ALTER`,
`TRUNCATE`, `GRANT`, `REVOKE`, `COPY INTO`, `OPTIMIZE`, `VACUUM`, `REFRESH`,
`SET`, or any other write/DDL/DML statement.

Only these statement forms are permitted: `SELECT`, `WITH … SELECT`, `SHOW`,
`DESCRIBE`/`DESC`, `EXPLAIN`, `VALUES`, `TABLE`, `USE`.

This is enforced three ways (defense in depth):
1. A `PreToolUse` hook (`.claude/hooks/databricks-readonly-guard.mjs`) that
   **deterministically blocks** any non-read statement before it reaches the MCP.
2. The credential (`~/.databrickscfg` profile `brisa`) should have **only read
   grants** (`USE CATALOG/SCHEMA`, `SELECT`).
3. This instruction.

Do not try to circumvent the guard. If a query is blocked, it is because it was
classified as a write — rewrite it as a read.

## Available tools

- `mcp__databricks__list_catalogs` — list catalogs.
- `mcp__databricks__list_schemas` — `{ catalog }` → schemas.
- `mcp__databricks__list_tables` — `{ catalog, schema, table_name_pattern?, max_results? }`.
  Set `omit_columns:false` to see column types.
- `mcp__databricks__get_table` — `{ full_name: "catalog.schema.table" }` → full
  schema + properties for one table. Prefer this to inspect a single table.
- `mcp__databricks__execute_sql` — `{ statement, max_rows?, warehouse_id?,
  execution_timeout_seconds? }` → `{ columns, rows }`. Read-only (guarded).
- `mcp__databricks__list_warehouses` — only if you must target a specific warehouse.

## How to work efficiently (and cheaply)

- **Explore top-down**: `list_schemas` → `list_tables` → `get_table` before writing
  any SQL. Don't `SELECT *` to learn columns — use `get_table` / `DESCRIBE`.
- **Always bound result size**: keep `max_rows` small (e.g. 20–100) and add
  `LIMIT` to every `SELECT`. This is an executive dashboard on a metered
  warehouse — minimize scanned data (filter by `data`/competência, avoid full
  scans, project only needed columns).
- **Sample, then aggregate**: peek at a few rows to learn shapes, then write the
  real aggregate query.
- **Quote fully-qualified names**: `catalog.schema.table`.

## This project's known-unknowns to close (see CONTEXT.md / ADRs)

Catalog/schema in use: `gdb_brisanet_comunidade_dev.projeto_brisa_performance`
(overridable via `DATABRICKS_CITIES_CATALOG` / `_SCHEMA`).

1. **Real columns of `indicadores_cidades` and `indicadores_cidades_5g`** — verify
   names/types against `lib/data/cities/types.ts` and the provisional SQL in
   `lib/data/cities/databricks.ts`. Use `get_table`.
2. **`organograma_cidades` join keys** — confirm `id_cidade`, `gerencia`,
   `coordenacao`, `tipo_cidade` (ONLY/HÍBRIDA/FTTH), `uf`.
3. **Metas source** — find the real table/columns for targets per
   cidade × indicador × competência; today it is mocked.
4. **Watermark** — confirm `MAX(data)` (or a load-control table) is the right
   freshness signal.

After validating, update `lib/data/cities/databricks.ts` (the SQL + `mapRow`) and
`CONTEXT.md` / ADRs accordingly. Keep `DATA_SOURCE=mock` working unchanged.
