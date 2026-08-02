# New UI — migration plan (branch `new-ui`)

Migrating the whole dashboard to the redesign in
[`docs/references/new_ui`](../references/new_ui) (see its `DESIGN_SYSTEM.md` and
`SCREENS.md`). This file is the running plan: the phasing, the standing
conventions, and a per-screen stub filled in when each screen is migrated.

## Ground rules

- **Data = current app.** The source of truth for _what the numbers are_ and _how
  they are organized_ stays the current data layer (`lib/data/**`), always validated
  against Databricks (the `databricks-first` rule). The new_ui prototype numbers are
  visual placeholders only.
- **UI/organization = new_ui.** Components, layout, tokens, and interactions come
  from the redesign, at high fidelity.
- **On divergence, ask.** If the new_ui shows an indicator/section we have no source
  for, if we have data the new_ui doesn't surface, or if a number/formula disagrees —
  stop and ask. When a prototype and the warehouse disagree, the warehouse wins.
- **"Sem acesso" ≠ zero.** A missing source renders the dashed "Sem acesso aos dados"
  card with its reason, never a fabricated 0.
- **Clean up on close.** When a screen is done, sweep for orphans (imports, CSS,
  functions, components, libs) and remove anything used by neither the migrated
  screen nor any other. `npm run check` (prettier + lint + tsc) is the gate before a
  screen counts as done. Keep `recharts`; `ioredis` is removed (dead).

## Phasing

**Phase 0 — Foundation**

- Tokens + theme: port `brisanet-tokens.css` + `brisa-dash-tokens.css`; drive theme
  with `data-theme` on `<html>`; expose `--s-*`/`--r-*` via Tailwind `@theme`. Default
  light, sidebar toggle, persisted per user in localStorage. Fonts: Figtree
  (`next/font/local`) + Source Sans 3 (`next/font/google`); drop Space Grotesk.
- Auth (see ADR 0005): bootstrap-Node gate on `X-Forwarded-Email` /
  `DEV_USER_EMAIL`; reshape the JWT; adapt `middleware.ts` (cookie check + `/admin`
  guard); remove SSO/CPF/login/`authz`/`cadastro_usuario` gate.
- AppShell: sidebar (rail-collapsible, only the nav list scrolls; brand + footer
  fixed), data-source status in the sidebar footer, header, mobile tab bar, and the
  modal/bottom-sheet system.

**Phase 1 — Cross-cutting primitives**

- Chip-select filter (popover desktop / sheet mobile; auto-search > 7 options,
  accent-insensitive).
- Date picker, three modes (mês / dia / intervalo); popover even on mobile.
- KPI card + the single `statusColor(atingimento, inverse)` function; sparkline.
- Time-series chart (DESIGN_SYSTEM §4.4 rules), table, segmented/tabs.

**Phase 2 — Screens, one at a time** (data mapped per-screen at migration time):

1. Performance Cidades — `/dashboard`
2. Vendas · Canais — `/vendas`
3. Produtividade Comercial — `/produtividade`
4. Dashboard Vendedor — `/vendedor`

**Phase 3 — Raio-X** (indicator drill-down modal; cross-cuts every KPI card).

**Phase 4 — Administração** (last). Six screens (Usuários, Níveis, Cargos, Páginas,
Capacidades, Capacidades por nível). Reconcile the new_ui admin model
(nível/cargo/página/capacidade) with the `tb_*` tables, and decide the writable-layer
question left open in ADR 0005 (write to `tb_*` in Databricks vs. move to Lakebase).

## Per-screen stubs

Each stub is filled at the start of that screen's migration: the new_ui
section/indicator list, the current-app source for each, and the divergences to
resolve.

### 1. Performance Cidades — `/dashboard`

- new_ui: `SCREENS.md` §1 (Pulse, Banda Larga KPIs, quadrantes/recorte, crescimento
  de base, histórico, negativações).
- Current source: `lib/data/cities/**`.
- Indicator mapping: _TBD at migration._
- Divergences to resolve: _TBD._

### 2. Vendas · Canais — `/vendas`

- new_ui: `SCREENS.md` §2 (períodos, Banda Larga, 5G, PDU).
- Current source: `lib/data/sales/**`.
- Indicator mapping: _TBD at migration._
- Divergences to resolve: _TBD._

### 3. Produtividade Comercial — `/produtividade`

- new_ui: `SCREENS.md` §3 (segmented externas/canais, ranking de vendedores).
- Current source: `lib/data/produtividade/**`.
- Indicator mapping: _TBD at migration._
- Divergences to resolve: _TBD._

### 4. Dashboard Vendedor — `/vendedor`

- new_ui: `SCREENS.md` §4 (identificação, resultado por serviço, dias zerados,
  pendências).
- Current source: `lib/data/vendedor/**`.
- Indicator mapping: _TBD at migration._
- Divergences to resolve: _TBD._

### 5. Raio-X (drill-down)

- new_ui: `SCREENS.md` §5. Needs a 12-month series per indicator + related indicators.
- Divergences to resolve: _TBD._

### 6. Administração

- new_ui: `SCREENS.md` §6 + `DESIGN_SYSTEM.md` §5. Tables: `tb_niveis`,
  `tb_usuarios_app`, `tb_paginas`, `tb_permissoes`, `tb_permissoes_nivel`.
- Open decision: writable layer location (see ADR 0005).
