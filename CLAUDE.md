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

## Indicator definitions — docs are the source of truth

The data team's documents are authoritative for every indicator's formula and
semantics: the CSVs/docx in `docs/` and the `ficha_indicadores` table
(`projeto_brisa_performance.ficha_indicadores`, with `tabela`/`colunas`/`metrica`/
`formula`). **Always follow those over the prototype's approximations** — the
prototypes are visual references only. Example: PDU uses the official
`pdu_acumulada_hc_ativo = total_realizado / hc_ativos / MÁX(dias_uteis_acumulado)`
from `vw_hc_zerado_vendedor`, not a simpler total/day. When a doc and a prototype
disagree on a number, the doc wins; when in doubt, check `ficha_indicadores`.

## Data flow

The app reads via `DATA_SOURCE=mock|databricks`. Keep mock mode working; the mock
mirrors the real `indicadores_cidades` schema so the swap stays transparent.
