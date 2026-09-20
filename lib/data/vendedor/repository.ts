// Vendedor repository: single entry point the screen uses. Aggregation runs at
// the source (SQL) per (matricula, competência) and is cached by (filters,
// watermark) — ADR 0002. Databricks is the source of truth; we NEVER silently
// fall back to mock. Mock is served only in mock mode (DATA_SOURCE=mock).

import { currentScope, isInScope } from "@/lib/auth/scope";
import { ADAPTER_BUILD, cachedByWatermark } from "../cache";
import { isDatabricks } from "../client";
import { resolveCompetencia } from "./dates";
import { mockVendedorFilterOptions, mockVendedorView } from "./mock";
import { emptyVendedorView } from "./types";
import type { VendedorFilters, VendedorFilterOptions, VendedorOption, VendedorView } from "./types";

function cacheKey(f: VendedorFilters): string {
  return `vendedor:v4:${ADAPTER_BUILD}:${f.matricula}|${resolveCompetencia(f.competencia).ym}`;
}

/**
 * The screen resolves ONE seller, picked by matrícula. So the scope is not a row
 * filter here, it is an authorization check on the subject — without it anyone
 * could read any seller by editing the querystring, whatever the picker offers.
 *
 * Checked outside the cache on purpose: the view of a given seller is the same
 * for everyone entitled to it, so only the entitlement varies. Keeping the guard
 * out here lets the cached value stay shared instead of being duplicated per
 * scope.
 */
async function deniedView(filters: VendedorFilters): Promise<VendedorView | null> {
  const scope = await currentScope();

  if (await isInScope(scope, { matricula: filters.matricula })) return null;

  return emptyVendedorView(filters, resolveCompetencia(filters.competencia), "fora-do-escopo");
}

export async function getVendedorView(filters: VendedorFilters): Promise<VendedorView> {
  const denied = await deniedView(filters);

  if (denied) return denied;

  if (isDatabricks()) {
    const { databricksVendedorWatermark, databricksVendedorView } = await import("./databricks");
    const watermark = await databricksVendedorWatermark();

    return cachedByWatermark<VendedorView>(cacheKey(filters), watermark, () =>
      databricksVendedorView(filters),
    );
  }

  return cachedByWatermark<VendedorView>(cacheKey(filters), "mock:vendedor", async () =>
    mockVendedorView(filters),
  );
}

export async function buildVendedorFilterOptions(competencia: string): Promise<VendedorFilterOptions> {
  const base = mockVendedorFilterOptions();

  if (!isDatabricks()) return base;

  try {
    const { databricksVendedorFilterOptions } = await import("./databricks");
    const real = await databricksVendedorFilterOptions(resolveCompetencia(competencia).ym);

    return {
      // The vendedor list is not shipped anymore — the picker searches server-side.
      vendedores: [],
      competencias: real.competencias?.length ? real.competencias : base.competencias,
    };
  } catch {
    return base;
  }
}

/**
 * Search vendedores for the picker (max 100). Server-side against Databricks;
 * in mock mode, filters the mock list in memory. The screen no longer ships the
 * whole vendedor list to the client.
 */
export async function searchVendedores(
  competencia: string,
  query: string,
  limit = 100,
): Promise<VendedorOption[]> {
  if (!isDatabricks()) {
    const all = mockVendedorFilterOptions().vendedores;
    const q = query.trim().toLowerCase();
    const hits = q
      ? all.filter((v) => v.nome.toLowerCase().includes(q) || String(v.matricula).includes(q))
      : all;

    return hits.slice(0, limit);
  }

  const { databricksVendedorSearch } = await import("./databricks");

  return databricksVendedorSearch(resolveCompetencia(competencia).ym, query, await currentScope(), limit);
}
