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

### 1. Performance Cidades — `/dashboard` — ✅ _concluída (Fase 2)_

- new_ui: `SCREENS.md` §1 (Pulse, Banda Larga KPIs, quadrantes/recorte, crescimento
  de base, histórico, negativações).
- Current source: `lib/data/cities/**` — **reutilizada inteira, sem tocar no cálculo.**
  A página server (`app/(app)/dashboard/page.tsx`) já entrega o `DashboardView`
  (`buildDashboardView`) pronto; só o componente cliente (`components/dashboard/**`) é
  reconstruído com as primitivas da Fase 1. Fonte de verdade dos indicadores:
  `projeto_brisa_performance.metas_cidades` (metas) ⋈ `indicadores_cidades` /
  `indicadores_cidades_5g` (realizado). Validado no warehouse (Jul/26, read-only).

**Mapeamento por seção (new_ui → VM `DashboardView`):**

| new_ui §1                        | Campo do VM                                | Fonte / fórmula (verificada)                                                                                                                             |
| -------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pulse · Cidades no escopo        | `coverage.totalCidades`                    | distinct `id_cidade` no escopo                                                                                                                           |
| Pulse · Base ativa BL            | `coverage.totalBase`                       | Σ `base_ativa` FTTH+FWA (`indicadores_cidades`)                                                                                                          |
| Pulse · Home passed              | `coverage.totalHP`                         | Σ `total_de_hp`                                                                                                                                          |
| Pulse · Base 5G (azul)           | `kpis.base5g`                              | Σ `base_ativa` 5G (`indicadores_cidades_5g`)                                                                                                             |
| Banda Larga KPIs                 | `blocks.bandaLarga` (17 `IndicatorCardVM`) | `indicators.ts` BANDA_LARGA (BA01/02/03/04/10/11/12/13, CA03/04, VE01/02/03/05/06, RE01/04) — cada VM traz `value/target/attainment/delta/footer/series` |
| 5G KPIs                          | `blocks.g5` (19 `IndicatorCardVM`)         | `indicators.ts` CINCO_G (BA02, CA01/02/03/09/10/12, VE04/27/32/33/34/35/51, RE01/02/04/05)                                                               |
| Quadrantes                       | `quartis[level]` (4 buckets)               | `crescimento` real ÷ meta oficial (BA04/BA02) por cidade, `metas_cidades`                                                                                |
| Recorte (segmented + lista)      | `quartis[level][q].itens`                  | mesmos buckets, drill Gerência→Coord→Cidade                                                                                                              |
| Bloco Crescimento de Base (topo) | `kpis.crescimentoBase`                     | (base_ativa+fechados) − mês anterior; meta BA04                                                                                                          |
| Bloco · 4 techs (FTTH/FWA/BL/5G) | `growth` (`GrowthByTech[]`)                | base clientes, cidades c/ meta, negativas, takeup (só FTTH/BL)                                                                                           |
| Histórico 12 meses               | `history` ({mes,valor,target})             | Σ `crescimento` (BA02) + Σ `meta_crescimento`                                                                                                            |
| Negativações                     | `negatives[level]` (`NegativeRow[]`)       | cidades abaixo de meta cresc./base ativa, badge Ambas/Crescimento/Base ativa                                                                             |

**Primitivas reutilizadas (Fase 1, sem alterar):** `KpiCard`/`LockedKpiCard`,
`Segmented`, `ChipFilter`+`FilterChipTrigger`+`FilterClearButton`, `DateFilter` (modo
mês p/ Competência), `TimeSeriesChart` (histórico), `DataTable` (negativações),
`Sparkline`, `statusColor`/`isTrendGood`. Novo componente local: seletor "Indicadores
(n)" (popover com checkbox + Todos/Nenhum) — não é primitiva transversal.

**Divergências (protótipo × warehouse/dados):**

1. **Estrutura dos KPIs.** O protótipo desenha **um** grid "Banda Larga" com 18
   indicadores (incluindo 2 de 5G: Vendas Ativadas VE04 e Churn Safra c/ Bloqueio
   CA10) + 2 cards travados de portabilidade. A camada de dados atual tem **dois**
   blocos independentes (Banda Larga + 5G), cada um com seu seletor, dirigidos pelo
   filtro Tecnologia. → **Decisão:** manter os dois blocos (data/organização = app
   atual), cada um estilizado como a seção de KPIs do protótipo. _(confirmar com o usuário)_
2. **Cards "Sem acesso" de portabilidade estão obsoletos.** VE32–VE35 foram
   desbloqueados (tabela `portabilidade`, 142k pedidos, verificado). Warehouse vence
   → renderizam como cards reais no bloco 5G, **não** como `LockedKpiCard`. Resultado:
   esta tela **não tem** cards travados (todos os defs são `available:true`).
3. **Tipo cidade.** Protótipo: Capital/Interior/Praia. Real: ONLY/HÍBRIDA/FTTH
   (`buildFilterOptions` deriva do dado). Dados vencem.
4. **Competência.** Protótipo usa date picker (modo Mês). Mapear `Jul/26` ↔
   `2026-07-01` e o query param `?mes=` da página server (recomputo por filtro no
   servidor, ADR 0002). Detalhe de implementação, não bloqueio.
5. **Raio-X (drill do card).** SCREENS §5 / Fase 3 constrói o modal definitivo que
   "cross-cuts" todo card. **Decisão (2026-08-02):** construir o modal de detalhe
   **já nesta tela** (stats + histórico + relacionados), restilizado com as primitivas.
   ⚠️ **Fase 3:** o Raio-X já existe em Performance Cidades — unificar/substituir por
   ele em vez de recriar do zero, e então propagar às demais telas.
6. **Menores (seguir o app, sem perguntar):** histórico plota BA02 (Σ`crescimento`),
   enquanto o topo do bloco usa BA04 — comportamento pré-existente do VM, mantido;
   takeup só em FTTH/BL; seleção-default de indicadores vem de `DEFAULT_SELECTION`
   (persistida), não os 18 do protótipo.

**Entregue (decisões finais + layout do legado).** A pedido do usuário, a tela segue a
**ordem/posicionamento da tela antiga** (não só o protótipo): Pulse → Banda Larga (card) →
5G (card) → Crescimento de Base → Histórico → **Churn FTTH/FWA/BL + Churn 5G** (par) →
**Funil de Vendas** → **[Quadrantes (esq, 1.4fr) + Cobertura & Penetração (dir, 1fr)]** →
Negativações. Blocos do legado que o new_ui não mostra foram **mantidos** (Funil, Churn,
Cobertura — `components/dashboard/ExtraBlocks.tsx`). Os blocos de KPI ficam **dentro de um
card** `--s-card`. Cores dos quadrantes seguem o legado: verde · **azul** (Q2) · âmbar · vermelho.
Auto-refresh saiu da UI (polling silencioso). Filtro otimista (chip muda na hora, request depois).

**Extensões de primitivas (reusar nas próximas telas).**

- `DateFilter`: prop `modes` — um único modo esconde as abas Mês/Dia/Intervalo (Competência de
  Cidades usa `modes={["mes"]}`).
- `TimeSeriesChart`: `selectableRange` (arrastar p/ medir período, resumo com dispersão colorida),
  `showDispersion` (linha "Disp. mês anterior" verde/vermelha no tooltip, default on),
  `scrollToEnd` (abre rolado nos meses recentes — mobile), `unit` (p.p. vs % relativo).
- `DataTable`: prop `maxHeight` (altura fixa + header sticky).
- **Loading global de navegação:** `lib/ui/nav-pending.tsx` (contexto) — a tela reporta o
  `isPending` do filtro e o `AppShell` mostra os pontinhos quicando na marca (desktop + mobile).
  Próximas telas: só chamar `useSetNavPending()` e sincronizar seu `isPending`.
- **Scrollbar slim global** em `globals.css` (todas as telas herdam).

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
