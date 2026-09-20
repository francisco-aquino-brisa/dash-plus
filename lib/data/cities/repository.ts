// Cities repository: the single entry point the screen uses to get data.
// Chooses mock vs Databricks by DATA_SOURCE, and wraps the heavy fetch in the
// global watermark-aware cache (see ADR 0002).
//
// NOT scoped by hierarchy, and it cannot be — this is not an oversight (see
// docs/hierarquia-permissionamento.md). Every other module narrows rows by the
// person behind them, and this one has no person: the subject is the city.
// `vw_indicadores_cidades` carries no CPF at all, and the sources that do
// (waves, 5g, churn, portabilidade) are collapsed to `revan_cidade_id` before
// they get here — a city's base ativa is not attributable to sellers anyway.
//
// Narrowing it needs the OTHER axis: `id_estrutura` on `vw_organograma_cidades`,
// so a city can be tested for containment in the reader's subtree the same way a
// person is. That request is with the data team. Until it lands, restrict this
// screen by NÍVEL (who may open it), not by escopo (what they see inside).
//
// The single global CACHE_KEY below is part of the same fact: one dataset serves
// every reader. It has to become scope-keyed on the day this is narrowed.

import { cachedByWatermark } from "../cache";
import { isDatabricks } from "../client";
import { mockCityDataset } from "./mock";
import type { CityDataset, FilterOptions } from "./types";

// v2: cidade names are now slash-normalized ("CIDADE / UF") in the adapter, so
// the cached dataset shape changed — bump the key to discard pre-normalization
// entries instead of serving them until the watermark advances.
// v3: dropped the empty/'/'-cidade WHERE filters so unassigned rows are counted
// again when no filter is applied — bump to discard the filtered dataset.
// v4: migrated to the `vw_*` layer in projeto_brisa_performance and re-keyed the
// commercial enrich joins on `revan_cidade_id` (was city-name) — new numbers.
const CACHE_KEY = "cities:dataset:v5";

/** Cheap freshness probe used by the auto-refresh flag. */
export async function getCitiesWatermark(): Promise<string> {
  if (isDatabricks()) {
    const { databricksWatermark } = await import("./databricks");

    return databricksWatermark();
  }

  return mockCityDataset().watermark;
}

/** The full per-city/month dataset, cached until the source watermark advances. */
export async function getCityDataset(): Promise<CityDataset> {
  const watermark = await getCitiesWatermark();

  return cachedByWatermark<CityDataset>(CACHE_KEY, watermark, async () => {
    if (isDatabricks()) {
      const { databricksCityDataset } = await import("./databricks");

      return databricksCityDataset();
    }

    return mockCityDataset();
  });
}

/** Distinct filter option lists derived from the dataset. */
export function buildFilterOptions(dataset: CityDataset): FilterOptions {
  // Cities with no org (gerência "-"/"NAO REGISTRADO") stay in the dataset for
  // totals, but must not pollute the drill-down dropdowns.
  const PLACEHOLDER = new Set(["-", "NAO REGISTRADO", "NÃO REGISTRADO"]);
  const uniq = (xs: string[]) =>
    Array.from(new Set(xs))
      .filter((v) => v && v.trim() !== "" && !PLACEHOLDER.has(v.trim().toUpperCase()))
      .sort();

  return {
    meses: dataset.months,
    gerencias: uniq(dataset.records.map((r) => r.gerencia)),
    coordenacoes: uniq(dataset.records.map((r) => r.coordenacao)),
    tiposCidade: uniq(dataset.records.map((r) => r.tipo_cidade)),
    cidades: uniq(dataset.records.map((r) => r.cidade)),
    tecnologias: ["FTTH", "FWA", "Banda Larga", "5G"],
  };
}
