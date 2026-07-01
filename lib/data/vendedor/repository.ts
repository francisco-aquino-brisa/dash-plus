// Vendedor repository: single entry point the screen uses. Aggregation runs at
// the source (SQL) per (matricula, competência) and is cached by (filters,
// watermark) — ADR 0002. Real → mock fallback on warehouse error; mock mode → mock.

import { cachedByWatermark } from "../cache";
import { isDatabricks } from "../client";
import { resolveCompetencia } from "./dates";
import { mockVendedorFilterOptions, mockVendedorView } from "./mock";
import type { VendedorFilters, VendedorFilterOptions, VendedorView } from "./types";

function cacheKey(f: VendedorFilters): string {
  return `vendedor:v1:${f.matricula}|${resolveCompetencia(f.competencia).ym}`;
}

export async function getVendedorView(filters: VendedorFilters): Promise<VendedorView> {
  if (isDatabricks()) {
    try {
      const { databricksVendedorWatermark, databricksVendedorView } = await import("./databricks");
      const watermark = await databricksVendedorWatermark();
      return await cachedByWatermark<VendedorView>(cacheKey(filters), watermark, () => databricksVendedorView(filters));
    } catch (e) {
      console.warn("[vendedor] databricks failed, falling back to mock:", (e as Error).message);
      return mockVendedorView(filters);
    }
  }
  return cachedByWatermark<VendedorView>(cacheKey(filters), "mock:vendedor", async () => mockVendedorView(filters));
}

export async function buildVendedorFilterOptions(competencia: string): Promise<VendedorFilterOptions> {
  const base = mockVendedorFilterOptions();
  if (!isDatabricks()) return base;
  try {
    const { databricksVendedorFilterOptions } = await import("./databricks");
    const real = await databricksVendedorFilterOptions(resolveCompetencia(competencia).ym);
    return {
      vendedores: real.vendedores?.length ? real.vendedores : base.vendedores,
      competencias: real.competencias?.length ? real.competencias : base.competencias,
    };
  } catch {
    return base;
  }
}
