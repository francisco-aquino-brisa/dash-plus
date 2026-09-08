// HC Zerado repository: the single entry point the screens use. Aggregation runs
// at the source (SQL) per filter-set and is cached by (filters, watermark) —
// ADR 0002. Databricks is the source of truth and this module has no mock: the
// screens are a port of an app that only ever read the real view, so mock mode
// renders an explicit notice instead of invented headcount.

import { cachedByWatermark } from "../cache";
import { isDatabricks } from "../client";
import { hcFiltersToQuery } from "./filters";
import type { HcDesempenhoView, HcFilters, HcFilterOptions } from "./types";
import type { MatrizVisao } from "./databricks";

export const HC_CACHE_VERSION = "v1";

export class HcMockUnsupportedError extends Error {
  constructor() {
    super("O módulo HC Zerado lê apenas dados reais (DATA_SOURCE=mock não é suportado).");
    this.name = "HcMockUnsupportedError";
  }
}

function cacheKey(f: HcFilters, visao: MatrizVisao): string {
  return `hc:${HC_CACHE_VERSION}:desempenho:${visao}:${hcFiltersToQuery(f)}`;
}

export async function getHcDesempenho(f: HcFilters, visao: MatrizVisao): Promise<HcDesempenhoView> {
  if (!isDatabricks()) throw new HcMockUnsupportedError();

  const { databricksHcWatermark, databricksHcDesempenho } = await import("./databricks");
  const watermark = await databricksHcWatermark();

  return cachedByWatermark<HcDesempenhoView>(cacheKey(f, visao), watermark, () =>
    databricksHcDesempenho(f, visao),
  );
}

const EMPTY_OPTIONS: HcFilterOptions = {
  gerentes: [],
  coordenacoes: [],
  supervisoes: [],
  lideres: [],
  cidades: [],
  consultores: [],
  canais: [],
  nichos: [],
  servicos: [],
  indicadores: [],
};

export async function getHcFilterOptions(): Promise<HcFilterOptions> {
  if (!isDatabricks()) return EMPTY_OPTIONS;

  const { databricksHcWatermark, databricksHcFilterOptions } = await import("./databricks");

  try {
    const watermark = await databricksHcWatermark();

    return await cachedByWatermark<HcFilterOptions>(
      `hc:${HC_CACHE_VERSION}:filtros`,
      watermark,
      databricksHcFilterOptions,
    );
  } catch {
    // A failed option list degrades the dropdowns, never the screen.
    return EMPTY_OPTIONS;
  }
}
