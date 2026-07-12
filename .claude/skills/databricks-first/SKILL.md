---
name: databricks-first
description: MANDATORY guardrail — Databricks is the source of truth. Before writing, changing, or documenting ANY table, view, column, indicator, meta, join key, or SQL, you MUST verify it exists in the warehouse via the read-only scripts. Never rely on the code, comments, docs, prototypes, or memory as evidence a data object exists. Use whenever touching data access, adapters (lib/data/**/databricks.ts), indicator definitions, docs about data, or the mock. Real data is the default source; mock is opt-in only.
---

# Databricks-first — verify before you create

**The warehouse is the only source of truth for what data exists.** The codebase,
its comments, `CLAUDE.md`, `docs/`, the prototypes, and your own memory are NOT
evidence. They drift, contain renamed/removed objects, and have been wrong before
(e.g. `vw_hc_zerado_vendedor` and `ficha_indicadores` are referenced across the
code/docs but **do not exist** in the warehouse; `metas_cidades.formato_dado`
says "Qtd" for a value that is actually a rate).

## The rule (non-negotiable)

Before you write, edit, or document anything that names a **catalog, schema,
table, view, column, `id_indicador`, meta, join key, or a SQL query**, you MUST
first confirm it against Databricks using the read-only scripts (see the
`databricks-readonly` skill). No exceptions, even for a "one-line" change or
something that "obviously" exists.

Concretely, before claiming/using a data object:

1. **Does it exist?** — existence + type (TABLE vs VIEW):
   ```
   node scripts/query-databricks.mjs "SELECT table_catalog, table_schema, table_name, table_type FROM system.information_schema.tables WHERE table_name = '<name>'"
   ```
   `system.information_schema` spans every accessible catalog — use it so you
   don't assume the wrong catalog.
2. **Do the columns exist?** — never trust the SELECT list in the code:
   ```
   node scripts/query-databricks.mjs "SELECT column_name FROM <catalog>.information_schema.columns WHERE table_schema='<schema>' AND table_name='<table>' ORDER BY 1"
   ```
   Or diff the columns your code uses against the real set (LEFT JOIN pattern).
3. **Is the value what you think?** — inspect `MIN`/`MAX`/`AVG`/sample before
   assuming a meta is a quantity vs a rate, a % is a fraction vs points, etc.
4. **Does the number match?** — when reproducing an indicator, run the aggregation
   in SQL and confirm it equals what the UI shows, for a stated competência.

If an object is missing, say so plainly and stop — do not invent a substitute or
guess a rename. Surface the gap (and the closest real candidate, clearly labeled
as unverified) and ask.

## Source of truth: Databricks by default, mock only on request

- The app defaults to **`DATA_SOURCE=databricks`**. `lib/data/client.ts` treats
  anything other than the literal `mock` as Databricks.
- Only use the mock when the user **explicitly asks** for it. The mock exists to
  mirror the real schema for a transparent swap — it is never the reference for
  correctness. Numbers are validated against Databricks.
- Keep the mock schema in sync with the verified real schema (see
  `databricks-schema-sync`) whenever you confirm a drift.

## Graceful degradation — try, and if it's not there, show "sem acesso"

Every independent data block must be **isolated**. Wrap each source read in a
`try/catch` (or guard on the object/column existing). If the source is missing or
the query fails, render that block as **"Sem acesso aos dados"** / empty — it must
**never** take the whole screen down, and it must **never** silently fall back to
mock. This is the same principle as the blocked indicator cards on Cities.

Rules:
- Isolate per block, not per screen — a missing PDU/portabilidade must not kill
  the funnel or the base cards next to it.
- Failure of an **optional/possibly-absent** source → degrade to "sem acesso".
- A core source that genuinely should exist → still surface the error (don't mask
  a real regression); but scope it so unrelated blocks keep rendering.
- Fan-outs (`Promise.all`) must not let one block's rejection fail the rest —
  isolate each thunk.

Pattern:
```ts
async function pduSeries(...): Promise<PduPoint[]> {
  try {
    /* query + shape */
    return series;
  } catch (e) {
    console.warn("[screen] PDU indisponível (fonte ausente no Databricks):", (e as Error).message);
    return []; // block renders as "sem acesso", screen stays up
  }
}
```
Already applied to: PDU (sales/produtividade/vendedor), 5G + metas reads on Cities.
Apply the same to any new block that reads a source which may not exist.

## When documenting data

Everything in `docs/data-map.md` and similar must be traceable to a query you
actually ran. If you can't verify a claim against the warehouse, do not write it
as fact — mark it explicitly as unverified.
