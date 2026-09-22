// Cities repository: the single entry point the screen uses to get data.
// Chooses mock vs Databricks by DATA_SOURCE, and wraps the heavy fetch in the
// global watermark-aware cache (see ADR 0002).
//
// Scoped by CITY, not by person: this dataset has no CPF to narrow on (see
// ADR 0008). `getScopedCityDataset` is what screens must call — `getCityDataset`
// returns every city and exists so the cache stays shared.
//
// The narrowing runs in memory, AFTER the cache read, which is why the single
// global CACHE_KEY below is still correct: one dataset is fetched and cached for
// everyone, and each reader gets their slice of it. Keying the cache by scope
// would refetch ~93k rows per distinct scope for no gain.

import { currentCityScope, type CityScope } from "@/lib/auth/city-scope";
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

export function applyCityScope(dataset: CityDataset, scope: CityScope): CityDataset {
  if (scope.all) return dataset;

  const records = dataset.records.filter((r) => scope.cities.has(Number(r.revan_cidade_id)));
  // metas key on the source `id_cidade`, not on revan — carry over only the
  // ones whose city survived, or the KPI denominators keep the hidden cities.
  const kept = new Set(records.map((r) => r.id_cidade_src));

  return {
    ...dataset,
    records,
    metaRecords: dataset.metaRecords.filter((m) => kept.has(m.id_cidade)),
  };
}

/** The dataset narrowed to the cities the current reader answers for. */
export async function getScopedCityDataset(): Promise<CityDataset> {
  const [dataset, scope] = await Promise.all([getCityDataset(), currentCityScope()]);

  return applyCityScope(dataset, scope);
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
