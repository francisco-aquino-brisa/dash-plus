# Indicator blocks come from the catalog

## Context

The board wants to add indicators to the screens without a code change. The
catalog (`indicadores_gerais` / `indicadores_servicos`) already carries an
executable `especificacao_calculo` per serviço, edited in `/admin/indicadores`.
The Banda Larga / 5G blocks of Cidades and Vendas · Canais were hand-coded
catalogs (`lib/data/cities/indicators.ts`, `lib/data/sales/indicators.ts`).

## Decision

- **Where a card shows is data.** `indicadores_paginas` links a serviço to a
  `tb_paginas` page and a bloco, with `ordem` and `padrao` (pre-selected on a
  reader's first visit). The admin edits it in "Onde aparece". A page reads it
  only once its code supports it (`CATALOG_PAGES` in `lib/data/indicators/pages.ts`).
- **The spec wins.** A card shows what its spec computes, even where it differs
  from the old hand-written math. Catalog owners fix their own specs; the code
  has no per-id special cases. What a card lacks becomes a catalog feature
  (`projecao`, `relacionados`), never an exception in code.
- **One query per source.** Every indicator of a source is a column of one
  SELECT (`lib/data/indicators/batch.ts`). Cidades groups by `revan_cidade_id`,
  caches with the cube watermark and narrows in memory; Vendas pushes its filters
  and the reader's CPF scope into the WHERE, per source, through a code-owned
  map (`lib/data/sales/catalog-blocks.ts`). A source a page can't scope or
  narrow renders "sem acesso", never a number the reader isn't entitled to.
- **Hidden, not broken.** Inactive serviços and missing or invalid specs never
  reach a screen. A failing source degrades only its own cards.
- **One card per indicador geral** for the technology family: FTTH / FWA /
  Banda Larga / 5G serviços collapse into one card and the screen's technology
  filter picks the variant. Other serviços (Mix, SVAs) are their own card.
- **No metas yet.** Every card shows the no-target state until metas join the
  catalog.

## Consequences

- A new source needs code: its competência column (`SOURCE_META`), and for
  Vendas its person column and filter columns. Until then its cards show
  "sem acesso".
- Every catalog write bumps an in-process version that keys the screens'
  caches, so edits show on the next load. This assumes a single app instance
  (ADR 0002).
- Readers' saved selections keyed by the old ids are ignored where the id no
  longer exists.
