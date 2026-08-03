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

### 2. Vendas · Canais — `/vendas` — 🚧 _em migração (Fase 2)_

- new_ui: `SCREENS.md` §2 (chips de período, Banda Larga INTERNET+FWA, 5G, PDU ·
  Produtividade por Dia Útil).
- Current source: `lib/data/sales/**` — **reutilizada inteira, sem tocar no cálculo**
  dos blocos/canais/livre. A página server (`app/(app)/vendas/page.tsx`) já entrega o
  `SalesView` (`getSalesView` → `databricksSalesView`) pronto; só o componente cliente
  (`components/sales/**`) é reconstruído com as primitivas da Fase 1. Fonte de verdade
  dos blocos: os cubos oficiais por canal (`waves_consolidado_orcamento`,
  `consolidado_5g_pedido`, `waves_churnsafra_consultor`, `churn_vendedor_5g`,
  `portabilidade`) ⋈ metas de canal (`meta_geral_canais`, `metas_canais_ticket_oferta`).
  Validado no warehouse (Jul/26 é o último mês completo; Ago/26 esparso — hoje 02/08).

**Layout do legado (paridade, como na tela 1):** Header → **chips de Período** + barra de
filtros (Serviço · Gerente · Canal · Nicho · UF · Cidade · Tipo cidade) → **Banda Larga
(card, KPIs selecionáveis)** → **5G (card, KPIs selecionáveis)** → **PDU** → **Análise por
Canal/Nicho** → **Seleção Livre**. As duas últimas seções o new_ui §2 **não** mostra, mas
são do legado → mantidas e restilizadas (insight 2). Cada bloco de KPI dentro de um card
`--s-card`, grade `repeat(auto-fill, minmax(228px,1fr))`, seletor "Indicadores (n)" +
segmented Todos/Fora/Na meta (reuso de `KpiBlock`, hoje acoplado ao VM de Cidades → generalizar).

**Mapeamento por seção (new_ui → VM `SalesView`):**

| Seção (legado + §2)          | Campo do VM                       | Fonte / fórmula (verificada, read-only)                                                                                                                                                                 |
| ---------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chips de Período             | `filters.period`                  | `resolvePeriod()` (mes_atual/anterior/7d/30d/90d/ano/custom) → competência = mês do `to`                                                                                                                |
| Banda Larga (INTERNET+FWA)   | `blocksBL` (`SalesIndicatorVM[]`) | `indicators.ts` BANDA_LARGA — VE01/02/03/05/06, RE01/02/03/04/05/RE03f, CA08 (disp.) + VE07/08/09/05c/06c/CA03/CA09 (sem acesso). Fonte `waves` + meta `meta_geral_canais`/`metas_canais_ticket_oferta` |
| 5G                           | `blocks5G` (`SalesIndicatorVM[]`) | `indicators.ts` CINCO_G — VE04/27/51/28/29, RE01/02/04/05, CA10/CA09, VE32/33/34/35 (disp.) + CA03/CA08c/CA01/CA02 (sem acesso). Fontes `cinco_g`/`churn_5g`/`portab` (VE34 cross-source)               |
| PDU · Produtividade/Dia Útil | `pdu` (`PduPoint[]`)              | **⚠️ TROCAR fonte** → `vw_producao_hc_zero_venda` (a atual `vw_hc_zerado_vendedor` não existe → série vazia hoje). Σ`total_vendas`/Σ`dias_trabalhado` por `servico`. **Fórmula/meta a confirmar.**      |
| Análise por Canal/Nicho      | `canais`                          | `desempenho_hc` — média/dia + var vs mês/semana, ancorada no último mês com atribuição de canal (legado, mantido)                                                                                       |
| Seleção Livre                | `freeIndicators`/`freeSeries`     | `desempenho_hc` — série 12m por indicador do dropdown (legado, mantido)                                                                                                                                 |

**Primitivas a reutilizar (Fase 1):** `KpiCard`/`LockedKpiCard`, `Segmented`, `ChipFilter`,
`DateFilter` (chips de período são custom, não `DateFilter`; o "Personalizado" pode virar
`DateFilter modes={["intervalo"]}`), `TimeSeriesChart` (drill + Seleção Livre + PDU line),
`DataTable` (Análise por Canal, com `maxHeight`), `statusColor`/`isTrendGood`, `nav-pending`,
filtro otimista. Componentes da tela 1 a **generalizar** (hoje acoplados a Cidades):
`KpiBlock`+`IndicatorSelect` (VM genérico), `indicator-format` (unidade `qtd`), e o **padrão**
do `DrillModal` (Raio-X shell + stat cards + TimeSeriesChart) — o `SalesIndicatorVM` não tem
`related`/`average`/`targetUnit`, então adapto o padrão, não o componente (Fase 3 unifica).

**Divergências (protótipo × warehouse/dados) — RESOLVER ANTES DE CODAR:**

1. **PDU — fonte, fórmula, meta e forma visual (bloqueante).** (a) _Fonte:_ a atual
   `vw_hc_zerado_vendedor` **não existe** (série vazia hoje); substituta verificada
   `vw_producao_hc_zero_venda`. (b) _Denominador:_ `Σtotal_vendas/Σdias_trabalhado`
   (pooled) valida jul/26 em **INTERNET 0,95 · 5G 1,50 · FWA 0,15** (bate com o esperado);
   o denominador alternativo `dias_uteis_acumulado` por vendedor dá 2,75/1,16/0,30
   (diverge). (c) _Serviços:_ view tem `INTERNET`(→FTTH)·`FWA`·`5G`·`RENOVACAO`; "Banda"
   = INTERNET+FWA; RENOVACAO não está no protótipo. (d) _Meta:_ **não existe meta na view**;
   as metas do protótipo (FTTH 2,10 · FWA 0,90 · 5G 2,00 · Banda 3,00) são placeholders,
   fonte desconhecida. (e) _Forma:_ new_ui = barras horizontais por tecnologia vs meta
   (competência única); legado = line chart 12m por tech (sem meta, sem Banda).
   → **RESOLVIDO (2026-08-02):** PDU fica **travada** (bloco "sem acesso", motivo
   "fórmula/denominador e meta em confirmação com o time de dados"). **Não** ligar
   `vw_producao_hc_zero_venda` agora. Quando liberar: realizado-only, **line chart 12m
   por tech** (forma legada), denominador candidato `Σtotal_vendas/Σdias_trabalhado`.
2. **Seções extras do legado (Análise Canal + Seleção Livre).** O new_ui §2 não as mostra;
   o legado sim. Insight 2 → **RESOLVIDO: manter as duas, restilizadas.**
3. **"Silent mock fallback" parece obsoleto para Vendas.** `sales/repository.ts` diz
   explicitamente que **nunca** cai pra mock (só `DATA_SOURCE=mock` serve mock); só
   `buildSalesFilterOptions` tem `try/catch → listas mock`. Cada fonte dentro de
   `databricks.ts` já é isolada (falha → card "sem acesso", nunca derruba a tela).
   ⚠️ `canalAnalysis` e `freeData` **não** têm try/catch — endurecer ao migrar.
   (Nota: atualizar o data-map — a ressalva "Silent mock fallback" vale p/ vendedor/
   produtividade, não p/ vendas hoje.)
4. **Números do protótipo são placeholders.** §2 mostra Vendas Criadas 27.746 etc. —
   virão do warehouse; manter formatos pt-BR. "Mês atual" (Ago/26) é esparso hoje;
   comportamento igual ao legado, default não muda.

**Extensões de primitivas previstas:** generalizar `KpiBlock`/`IndicatorSelect` para um VM
genérico (id/label/value/meta/attainment/delta/series/available/unit/polarity/description),
reusável por Cidades e Vendas; PDU pode ganhar um componente `HBarMeta` (barras horizontais
realizado vs meta) se a forma new_ui for aprovada.

**Entregue (2026-08-02, aguardando verificação no navegador).** Cliente reconstruído em
`components/sales/**` com as primitivas da Fase 1, na **ordem do legado** (Header → filtros →
Banda Larga → 5G → PDU → Análise por Canal → Seleção Livre):

- **`components/ui/kpi-block.tsx`** — `KpiBlock`/`IndicatorSelect` **generalizados** (VM
  genérico `KpiBlockItem`), core compartilhado. `dashboard/KpiBlock.tsx` e o novo
  `sales/SalesKpiBlock.tsx` viraram **wrappers finos** que mapeiam cada VM (a assinatura da
  tela 1 não mudou → `Dashboard.tsx` intacto).
- **`SalesFilterBar.tsx`** — chips de período (+ "Personalizado" via popover de `Calendar`
  range, emite from/to ISO) + `ChipFilter` (Serviço·Gerente·Canal·Nicho·UF·Cidade·Tipo) com
  cascata UF→Cidade + `FilterClearButton`. Filtro otimista + `nav-pending`.
- **Blocos BL + 5G** via `SalesKpiBlock` (footer Meta/Média 12m/Ating.; `description` no (i);
  drill no clique). **`SalesDrillModal.tsx`** = padrão Raio-X (stats + `TimeSeriesChart`), sem
  "relacionados" (o `SalesIndicatorVM` não os tem; Fase 3 unifica).
- **`SalesPduBlock.tsx`** = bloco travado "sem acesso" (decisão). **`AnaliseCanais.tsx`** =
  `DataTable` + `maxHeight` + `Segmented`. **`SelecaoLivre.tsx`** = `TimeSeriesChart` +
  `ChipFilter` (só indicadores com fonte).
- **Camada de dados (só hardening, sem mexer no cálculo):** `canalAnalysis`/`freeData` ganharam
  `try/catch` (isolamento como o resto do adapter); **removida a query morta da PDU** (`pduSeries`
  - const `VW`) que batia na view inexistente `vw_hc_zerado_vendedor` a cada render — `pdu`/`meses`
    agora saem `[]` no path Databricks. Data-map atualizado: "Silent mock fallback" era obsoleto
    (os 3 repos não caem pra mock na view; só as listas de filtro degradam).
- **Órfãos removidos:** `SalesFiltersBar`, `SalesIndicatorCard`, `dashboard/IndicatorPicker`,
  `dashboard/HistoryChart`. `npm run check` (prettier + lint + tsc) **verde**.
- **Pendente:** verificação no navegador (claro + escuro) após login; confirmar fórmula/meta da
  PDU com o time de dados para destravar o bloco.

### 3. Produtividade Comercial — `/produtividade` — 🚧 _em migração (Fase 2)_

- new_ui: `SCREENS.md` §3 (Período + segmented Externas/Canais + 4 cards de funil +
  Ranking de Vendedores).
- Current source: `lib/data/produtividade/**` — **reutilizada, sem tocar no cálculo.**
  A página server (`app/(app)/produtividade/page.tsx`) entrega o `ProdView`
  (`getProdView` → `databricksProdView`) pronto; só o cliente (`components/produtividade/**`)
  é reconstruído com as primitivas da Fase 1. Fonte: `desempenho_hc` (funil + 5G por
  vendedor, hierarquia, cidade). Validado no warehouse (últimos 30 dias, 04/07–02/08:
  Criadas 28.615 · Efetivadas 24.837 · Instaladas 21.978 · Ativ 5G 43.736).

**Layout do legado (paridade):** Header (subtítulo = período) → filtros (Período range +
segmented Gestão Externas/Canais + Serviço + hierarquia por modo + Cidade) → **Indicadores**
(cards de funil) → **Ranking de Vendedores** → **PDU** → **TAM de Vendedores**. PDU e TAM o
new_ui §3 não mostra, mas são do legado → mantidos (travados, "sem acesso").

**Mapeamento por seção (new_ui → VM `ProdView`):**

| Seção (legado + §3)         | Campo do VM                  | Fonte / fórmula (verificada, read-only)                                                                                                                                             |
| --------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Período (range) + subtítulo | `filters.from/to`            | `resolveProdPeriod` (default = últimos 30 dias); janela anterior de igual tamanho p/ o delta                                                                                        |
| Segmented Externas/Canais   | `filters.mode`               | filtro server: troca a hierarquia (`GERENCIA`/`COORDENACAO` vs `GERENTE_CANAL`/`nicho`) e o agrupamento do ranking. **Não** troca a população dos cards                             |
| 4 cards de funil            | `indicadores` (`KpiBlock[]`) | `desempenho_hc` — Criadas/Efetivadas/Instaladas (`criado/efetivado/instalado_*` por `servico`) + Ativadas 5G (`5g_ativacao`); `delta` vs período anterior; `helper` (tag/conversão) |
| 3 cards sem acesso          | `indicadores` (blocked)      | Ticket Médio, Ticket Médio 5G, Churn Safra — sem fonte no grão → `available:false`                                                                                                  |
| Ranking de Vendedores       | `ranking` (`VendedorRow[]`)  | `desempenho_hc` top 15 por efetivadas, `GROUP BY MATRICULA`, agrupado por Coord. (externas) / Nicho (canais)                                                                        |
| PDU                         | `pdu` (`PduPoint[]`)         | **⚠️ view ausente `vw_hc_zerado_vendedor`** → série vazia. Mesma decisão de Vendas: **travar** (não ligar a substituta agora)                                                       |
| TAM de Vendedores           | `tamAvailable` (false)       | quintis por atingimento — precisa de **meta por vendedor** (sem fonte) → bloco travado                                                                                              |

**Primitivas a reutilizar:** `KpiCard`/`LockedKpiCard` (ou card simples fiel ao §3),
`Segmented` (modo Gestão + é filtro), `ChipFilter`, range popover (padrão `CustomRangeChip`
de Vendas → from/to ISO), `DataTable` (ranking, `maxHeight`), `statusColor`/`isTrendGood`,
`nav-pending`, filtro otimista. Bloco PDU travado pode reusar um `LockedSection` compartilhado
(a extrair — útil também p/ Vendedor).

**Divergências (protótipo × warehouse/dados) — RESOLVER ANTES DE CODAR:**

1. **Estilo dos cards de funil.** `indicadores` é `KpiBlock[]` (só `value/meta(0)/delta/helper`,
   **sem série e sem meta**). → **RESOLVIDO (2026-08-02):** **card simples** (valor + pill de
   tendência + linha auxiliar), fiel ao §3, sem campos vazios. Não reusar o `KpiCard` completo aqui.
2. **Segmented Externas/Canais não troca os números.** → **RESOLVIDO: manter comportamento atual**
   (modo = troca a hierarquia de filtro + o agrupamento do ranking; sem filtro, os cards são iguais
   nos dois modos). Os totais diferentes do protótipo são placeholders (sem fonte que separe a
   população externas × canais). Sem inventar split.
3. **Ranking → Dashboard Vendedor.** → **RESOLVIDO: SEM click-through** por agora (a tela Vendedor
   está sendo reconstruída em paralelo; evitar acoplar ao contrato de URL antes de fechar). Ranking
   fica sem link; ligar depois.
4. **PDU travada (decisão herdada de Vendas).** → **RESOLVIDO: travar** (bloco local "sem acesso").
   Remover a query morta contra a view ausente `vw_hc_zerado_vendedor`.
5. **TAM de Vendedores travado.** Sem meta por vendedor → bloco local "sem acesso" (mantido do
   legado, insight 2). → **RESOLVIDO: manter travado.**
6. **Silent mock fallback obsoleto** (igual Vendas): `produtividade/repository.ts` não cai pra
   mock na view; só listas de filtro degradam. Endurecer `indicadores`/`ranking` (sem try/catch
   hoje) ao migrar.

**Nota de coordenação (agente Vendedor em paralelo):** blocos travados (PDU/TAM) ficam **locais**
em produtividade — **não** extrair um `LockedSection` compartilhado agora (evita colisão com o
bloco travado que o agente de Vendedor também criará). Primitivas `components/ui/*` só reuso.

**Entregue (2026-08-02, aguardando verificação no navegador).** Cliente reconstruído em
`components/produtividade/**`, ordem do legado (Indicadores → Ranking → PDU → TAM):

- **`ProdFilterBar.tsx`** — range popover de Período (padrão `PeriodRangeChip` → from/to ISO) +
  `Segmented` de Gestão (Externas/Canais, é filtro; reseta a hierarquia ao trocar) + `ChipFilter`
  por modo (Serviço + Gerência/Coord. ou Gerente/Nicho + Cidade). Filtro otimista + `nav-pending`.
- **`ProdKpiCard.tsx`** — card simples (valor + pill de tendência + linha auxiliar), variante
  travada p/ os 3 sem-fonte. **`RankingVendedores.tsx`** — `DataTable` + `maxHeight` (posição
  com destaque top-3, tags coord/cidade, valor+% por estágio). Sem click-through (decisão).
- **`ProdLockedBlock.tsx`** (local) — reusado por **PDU** e **TAM** travados.
- **`ProdDashboard.tsx`** — cliente com header (subtítulo = período) + as seções.
- **Camada de dados (só hardening):** `indicadores`/`ranking` ganharam `try/catch` (isolamento);
  **removida a query morta da PDU** (`pduSeries`/`whereVW`/const `VW`) que batia na view ausente —
  `pdu` sai `[]` no path Databricks.
- **Órfãos removidos:** `ProdFiltersBar`, `TamBlock`, e — por perderem o último usuário —
  `sales/SalesKpiCard` e `sales/PduBlock` (versão antiga). `npm run check` **verde**.
- **Pendente:** verificação no navegador (claro + escuro) após login.

### 4. Dashboard Vendedor — `/vendedor` — 🚧 _em migração (Fase 2)_

- new_ui: `SCREENS.md` §4 (segmented Resultados/Pendências; card de identificação;
  resultado por serviço; dias zerados; pendências).
- Current source: `lib/data/vendedor/**` — **reutilizada, sem tocar no cálculo.** A
  página server (`app/(app)/vendedor/page.tsx`) já entrega o `VendedorView`
  (`getVendedorView`) por `(matricula, competência)`; só o componente cliente
  (`components/vendedor/**`) é reconstruído com as primitivas da Fase 1/2. Fontes de
  verdade: `metas_vendedores_canais` (catálogo+metas por vendedor) ⋈ realizado das
  fontes que o catálogo nomeia (`waves_consolidado_orcamento` / `consolidado_5g_pedido`
  / `portabilidade` VE32 / `churn_*` / fidelizações) por `hash_user`/`matricula`;
  `desempenho_hc` (perfil, funil, dias zerados, ranking, mix). Validado no warehouse
  (Jul/26 read-only; sample: matrícula 10083 · PEREIRO/CE · ATIVO).

**Mapeamento por seção (new_ui §4 → VM `VendedorView`):**

| new_ui §4                            | Campo do VM                           | Fonte / fórmula (verificada, read-only)                                                                                                                                                                                        |
| ------------------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Segmented Resultados/Pendências      | `tab` (UI)                            | client-side; troca Resultados ↔ aba Pendências                                                                                                                                                                                 |
| Card de identificação                | `profile` (`VendedorProfile`)         | `desempenho_hc` (nome, cidade, canal, coord, gerência, supervisão, nível/cargo, situação, tipo_cidade, tempo_empresa) por matrícula                                                                                            |
| Resultado por Serviço · cards        | `servicos` (`ServicoCard[]`)          | `realizado` = funil `instalado_*`/`5g_ativacao` (`desempenho_hc`); indicadores meta×realizado do catálogo (`metas_vendedores_canais`)                                                                                          |
| Resultado por Serviço · NDU/PDU      | `servicos[].ndu`/`.pdu`               | **⚠️ TRAVADO** — fonte oficial `vw_hc_zerado_vendedor` **não existe** (col `total_realizado` idem). Substituta `vw_producao_hc_zero_venda` existe mas denominador/meta a confirmar → hoje fabrica **0/0,00** (bug a corrigir). |
| Dias zerados                         | `diasZerados` (`DiasZeradosView`)     | `desempenho_hc` por dia (vendas por serviço = 0 no dia útil não-feriado → zerado)                                                                                                                                              |
| Pendências (aba)                     | `pendencias` (`PendenciaOrcamento[]`) | `waves_consolidado_orcamento` — orçamentos CRIADO/EFETIVADO sem INSTALADO na competência, por `hash_user` (`pendenciasAvailable`)                                                                                              |
| _(legado, fora do §4)_ Rankings      | `ranking` (`RankingView`)             | `desempenho_hc` — rank por mix (BL+5G) em cidade/coord/gerência/geral (janela)                                                                                                                                                 |
| _(legado, fora do §4)_ Mix de Vendas | `mix` (`MixOferta[]`)                 | `waves_consolidado_orcamento` — ofertas (`plano`) por status, contagem distinta `orcamento_id`                                                                                                                                 |

**Primitivas a reutilizar (Fase 1/2):** `KpiCard`/`LockedKpiCard`? (cards de serviço
não são KPI-cards padrão — decidir), `Segmented` (Resultados/Pendências), `ChipFilter` +`FilterClearButton` (barra de filtros), `CompetenciaPicker` (Competência, já existe),
`DataTable`? (Mix/Pendências — avaliar), `statusColor`/`isTrendGood`, `nav-pending`,
filtro otimista. Busca de vendedor: `VendedorSearch` (já existe, reestilizar com tokens).

**Divergências (protótipo × warehouse/dados) — RESOLVIDAS (2026-08-02):**

1. **NDU/PDU por serviço travados (bloqueante).** A view oficial
   `vw_hc_zerado_vendedor` (+ col `total_realizado`) **não existe** em nenhum catálogo
   (confirmado 2026-08). O `databricks.ts` do vendedor ainda a consultava a **cada
   render** (`fetchPdu`, try/catch → `{}`), fazendo os cards mostrarem **NDU 0 /
   PDU 0,00 fabricados** — viola "Sem acesso ≠ zero". → **RESOLVIDO:** `pdu`/`ndu`
   passam a `number | null`; **removida a query morta** (`fetchPdu` + const `VW`) como
   Vendas fez com `pduSeries`; os cards mostram **"—"** com aviso (title) "fórmula/meta
   em confirmação". Nenhum número real muda (`realizado`/indicadores vêm de outras fontes).
   Mock espelha (`pdu`/`ndu` = null).
2. **Filtro "Serviço".** new_ui §4 lista Vendedor · Competência · Serviço; o legado usa
   um `VisibilityFilter` (liga/desliga serviços + seções). → **RESOLVIDO (usuário):
   manter igual ao legado** — sem filtro Serviço novo; a barra fica Vendedor (busca) ·
   Competência · Exibir (`VisibilityFilter` restilizado). Filtra os 4 cards client-side.
3. **Blocos legados fora do §4 (Rankings + Mix de Vendas).** O new_ui §4 não os mostra;
   o legado sim. Golden rule "manter blocos do legado" → **mantidos os dois, restilizados**,
   na ordem do legado.
4. **Raio-X por serviço ≠ Raio-X §5.** O botão "Ver raio-X" do card abre o `RaioXModal`
   por-serviço (indicadores do serviço + projeção pro-rata), **não** o drill §5 por-indicador
   (12m + relacionados) — a camada do vendedor **não** entrega série 12m por indicador
   (histórico/quintil não implementados). → **RESOLVIDO (usuário): manter o Raio-X por
   serviço, restilizado** no shell dos drills (eyebrow + nome + Realizado/Projeção/Ating.).
   Projeção pro-rata por **dias úteis do calendário** (NDU travado). Fase 3 unifica.
5. **Card de identificação.** Header `--bn-gradient-orange`, avatar (iniciais), nome,
   matrícula, cargo (`nivel`), badges situação (ATIVO) + tipo_cidade (ONLY/HÍBRIDA/FTTH),
   grade de campos (mantido o conjunto do legado, 8 campos). `TEMPO_EMPRESA` pode vir vazio
   → exibe "—".

**Entregue (2026-08-02, aguardando verificação no navegador).** Cliente reconstruído em
`components/vendedor/**` com inline `--s-*`/`--bn-*` e primitivas Fase 1/2, na ordem do
legado (Header → filtros → Segmented Resultados/Pendências → Identificação → Resultado por
Serviço → Dias Zerados → Rankings → Mix; aba Pendências à parte):

- **`VendedorFilterBar.tsx`** (novo) — sticky `--s-card`, reúne `VendedorSearch` +
  `CompetenciaPicker` (pill) + `VisibilityFilter`, todos restilizados em tokens. Filtro
  otimista (`uiFilters`) + `nav-pending`.
- **`VendedorHeader.tsx`** — card de identificação (`--bn-gradient-orange`, avatar de
  iniciais, badges, grade auto-fit com divisores hairline).
- **`ServicoCard.tsx`** — ícone+cor por serviço (`vendedor-format.ts`), realizado, **NDU/PDU
  "—" travados** (aviso), indicadores meta×real (Meta/Real/%/Falta) ou estado vazio, "Ver raio-X".
- **`DiasZeradosBlock.tsx`** — faixa `--s-warn-bg` + modal de calendário (restilizado).
- **`RankingsBlock.tsx`** / **`MixVendasBlock.tsx`** — blocos do legado restilizados.
- **`RaioXModal.tsx`** — Raio-X por serviço no shell dos drills (sem chart 12m; projeção
  pro-rata por dias úteis). **`vendedor-format.ts`** (novo) = ícone/cor + formato por unidade.
- **Camada de dados (só hardening):** removida a query morta da PDU (`fetchPdu`/`VW`) que batia
  em `vw_hc_zerado_vendedor` a cada render; `ServicoCard.pdu/ndu` agora `number | null`; mock
  espelha. Cálculo real intocado.
- **Órfãos:** removido `SERVICOS` (não usado); `MockDataBadge` mantido (usado por Produtividade).
  `npm run check` (prettier + lint + tsc) **verde**.
- **Extensão de primitiva:** nenhuma alteração destrutiva nas primitivas compartilhadas
  (`Segmented`/`kpi-*`/`chip-filter`/etc. intactas). `CompetenciaPicker`/`VendedorSearch`/
  `VisibilityFilter` são locais da tela (restilizados).
- **Pendente:** verificação no navegador (claro + escuro) após login; destravar PDU quando o
  time de dados confirmar denominador/meta.

### 5. Raio-X (drill-down)

- new_ui: `SCREENS.md` §5. Needs a 12-month series per indicator + related indicators.
- Divergences to resolve: _TBD._

### 6. Administração — 🚧 _em migração (Fase 4)_

- new_ui: `SCREENS.md` §6 + `DESIGN_SYSTEM.md` §5. Seis telas: **Usuários · Níveis de
  acesso · Cargos · Páginas · Capacidades · Capacidades por nível**, mais a **troca de
  navegação** ao entrar/sair do admin (desktop + mobile).
- Área/isolamento: `app/admin/**`, `components/admin/**`, `lib/data/admin/**`. Mudanças
  no `AppShell` (nav-swap) são **aditivas**. Reusa as primitivas da Fase 1 congeladas.

**Schema real verificado no warehouse (read-only, Ago/26) —
`gdb_brisanet_comunidade_dev.projeto_brisa_performance`:**

| Tabela                | Colunas reais                                                                                                                              | Linhas hoje                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| `tb_niveis`           | `id` bigint · `nome` · `descricao` · `criado_em` · `atualizado_em`                                                                         | 1 (`admin`)                    |
| `tb_cargos`           | `id` bigint · `nome` · `descricao` · `criado_em` · `atualizado_em`                                                                         | 1 (`Administrador`)            |
| `tb_usuarios`         | `id` · `cpf` · `matricula` · `nome` · `email` · `nivel_id→tb_niveis` · `cargo_id→tb_cargos` · `ativo` bool · `criado_em` · `atualizado_em` | 1 (o admin semente, Francisco) |
| `tb_paginas`          | `id` · `nome` · `icone` · `rota` · `criado_em` · `atualizado_em`                                                                           | 0                              |
| `tb_permissoes`       | `id` · `label` (snake_case) · `descricao` · `pagina_id→tb_paginas` · `criado_em` · `atualizado_em`                                         | 0                              |
| `tb_permissoes_nivel` | `permissao_id→tb_permissoes` · `nivel_id→tb_niveis` · `criado_em` (junção N:N)                                                             | 0                              |

> **Nota (2026-08-02):** `tb_usuarios_app` foi **substituída** por `tb_usuarios` (mesmo schema
>
> - `cargo_id`). Todo o sistema (gate de auth, admin, docs) aponta para `tb_usuarios`.

**Mapeamento new_ui → tabelas reais:**

| Modelo new_ui (`DESIGN_SYSTEM` §5)               | Tabela real                | Observação                                                                       |
| ------------------------------------------------ | -------------------------- | -------------------------------------------------------------------------------- |
| `nivel {id,nome,desc,locked}`                    | `tb_niveis` (sem `locked`) | `locked` **derivado**: `nome==='admin'` → badge "Padrão", sem editar/excluir     |
| `usuario {id,nome,email,nivelId,cargoId,status}` | `tb_usuarios`              | `status` = `ativo` bool; `cargo_id→tb_cargos` existe. Email **derivado** do nome |
| `pagina {id,nome,icone}`                         | `tb_paginas` (+ `rota`)    | `icone` = chave do set de ícones; `rota` extra do real, útil                     |
| `capacidade {id,label,desc,paginaId}`            | `tb_permissoes`            | "Capacidade" (new_ui) = "permissão" (tabela). `label` snake_case                 |
| `perms {[nivelId]:{[capId]:true}}`               | `tb_permissoes_nivel`      | matriz N:N nível × capacidade                                                    |
| `cargo {id,nome,locked}`                         | `tb_cargos`                | `locked` **derivado**: `nome==='Administrador'`                                  |

**Decisões (2026-08-02):**

- **Camada de escrita = DML direto nas `tb_*`/`tb_cargos`** (o caminho do ADR 0005). O
  _agente_ só tem read-only, mas o **app em produção grava** (credencial com escrita nas
  tabelas app-owned). Construo o admin data-writer Node normal (`INSERT/UPDATE/DELETE`
  parametrizado, só no path `/admin`); funciona em prod. Não consigo _testar_ a escrita
  localmente (guard read-only) — validação de mutação é em prod pelo usuário.
- **`id` é `GENERATED ALWAYS AS IDENTITY`** e `criado_em`/`atualizado_em` têm
  `DEFAULT CURRENT_TIMESTAMP()` → INSERT **omite** `id`/`criado_em`/`atualizado_em`;
  UPDATE seta `atualizado_em = CURRENT_TIMESTAMP()`. `tb_usuarios` tem PK(`id`),
  FK `nivel_id→tb_niveis`, `cargo_id→tb_cargos`, UNIQUE(`email`) (não-enforced), `ativo DEFAULT TRUE`.

**Divergências (protótipo × warehouse):**

1. **Cargos — RESOLVIDO (2026-08-02).** Time criou **`tb_cargos {id,nome,descricao,
criado_em,atualizado_em}`** e a nova **`tb_usuarios`** (substitui `tb_usuarios_app`) já com
   `cargo_id→tb_cargos`. O elo usuário↔cargo existe; a leitura faz `LEFT JOIN tb_cargos` e os
   fallbacks temporários (query sem-cargo) foram removidos.
2. **`locked` não existe como coluna** (nem em `tb_niveis` nem em `tb_cargos`). →
   **Decisão:** derivar `locked` de `nome==='admin'` (nível), coerente com o ADR 0005
   ("`nome='admin'` is the seeded level"); cargo idem por `nome==='Administrador'`. Sem coluna nova.
3. **Cor do chip de nível.** O protótipo colore por nível (Admin laranja, Supervisor,
   Gestor, Consulta). Não há coluna de cor → paleta estável derivada do `nome` (menor,
   sigo sem perguntar).
4. **Dados são placeholders.** As telas do protótipo mostram vários níveis/cargos/páginas;
   o warehouse hoje tem só o admin semente e páginas/capacidades vazias. A UI precisa de
   **estado vazio** com explicação (checklist §7.8). Popular é trabalho do próprio CRUD.
5. **"Páginas" e as telas reais.** O checklist §7.9 pede que cada tela nova apareça no CRUD
   de Páginas com capacidades. Como `tb_paginas`/`tb_permissoes` estão vazias, o seed
   inicial (Cidades, Vendas, Produtividade, Vendedor + capacidades) é feito **pelo próprio
   admin** após a camada de escrita existir — não hardcodar.

**Ordem de execução:** (1) camada de **leitura** `lib/data/admin/**` + tipos + o
**admin data-writer** (mutação em prod) → (2) **nav-swap** do `AppShell` (aditiva, desktop

- mobile) + shell `/admin` → (3) as 6 telas com formulários/validação/matriz + as ações de
  CRUD (create/update/delete) já ligadas ao writer, **confirmação destrutiva** (§4.8), selects
  p/ referência, email derivado, normalização snake_case, badge "Padrão", Admin travado na
  matriz com aviso azul → (4) Cargos usa `tb_cargos` real; a coluna Cargo em Usuários espera o
  `cargo_id` (Divergência 1). Fecho: varredura de órfãos + `npm run check` verde + verificação
  no navegador (claro/escuro). Escrita não é testável localmente (guard read-only) → validada
  em prod pelo usuário.

**Entregue (2026-08-02, branch `new-ui-admin`, `npm run check` verde).**

- **Camada de dados** `lib/data/admin/**`: `derive.ts` (helpers puros: `normalizeCapabilityLabel`
  - variante `…Input`, `deriveEmail`, `isLockedNivel/Cargo`, `nivelChipTone`, `statusChipTone`),
    `types.ts`, `tables.ts` (ids via env; usuários = `tb_usuarios`), `read.ts` (6 leituras isoladas
    por `safe()`; usuários com `LEFT JOIN tb_cargos` via `cargo_id`), `write.ts`
    (INSERT/UPDATE/DELETE parametrizado, omite `id`/timestamps, guarda SQL contra editar/excluir
    `admin`/`Administrador`, `setPerm` idempotente + admin travado).
- **Server actions** `app/(app)/admin/actions.ts` (`"use server"`): guarda `isAdmin`, valida/normaliza
  server-side, `revalidatePath` das 6 rotas. `guard.ts` = `requireAdmin()`.
- **Nav-swap** aditiva no `AppShell` (`ADMIN_NAV`, `inAdmin`, heading dinâmico, "Voltar aos
  dashboards" laranja no rodapé desktop + tab bar/sheet mobile).
- **6 telas** `components/admin/**` no padrão `--s-*` (reusa `DataTable` + Radix `DialogPrimitive`):
  `AdminScreen` (eyebrow+título+Atualizar+busca+ação), `AdminModal`/`ModalShell`/`ModalHeader`
  (§4.7), `ConfirmDelete` (§4.8), `AdminSelect` (botão+lista+check, busca >7), `primitives`,
  `icons`, `useAdminAction`, `filter`. Telas: Usuários (nome+email derivado, selects nível/cargo,
  status só na edição), Níveis (n de N), Cargos, Páginas (icon picker), Capacidades (label mono
  normalizado ao digitar), Capacidades por nível (matriz: chips, contador, card por página,
  Admin travado + aviso azul, toggle otimista).
- **Rotas** `app/(app)/admin/{page→redirect, usuarios, niveis, cargos, paginas, capacidades,
permissoes}` (server, `requireAdmin` + `readAdminData`).
- **Rename `tb_usuarios_app` → `tb_usuarios`** (nova tabela com `cargo_id`): atualizado em todo o
  sistema — gate de auth (`lib/auth/gate.ts`), `lib/data/admin/tables.ts`, comentários
  (`jwt.ts`/`bootstrap`/`sem-acesso`) e docs (`CONTEXT.md`, ADR 0005, este plano).
- **Pendências:** (a) verificação no navegador (claro/escuro) após login — o preview em execução é
  o checkout principal, não esta worktree; validar servindo `new-ui-admin`; (b) escrita validada em
  prod (guard read-only bloqueia teste local).
