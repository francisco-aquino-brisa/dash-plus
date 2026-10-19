import "server-only";

import { cachedByWatermark } from "../cache";
import { runSourceBatch, sumPartials, type BatchRow } from "../indicators/batch";
import { buildBlocks, type IndicatorBlock, type IndicatorBlocksVM } from "../indicators/block-cards";
import { pageEntries, type TechVariant } from "../indicators/cards";
import { catalogVersion, readScreenCatalog, type CatalogEntry } from "../indicators/screen-catalog";
import type { MonthPartial } from "../indicators/values";
import type { Filters } from "./types";

const ROTA = "/dashboard";

/** Per-city partials of every catalog indicator on this page, by source; null = the source failed. */
interface CityPartials {
  bySource: Map<string, BatchRow[] | null>;
}

async function loadCityPartials(): Promise<CityPartials> {
  const catalog = await readScreenCatalog();
  const byFonte = new Map<string, CatalogEntry[]>();

  for (const e of pageEntries(catalog, ROTA)) {
    const list = byFonte.get(e.spec.fonte) ?? [];

    list.push(e);
    byFonte.set(e.spec.fonte, list);
  }

  const fontes = [...byFonte.keys()];
  const results = await Promise.all(
    fontes.map(async (fonte) => {
      try {
        return await runSourceBatch(
          fonte,
          byFonte.get(fonte)!.map((e) => ({ key: e.id, spec: e.spec })),
          catalog.columns[fonte] ?? [],
          { groupBy: [{ alias: "cidade", expr: "revan_cidade_id" }] },
        );
      } catch (err) {
        console.warn(
          `[cities] indicadores do cadastro: fonte indisponível (${fonte}):`,
          (err as Error).message,
        );

        return null;
      }
    }),
  );

  return { bySource: new Map(fontes.map((f, i) => [f, results[i]])) };
}

/** Cached with the cities dataset's watermark, and dropped whenever the catalog is edited. */
function cityPartials(watermark: string): Promise<CityPartials> {
  return cachedByWatermark(
    "cities:catalog-partials:v1",
    `${watermark}|${catalogVersion()}`,
    loadCityPartials,
  );
}

/** The technology variant each block shows under the Tecnologia filter. */
function variantFor(block: IndicatorBlock, tecnologia: string): TechVariant {
  if (block === "5g") return "5G";

  return tecnologia === "FTTH" ? "FTTH" : tecnologia === "FWA" ? "FWA" : "BL";
}

/**
 * The catalog-driven indicator blocks. `cidades` is the set of `revan_cidade_id`
 * the reader's scope and filters admit (null = no narrowing, which keeps the rows
 * without a city too).
 */
export async function buildCatalogBlocks(
  watermark: string,
  months: string[],
  filters: Filters,
  cidades: Set<string> | null,
): Promise<IndicatorBlocksVM> {
  const [catalog, partials] = await Promise.all([readScreenCatalog(), cityPartials(watermark)]);
  const keep = cidades ? (g: Record<string, string>) => cidades.has(g.cidade) : undefined;
  const series = new Map<string, Map<string, MonthPartial>>();
  const failed = new Set<string>();

  for (const [fonte, rows] of partials.bySource) {
    // A source with no city on any row can't be narrowed: zero would be a lie.
    if (!rows || (cidades && !rows.some((r) => r.group.cidade !== ""))) {
      failed.add(fonte);
      continue;
    }

    for (const [key, byMonth] of sumPartials(rows, keep)) series.set(key, byMonth);
  }

  return buildBlocks({
    catalog,
    rota: ROTA,
    series,
    failed,
    months,
    // The cube's months are `yyyy-MM-01`; the catalog sources key by `yyyy-MM`.
    yms: months.map((m) => m.slice(0, 7)),
    competencia: filters.competencia,
    variant: (block) => variantFor(block, filters.tecnologia),
  });
}
