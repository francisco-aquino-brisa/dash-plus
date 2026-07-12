---
name: databricks-schema-sync
description: Keep the mock data, TypeScript types, and the data-team docs in sync whenever the real Databricks schema changes. Use this whenever MCP exploration reveals a schema drift — a new/renamed/dropped column, a new or removed table, a changed type, a new freshness/watermark signal, or a permission change (a blocked source becoming readable, or vice-versa). The mock MUST mirror the real schema so the DATA_SOURCE=mock|databricks swap stays transparent (CLAUDE.md "Data flow").
---

# Syncing schema changes into the app and the docs

When the real Databricks schema changes, several places drift out of date at
once. This skill is the checklist to bring them all back into agreement so that
(a) `DATA_SOURCE=databricks` keeps working, (b) `DATA_SOURCE=mock` mirrors the
real schema (so the swap stays transparent), and (c) the data-team docs still
describe reality.

## When this triggers

Apply this whenever exploring via the `databricks-readonly` skill (the scripts in
`scripts/`) surfaces any of:

- a **new column** on a table the app reads, or a **renamed / dropped** column;
- a **type change** (e.g. `string` → `decimal`, nullability);
- a **new or removed table**, or a table that became **stale** (watermark stops
  moving) or **fresh** again;
- a **new freshness / watermark** signal (e.g. a load-control table);
- a **permission change** — a previously blocked schema/table becomes readable
  (`PERMISSION_DENIED` gone) or a readable one gets revoked;
- a change in the **distinct values** that drive filter options (new UF, new
  canal, new tipo_cidade, etc.);
- a change to an indicator's **formula or semantics** in `ficha_indicadores`.

## The golden rule (from CLAUDE.md)

The mock **mirrors the real schema**. Never let the mock and the real adapter
describe different shapes — the whole point of `DATA_SOURCE` is a transparent
swap. And **docs are the source of truth** for indicator formulas: validate
against `ficha_indicadores` / the `docs/` CSVs+docx, not the prototype.

## What to update (in order)

Confirm the change first with the MCP (`get_table` / `DESCRIBE` / a bounded
`SELECT`), then update every layer that references it. For the two screens the
files are parallel:

**Per dataset (cities = Tela 1, sales = Tela 3):**

1. **Types** — `lib/data/<dataset>/types.ts`: the row/view types must match the
   real columns and the view-model the screen consumes.
2. **Real adapter** — `lib/data/<dataset>/databricks.ts`: fix the SQL
   (column names, casts, WHERE, aggregation) and `mapRow`. Keep dates inlined as
   `DATE'…'` and dimension filters parameterized (`?`). Blocked KPIs stay
   `available:false`.
3. **Mock** — `lib/data/<dataset>/mock.ts`: update the mock generator AND the
   filter lists (`*_FILTER_LISTS` / distinct-value arrays) so the mock produces
   the same shape and the same option universe as real.
4. **Repository** — `lib/data/<dataset>/repository.ts`: only if the cache key,
   the filter-options merge, or the watermark source changed.

**Cross-cutting:**

5. **Glossary** — `CONTEXT.md`: add/adjust any term whose meaning changed.
6. **Coverage doc (PT-BR, for the data team)** — `docs/databricks-coverage.md`:
   move items between "O que temos / bloqueado / divergências / o que falta",
   update the table/column lists, then **regenerate the PDF**:
   `node scripts/md-to-pdf.mjs docs/databricks-coverage.md`.
7. **Pending checklist** — `docs/pending-data-checklist.md`: check off what got
   unblocked, add anything newly missing.
8. **ADR 0002** — `docs/adr/0002-data-access-and-caching.md`: if the volume
   class (small/medium/large), the query strategy, or the watermark changed,
   update the "verified against real data" note.
9. **databricks-mcp skill** — `.claude/skills/databricks-mcp/SKILL.md`: tick off
   any "known-unknowns to close" that this change resolved.

## After updating

- `npx tsc --noEmit` and `npm run build` must stay clean.
- Sanity-check both modes: the screen must render under `DATA_SOURCE=mock` and
  under `DATA_SOURCE=databricks` (the real adapter falls back to mock on error,
  so confirm it isn't _silently_ falling back — check the server log for
  `[…] databricks failed, falling back to mock`).
- Keep every validation query bounded (`LIMIT`, small `max_rows`, filter by
  competência) — the warehouse is metered.

## Don't

- Don't change the mock shape without changing the real adapter (or vice-versa).
- Don't encode an indicator formula from the prototype — verify it in
  `ficha_indicadores` / the docs first.
- Don't send any write/DDL to Databricks (the read-only rule still applies).
