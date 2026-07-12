// Sales repository: single entry point the screen uses. Aggregation happens at
// the source (SQL) per filter-set and is cached by (filters, watermark) — ADR 0002.
//
// Databricks is the default source of truth (real aggregation in SQL). We NEVER
// silently fall back to mock — a warehouse error surfaces, it does not get masked
// with fake data. Mock is only served when explicitly in mock mode
// (DATA_SOURCE=mock), which is meant for new screens without real data yet.

import { cachedByWatermark } from "../cache";
import { isDatabricks } from "../client";
import { mockSalesView, SALES_FILTER_LISTS } from "./mock";
import { PERIODS, type SalesFilters, type SalesFilterOptions, type SalesView } from "./types";

function cacheKey(f: SalesFilters): string {
  return `sales:v2:${[f.period, f.from, f.to, f.servico, f.gerente, f.canal, f.nicho, f.uf, f.cidade, f.tipo].join("|")}`;
}

export async function getSalesView(filters: SalesFilters): Promise<SalesView> {
  if (isDatabricks()) {
    const { databricksSalesWatermark, databricksSalesView } = await import("./databricks");
    const watermark = await databricksSalesWatermark();

    return cachedByWatermark<SalesView>(cacheKey(filters), watermark, () => databricksSalesView(filters));
  }

  return cachedByWatermark<SalesView>(cacheKey(filters), "mock:vendas", async () => mockSalesView(filters));
}

export async function buildSalesFilterOptions(): Promise<SalesFilterOptions> {
  const { GERENTES, CANAIS, NICHOS, UFS, CIDADES, TIPOS } = SALES_FILTER_LISTS;
  // Mock UF→cidades: assign each city to one UF so the cascade is demonstrable.
  const mockCidadesByUf: Record<string, string[]> = {};
  CIDADES.forEach((c, i) => (mockCidadesByUf[UFS[i % UFS.length]] ??= []).push(c));
  const base: SalesFilterOptions = {
    periods: PERIODS,
    servicos: ["INTERNET", "FWA", "Banda Larga", "5G"],
    gerentes: GERENTES,
    canais: CANAIS,
    nichos: NICHOS,
    ufs: UFS,
    cidades: CIDADES,
    cidadesByUf: mockCidadesByUf,
    tipos: TIPOS,
  };

  if (!isDatabricks()) return base;

  try {
    const { databricksSalesFilterOptions } = await import("./databricks");
    const real = await databricksSalesFilterOptions();

    return {
      ...base,
      gerentes: real.gerentes?.length ? real.gerentes : base.gerentes,
      canais: real.canais?.length ? real.canais : base.canais,
      nichos: real.nichos?.length ? real.nichos : base.nichos,
      ufs: real.ufs?.length ? real.ufs : base.ufs,
      cidades: real.cidades?.length ? real.cidades : base.cidades,
      cidadesByUf:
        real.cidadesByUf && Object.keys(real.cidadesByUf).length ? real.cidadesByUf : base.cidadesByUf,
      tipos: real.tipos?.length ? real.tipos : base.tipos,
    };
  } catch {
    return base;
  }
}
