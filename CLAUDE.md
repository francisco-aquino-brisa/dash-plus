# Brisa Dash — agent rules

Executive dashboard for Brisanet on Databricks Apps (Next.js). See
[CONTEXT.md](./CONTEXT.md) for the domain glossary and [docs/adr/](./docs/adr/)
for architecture decisions. **Before building or restyling any UI, read
[README.md](./README.md) — it documents the stack, the design system (OKLch
tokens, typography, shadcn primitives) and the recurring component patterns.
Style with tokens (never raw hex), reuse the shared primitives, and keep
user-facing copy in pt-BR.**

## Databricks access is READ-ONLY — hard rule

Databricks access goes through the **read-only scripts in `scripts/`** (they use
the app's own connection — `@databricks/sql` with the U2M token cache / SP / PAT
from `.env.local`). The `databricks` MCP has been **removed** (its
`~/.databrickscfg` host was a placeholder). To inspect catalogs/schemas/tables,
validate SQL, sample data, or check any Databricks config, use the scripts —
**never** add the MCP back or invent another write path.

Primary tool: `node scripts/query-databricks.mjs "SELECT …"` (or `--file q.sql`).
It self-enforces read-only and prints rows as JSON. Also: `explore-databricks.mjs`
(catalog/schema/table map), `describe-databricks.mjs`, `test-databricks.mjs`.

**NEVER** run a statement that writes or changes anything — no `INSERT`,
`UPDATE`, `DELETE`, `MERGE`, `DROP`, `CREATE`, `ALTER`, `TRUNCATE`, `GRANT`,
`REVOKE`, `COPY INTO`, `OPTIMIZE`, `VACUUM`, `REFRESH`, `SET`, etc. Only
`SELECT` / `WITH…SELECT` / `SHOW` / `DESCRIBE` / `EXPLAIN` / `VALUES` / `TABLE` /
`USE` are allowed. `query-databricks.mjs` refuses anything else; the warehouse
credential should also carry read-only grants only. For how to use these well,
see the `databricks-readonly` skill.

Keep every query bounded (`LIMIT`, small `max_rows`, filter by competência) — the
warehouse is metered and cost matters.

## Visual verification (browser)

Before claiming a UI change works or describing what a page renders, check whether
a **Claude Code browser integration / browser-automation tool is available** in
the session (a browser MCP, the Claude Code browser extension, or similar). If it
is, **use it to open the page and inspect what actually rendered** (the live DOM /
the accessed page) instead of inferring from source or curl'd HTML — this is
especially important for interactive/hover/collapsed states that don't appear in
server HTML. If no such tool is available, say so explicitly and ask the user to
verify visually, rather than implying it was visually confirmed.

## Indicator definitions — the warehouse is the source of truth

Verify every indicator against Databricks — never against code/comments/memory
(see the `databricks-first` skill). The indicator catalog lives in the
**`metas_cidades`** view (`projeto_brisa_performance.metas_cidades`), which carries
`id_indicador`/`servico`/`meta` plus `tabela`/`colunas`/`metrica`/
`descricao_indicador`/`formato_dado`/`polaridade`. Follow it (and the data-team
docs in `docs/`) over the prototype's approximations — prototypes are visual
references only. When a source and a prototype disagree on a number, verify the
number in SQL and the source wins.

Caveats confirmed against the warehouse (do not trust older docs that say
otherwise): **`ficha_indicadores` does not exist** — use `metas_cidades`. The
**PDU source `vw_hc_zerado_vendedor` does not exist** either, and its
`total_realizado` column exists nowhere, so the PDU is currently broken. See
[docs/data-map.md](./docs/data-map.md) for the full verified status.

## Data flow

**Databricks is the default source of truth.** `isDatabricks()` returns true
unless `DATA_SOURCE=mock` — the mock is opt-in only, used when explicitly
requested. The mock must mirror the verified real schema so the swap stays
transparent, but numbers are always validated against Databricks (see the
`databricks-first` skill).

For the full table-by-table map — which schema each screen reads, the Cities
cubes (`indicadores_cidades`, `indicadores_cidades_5g`, `metas_cidades`), the
join keys (`id_cidade`/`id_indicador`/`servico`), aggregation rules, the
indicator→source map and the known gotchas — see [docs/data-map.md](./docs/data-map.md).
