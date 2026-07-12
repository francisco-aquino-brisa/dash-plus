// Productivity repository: single entry point the screen uses. Aggregation runs
// at the source (SQL) per filter-set and is cached by (filters, watermark) —
// ADR 0002. Databricks is the source of truth; we NEVER silently fall back to
// mock. Mock is served only in mock mode (DATA_SOURCE=mock).

import { cachedByWatermark } from "../cache";
import { isDatabricks } from "../client";
import { mockProdView, PROD_FILTER_LISTS } from "./mock";
import type { ProdFilters, ProdFilterOptions, ProdView } from "./types";

function cacheKey(f: ProdFilters): string {
  return `prod:v1:${[f.from, f.to, f.mode, f.servico, f.gerencia, f.coordenacao, f.gerente, f.nicho, f.cidade].join("|")}`;
}

export async function getProdView(filters: ProdFilters): Promise<ProdView> {
  if (isDatabricks()) {
    const { databricksProdWatermark, databricksProdView } = await import("./databricks");
    const watermark = await databricksProdWatermark();

    return cachedByWatermark<ProdView>(cacheKey(filters), watermark, () => databricksProdView(filters));
  }

  return cachedByWatermark<ProdView>(cacheKey(filters), "mock:produtividade", async () =>
    mockProdView(filters),
  );
}

export async function buildProdFilterOptions(): Promise<ProdFilterOptions> {
  const { GERENCIAS, COORDENACOES, GERENTES, NICHOS, CIDADES } = PROD_FILTER_LISTS;
  const base: ProdFilterOptions = {
    servicos: ["INTERNET", "FWA", "5G"],
    gerencias: GERENCIAS,
    coordenacoes: COORDENACOES,
    gerentes: GERENTES,
    nichos: NICHOS,
    cidades: CIDADES,
  };

  if (!isDatabricks()) return base;

  try {
    const { databricksProdFilterOptions } = await import("./databricks");
    const real = await databricksProdFilterOptions();

    return {
      ...base,
      gerencias: real.gerencias?.length ? real.gerencias : base.gerencias,
      coordenacoes: real.coordenacoes?.length ? real.coordenacoes : base.coordenacoes,
      gerentes: real.gerentes?.length ? real.gerentes : base.gerentes,
      nichos: real.nichos?.length ? real.nichos : base.nichos,
      cidades: real.cidades?.length ? real.cidades : base.cidades,
    };
  } catch {
    return base;
  }
}
