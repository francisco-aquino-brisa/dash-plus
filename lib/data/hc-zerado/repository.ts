// HC Zerado repository: the single entry point the screens use. Aggregation runs
// at the source (SQL) per filter-set and is cached by (filters, watermark) —
// ADR 0002. Databricks is the source of truth and this module has no mock: the
// screens are a port of an app that only ever read the real view, so mock mode
// renders an explicit notice instead of invented headcount.

import { cachedByWatermark } from "../cache";
import { isDatabricks } from "../client";
import { hcFiltersToQuery } from "./filters";
import type {
  HcDesempenhoView,
  HcFilters,
  HcFilterOptions,
  HcFilterTuple,
  HcProdutividadeView,
  HcZeradosView,
  ProdutividadeGrouping,
} from "./types";
import type { MatrizView } from "./databricks";

// Bump on any change to the shape OR the maths of a cached value: the
// in-process cache survives a hot-reload and would keep serving the old one.
export const HC_CACHE_VERSION = "v3";

export class HcMockUnsupportedError extends Error {
  constructor() {
    super("O módulo HC Zerado lê apenas dados reais (DATA_SOURCE=mock não é suportado).");
    this.name = "HcMockUnsupportedError";
  }
}

function cacheKey(build: string, f: HcFilters, view: MatrizView): string {
  return `hc:${HC_CACHE_VERSION}:${build}:desempenho:${view}:${hcFiltersToQuery(f)}`;
}

export async function getHcDesempenho(f: HcFilters, view: MatrizView): Promise<HcDesempenhoView> {
  if (!isDatabricks()) throw new HcMockUnsupportedError();

  const { databricksHcWatermark, HC_ADAPTER_BUILD } = await import("./source");
  const { databricksHcDesempenho } = await import("./databricks");
  const watermark = await databricksHcWatermark();

  return cachedByWatermark<HcDesempenhoView>(cacheKey(HC_ADAPTER_BUILD, f, view), watermark, () =>
    databricksHcDesempenho(f, view),
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

/**
 * Each dropdown offers what survives every *other* filter, so the cascade runs
 * in both directions. Only the filters that DROP rows take part: serviço,
 * indicador, status and agilidade zero a sale without removing the person (see
 * `filters.ts`), so they never shrink a list — not even their own.
 */
function cascade(tuples: HcFilterTuple[], f: HcFilters): HcFilterOptions {
  const has = (sel: string[], v: string) => sel.length === 0 || sel.includes(v);

  const survives = (t: HcFilterTuple, except: keyof HcFilters): boolean =>
    (except === "gerente" || has(f.gerente, t.gerente)) &&
    (except === "coordenacao" || has(f.coordenacao, t.coordenacao)) &&
    (except === "supervisao" || has(f.supervisao, t.supervisao)) &&
    (except === "lider" || has(f.lider, t.lider)) &&
    (except === "cidade" || has(f.cidade, t.cidade)) &&
    (except === "consultor" || has(f.consultor, t.consultor)) &&
    (except === "canal" || has(f.canal, t.canal)) &&
    (except === "nicho" || has(f.nicho, t.nicho)) &&
    (!f.perfilCidade || t.perfil === f.perfilCidade) &&
    (!f.experiencia || t.experiencia === f.experiencia);

  const list = (field: keyof HcFilterTuple, except: keyof HcFilters): string[] => {
    const seen = new Set<string>();

    for (const t of tuples) {
      const v = t[field];

      if (v && survives(t, except)) seen.add(v);
    }

    return [...seen].sort((a, b) => a.localeCompare(b, "pt-BR"));
  };

  return {
    gerentes: list("gerente", "gerente"),
    coordenacoes: list("coordenacao", "coordenacao"),
    supervisoes: list("supervisao", "supervisao"),
    lideres: list("lider", "lider"),
    cidades: list("cidade", "cidade"),
    consultores: list("consultor", "consultor"),
    canais: list("canal", "canal"),
    nichos: list("nicho", "nicho"),
    servicos: list("servico", "servico"),
    indicadores: list("indicador", "indicador"),
  };
}

export async function getHcFilterOptions(f: HcFilters): Promise<HcFilterOptions> {
  if (!isDatabricks()) return EMPTY_OPTIONS;

  const { databricksHcWatermark, HC_ADAPTER_BUILD } = await import("./source");
  const { databricksHcFilterTuples } = await import("./databricks");

  try {
    const watermark = await databricksHcWatermark();
    // Keyed by period only — the cascade is pure, so a filter click reuses these.
    const tuples = await cachedByWatermark<HcFilterTuple[]>(
      `hc:${HC_CACHE_VERSION}:${HC_ADAPTER_BUILD}:tuplas:${f.from}:${f.to}`,
      watermark,
      () => databricksHcFilterTuples(f.from, f.to),
    );

    return cascade(tuples, f);
  } catch {
    // A failed option list degrades the dropdowns, never the screen.
    return EMPTY_OPTIONS;
  }
}

/**
 * Tela 2. The two tabs are cached apart so switching the grouping of one leaves
 * the other's aggregation untouched.
 */
export async function getHcProdutividade(
  f: HcFilters,
  grouping: ProdutividadeGrouping,
): Promise<HcProdutividadeView> {
  if (!isDatabricks()) throw new HcMockUnsupportedError();

  const { databricksHcWatermark, HC_ADAPTER_BUILD } = await import("./source");
  const { databricksHcProdutividade } = await import("./produtividade");
  const watermark = await databricksHcWatermark();

  return cachedByWatermark<HcProdutividadeView>(
    `hc:${HC_CACHE_VERSION}:${HC_ADAPTER_BUILD}:produtividade:${grouping}:${hcFiltersToQuery(f)}`,
    watermark,
    () => databricksHcProdutividade(f, grouping),
  );
}

export async function getHcZerados(f: HcFilters, grouping: ProdutividadeGrouping): Promise<HcZeradosView> {
  if (!isDatabricks()) throw new HcMockUnsupportedError();

  const { databricksHcWatermark, HC_ADAPTER_BUILD } = await import("./source");
  const { databricksHcZerados } = await import("./produtividade");
  const watermark = await databricksHcWatermark();

  return cachedByWatermark<HcZeradosView>(
    `hc:${HC_CACHE_VERSION}:${HC_ADAPTER_BUILD}:zerados:${grouping}:${hcFiltersToQuery(f)}`,
    watermark,
    () => databricksHcZerados(f, grouping),
  );
}
