// Cities repository: the single entry point the screen uses to get data.
// Chooses mock vs Databricks by DATA_SOURCE, and wraps the heavy fetch in the
// global watermark-aware cache (see ADR 0002).

import { cachedByWatermark } from "../cache";
import { isDatabricks } from "../client";
import { mockCityDataset } from "./mock";
import type { CityDataset, FilterOptions } from "./types";

const CACHE_KEY = "cities:dataset:v1";

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
      .filter((v) => v && !PLACEHOLDER.has(v.toUpperCase()))
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
