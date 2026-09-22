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

## Permissionamento — o gate é por página e por capacidade

Uma tela aparece no menu e pode ser aberta quando o nível do usuário tem **ao
menos uma permissão daquela página** (`tb_permissoes.pagina_id` → `tb_paginas.rota`).
Já `/admin/*` é gateado só pelo claim `isAdmin`, nunca pelo catálogo, e uma rota
que não está em `tb_paginas` fica liberada. Os grants viajam no cookie de sessão
(`caps`/`rotas`, resolvidos no `/bootstrap`), então valem a partir do próximo
acesso do usuário. Ver [ADR 0007](./docs/adr/0007-page-and-capability-permissions.md).

Para gatear um card/botão/campo: a sustentação cria a permissão em
`/admin/capacidades`, você adiciona o label **exato** em `lib/auth/capabilities.ts`
e usa `<Can cap={CAP.X}>` (cliente) ou `await can(CAP.X)` (servidor). O label é
identificador, não legenda — renomear desliga o gate em silêncio.

**Esconder o controle não é a checagem.** Toda server action gateada chama
`can()` por conta própria, e um card cujos _dados_ são restritos não pode ser
renderizado no servidor. Rotas `/api/*` usam `requirePageSession(rota)` ou
`requireCap(label)` (`lib/auth/api.ts`) — o middleware não cobre `/api`.

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

## Dates: "hoje" is a Brazilian calendar day

**Never** derive a calendar date from `new Date().toISOString()` or from a
`Date`'s local getters. `toISOString()` is UTC, so from 21:00 in Brazil it
already reports tomorrow; the Databricks Apps server runs on UTC, so reading its
local clock is no better. Use the helpers in `lib/data/_shared.ts`, which pin the
day to `America/Sao_Paulo`:

- `todayIso()` → today in Brazil, `yyyy-MM-dd`
- `todayUtc()` → the same day as a Date at **UTC midnight**
- `parseIsoUtc` / `isoUtc` / `addDaysUtc` / `startOfMonthUtc` → calendar
  arithmetic that stays in UTC

Calendar dates are UTC-midnight `Date`s. Never mix them with `new Date(y, m, d)`,
`setDate` or `getDate` — those shift with the runner's zone; read components with
the `getUTC*` form.

**Client components are the exception**: there the browser's zone is the user's,
so `lib/date.ts` (`toIso`/`fromIso`) is correct as-is and must stay local.

## Comments — the default is NO comment

This codebase is over-commented and is being cleaned up. Do not add to the pile,
and never "match the surrounding density" — that is the habit that produced it.

Before writing any comment, ask: **would a competent reader get this wrong
without it?** If not, do not write it. The bar is a real trap — a business rule
that is not visible in the code, a warehouse quirk, a workaround whose removal
would break something, a decision that looks wrong until you know why (link the
ADR). Those earn their space and stay useful for years.

Never write a comment because you are **editing** the code. A comment describes
the code as it stands, not the change that produced it — the diff and `git blame`
already record that. Delete these on sight, including your own:

- restating what the line plainly does
- narrating the edit ("agora usa X", "trocado para Y", "antes era Z")
- explaining standard language/framework behaviour
- section banners and decorative separators
- a docblock on a function whose name and signature already say it

When you touch a function, **delete the comments your edit made false** — a stale
comment is worse than none.

## Formatting & linting

Code style is enforced by **Prettier** (config in `.prettierrc.json`, incl.
`prettier-plugin-tailwindcss` to order Tailwind classes) and **ESLint**
(`next/core-web-vitals` + `eslint-config-prettier` to disable conflicting rules).
Do NOT hand-format — let Prettier do it. Run `npm run format` before wrapping up,
and `npm run check` (`prettier --check` + `next lint` + `tsc`) as the gate. A
Husky `pre-commit` hook runs `lint-staged` (Prettier + `eslint --fix` on staged
files), and `.vscode/` enables format-on-save. Per Prettier's guidance we do NOT
use `eslint-plugin-prettier` (formatting and linting stay separate).
