---
name: code-style
description: Code style & conventions for Brisa Dash — how to write and format code so it stays consistent. Use whenever writing or reviewing TypeScript/React/CSS in this repo: formatting (Prettier/ESLint, the gate), spacing rules (blank lines around return/if/try), naming, language (pt-BR UI vs English code), design tokens, component/data-layer structure, SQL safety (parameterize inputs, never interpolate — the SQL-injection guard), imports, comments. Complements databricks-first (data), verify-ui (verification), frontend-design (visual) and vercel-react-best-practices (perf).
---

# Code style & conventions

Consistency is enforced two ways: **tooling** (mechanical) and **conventions**
(judgment). Never hand-fight the tooling; do follow the conventions it can't check.

## Formatting is Prettier's job — don't hand-format

- **Prettier** owns formatting (`.prettierrc.json`: printWidth 110, double quotes,
  semicolons, trailing commas, 2-space indent, `prettier-plugin-tailwindcss` to
  order Tailwind classes). Never manually align/space code or reorder className.
- **ESLint** = `next/core-web-vitals` + `eslint-config-prettier` (turns off rules
  that fight Prettier). We deliberately do **not** use `eslint-plugin-prettier`
  (Prettier's own guidance — keep formatting and linting separate).
- **Commands:** `npm run format` (write) · `npm run format:check` · `npm run check`
  (`prettier --check` + `next lint` + `tsc`, the gate before wrapping up). A Husky
  `pre-commit` runs `lint-staged` (`eslint --fix` then `prettier --write` on staged
  files); `.vscode/` does format-on-save.
- After editing, run `npm run format` (and `next lint --fix` for the spacing rules
  below) so you never leave hand-formatted code behind.

## Statement spacing (enforced by ESLint `padding-line-between-statements`)

Prettier does NOT manage blank lines, so these are ESLint rules (auto-fixable).
Breathing room around control flow:

- **Blank line before every `return`** (unless it's the first statement).
- **Blank line before and after every `if`** (skipped when the `if` is the first
  statement in its block).
- **Blank line before `try`** (unless the `try` is the only statement in the function).
- **Blank line after a `const`/`let`/`var` block** before the next non-declaration
  statement. Consecutive declarations stay grouped (no blank between them) — the
  break separates the "setup" vars from the logic that uses them.
- **Blank line before and after a multiline block** (`multiline-block-like`):
  `if`/`for`/`while`/`switch`/`try` bodies **and** `const fn = () => { … }`
  arrow/function blocks that span multiple lines. So multiline `const` function
  assignments (e.g. sequential handlers) each get breathing room.

```ts
async function example(x: number) {
  const rows = await load(x);
  const r = rows[0] ?? {};

  if (!r) return null;

  const [start, end] = pick(rows);

  save({ start, end });

  return shape(r);
}

const onDown = (e: Evt) => {
  dragging.current = true;
};

const onMove = (e: Evt) => {
  if (!dragging.current) return;

  update(e);
};
```

Don't add these by hand — `next lint --fix` applies them.

## Alignment: open and close at the same indent

What opens on a line must close at the **same alignment**. Prettier handles this
for normal calls; the trap is wrapping an expression around a multiline template
(SQL). Never write `(await q(\`…\`))[0]` — the SQL body breaks the alignment.
Extract to a named const instead:

```ts
// bad — the `(` and `)[0]` drift around the SQL block
const r = (await q(`SELECT …`))[0] ?? {};

// good
const rows = await q(`SELECT …`);
const r = rows[0] ?? {};
```

## SQL: parameterize every input, never interpolate

Hard security rule — this is the SQL-injection guard for the data layer.

- **Every request-derived value** (dates, ids, filters, `matricula`, `competencia`,
  `servico`, `mode`, `cidade`, `gerente`, …) MUST reach a query as a `?` ordinal
  parameter (the driver's `ordinalParameters`) — **never** string-concatenated or
  template-interpolated into the SQL. Push it onto the `params: unknown[]` array.
- **Only code-owned constants may be interpolated:** env-derived catalog/schema/
  table names (backtick-wrapped) and column names chosen from an **internal
  whitelist** (`FUNNEL_COLS`, `grupoCol`, `metricCol`). Never a value that came from
  `searchParams` or the request body.
- **Dates are the classic trap.** The funnel windows inline them into `DATE'…'`
  literals, so a request date MUST first pass `safeIsoDate()` (`lib/data/_shared.ts`),
  which returns a validated `yyyy-MM-dd` or `null` → fall back to a default. Do
  **not** trust `new Date(x).toISOString()` as the sanitizer — it throws on garbage
  and drifts silently; validate the format explicitly.
- When you add a new filter/param to an adapter and catch yourself writing
  `` `… ${value} …` `` where `value` is not a proven constant, **stop** — parameterize
  it, or (for enum-like fields) map it through an internal lookup.

```ts
// bad — request value interpolated straight into the SQL
`WHERE data BETWEEN DATE'${f.from}' AND DATE'${f.to}' AND gerente = '${f.gerente}'`;

// good — dates laundered via safeIsoDate at the source; dimension filters as `?`
const params: unknown[] = [];

if (f.gerente) (clauses.push("gerente = ?"), params.push(f.gerente));

// f.from/f.to already passed safeIsoDate() in resolve*Period(); columns are constants
`WHERE data BETWEEN DATE'${p.from}' AND DATE'${p.to}'${clauses.length ? ` AND ${clauses.join(" AND ")}` : ""}`;
```

## Language: pt-BR in the UI, English in the code

- **User-facing copy** (labels, headings, tooltips, empty/error states) is **pt-BR**
  (see CONTEXT.md for canonical terms).
- **Identifiers, comments, commit messages, docs are English.** Computed/invented
  identifiers (view-model fields, functions, locals) use English: `target` (not
  `meta`), `attainment` (not `atingimento`), `average` (not `media`), `projected`
  (not `projecao`), `result` (not `resultado`).
- **Exception — fields that mirror a Databricks column stay in their warehouse
  (pt-BR) spelling**, so the code maps 1:1 to the source and stays verifiable
  (`base_ativa`, `cancelamentos`, `gerencia`, `competencia`, `metas_cidades.meta`,
  `id_indicador`, `servico`). Don't rename these — the SQL and the type must match
  the warehouse. Ubiquitous domain words (`crescimento`, `Banda Larga`) also stay pt-BR.

## Naming

- `camelCase` vars/functions, `PascalCase` components/types, `UPPER_SNAKE` module
  constants, `kebab-case` filenames except React components (`CityIndicatorCard.tsx`).
- Names say what/why, not how; prefer domain words that match CONTEXT.md.

## Styling: tokens, not raw values

- Style with the **OKLch design tokens** — **never raw hex**. Reuse the shadcn
  primitives in `components/ui` and the recurring patterns. Read README.md before
  building/restyling UI.
- Keep client components thin: heavy fetch + KPI math on the server, client gets a
  small view-model (ADR 0002).

## Imports & structure

- Order: React/Next, then third-party, then `@/…` aliases, then relative.
- One screen = a route in `app/(app)/…` + a `lib/data/<domain>/` layer
  (`types` · `repository` (mock/databricks switch) · `databricks` · `mock` ·
  `compute`). Follow that shape for new screens.

## Comments

Match the surrounding density. Explain the **why** (business rule, warehouse
quirk, ADR reference), not the obvious what. Keep the short, pointed comments this
codebase favors.

## Cross-refs

- Data objects — verify against Databricks, degrade missing blocks to "sem acesso":
  `databricks-first`.
- Verifying UI + login/preview protocol: `verify-ui`.
- Visual direction: `frontend-design`. React/Next performance:
  `vercel-react-best-practices`.
