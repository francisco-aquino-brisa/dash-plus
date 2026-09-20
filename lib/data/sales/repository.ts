// Sales repository: single entry point the screen uses. Aggregation happens at
// the source (SQL) per filter-set and is cached by (filters, watermark) — ADR 0002.
//
// Databricks is the default source of truth (real aggregation in SQL). We NEVER
// silently fall back to mock — a warehouse error surfaces, it does not get masked
// with fake data. Mock is only served when explicitly in mock mode
// (DATA_SOURCE=mock), which is meant for new screens without real data yet.

import { currentScope } from "@/lib/auth/scope";
import { ADAPTER_BUILD, cachedByWatermark } from "../cache";
import { isDatabricks } from "../client";
import { scopeToken } from "../scope-sql";
import { mockSalesView, SALES_FILTER_LISTS } from "./mock";
import { PERIODS, type SalesFilters, type SalesFilterOptions, type SalesView } from "./types";

function cacheKey(f: SalesFilters): string {
  // The scope is part of a cached view's identity: without it the first reader
  // would warm the cache for everyone else, whatever their scope.
  return `sales:v6:${ADAPTER_BUILD}:${scopeToken(f.scope)}:${[f.period, f.from, f.to, f.servico, f.gerente, f.canal, f.nicho, f.uf, f.cidade, f.tipo].join("|")}`;
}

/** The one place the session's scope enters this module (see the HC Zerado twin). */
async function scoped(f: SalesFilters): Promise<SalesFilters> {
  return { ...f, scope: await currentScope() };
}

export async function getSalesView(filters: SalesFilters): Promise<SalesView> {
  const f = await scoped(filters);

  if (isDatabricks()) {
    const { databricksSalesWatermark, databricksSalesView } = await import("./databricks");
    const watermark = await databricksSalesWatermark();

    return cachedByWatermark<SalesView>(cacheKey(f), watermark, () => databricksSalesView(f));
  }

  return cachedByWatermark<SalesView>(cacheKey(f), "mock:vendas", async () => mockSalesView(f));
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
    const scope = await currentScope();
    const real = await databricksSalesFilterOptions(scope);
    // The mock lists stand in for a warehouse that did not answer — never for a
    // scoped reader who legitimately has nothing in a dimension. Falling back
    // there would hand them names from outside their scope.
    const pick = <T>(r: T[] | undefined, mock: T[]): T[] => (r?.length ? r : scope.all ? mock : []);

    return {
      ...base,
      gerentes: pick(real.gerentes, base.gerentes),
      canais: pick(real.canais, base.canais),
      nichos: pick(real.nichos, base.nichos),
      ufs: pick(real.ufs, base.ufs),
      cidades: pick(real.cidades, base.cidades),
      cidadesByUf:
        real.cidadesByUf && Object.keys(real.cidadesByUf).length
          ? real.cidadesByUf
          : scope.all
            ? base.cidadesByUf
            : {},
      tipos: pick(real.tipos, base.tipos),
    };
  } catch {
    return base;
  }
}
