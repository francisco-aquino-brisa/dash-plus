// Organograma repository — the only module the route/actions call into.
// Chooses mock vs Databricks by DATA_SOURCE and caches the (small) hierarchy
// snapshot by watermark, same pattern as lib/data/cities/repository.ts. The
// per-person chart is then computed in memory (compute.ts) instead of one
// round-trip per viewer — see the plan's "why load it all" note.

import { cachedByWatermark } from "../cache";
import { isDatabricks } from "../client";
import { buildOrgChart } from "./compute";
import { mockHierarquiaSnapshot } from "./mock";
import type { HierarquiaSnapshot, OrgChartResult } from "./types";

const CACHE_KEY = "organograma:snapshot:v1";

async function getWatermark(): Promise<string> {
  if (isDatabricks()) {
    const { databricksHierarquiaWatermark } = await import("./databricks");

    return databricksHierarquiaWatermark();
  }

  return mockHierarquiaSnapshot().watermark;
}

async function getHierarquiaSnapshot(): Promise<HierarquiaSnapshot> {
  const watermark = await getWatermark();

  return cachedByWatermark<HierarquiaSnapshot>(CACHE_KEY, watermark, async () => {
    if (isDatabricks()) {
      const { databricksHierarquiaSnapshot } = await import("./databricks");

      return databricksHierarquiaSnapshot();
    }

    return mockHierarquiaSnapshot();
  });
}

/** The chart for one CPF, or `null` when the CPF is absent/not in the hierarchy. */
export async function getOrgChartForCpf(cpf: string | null | undefined): Promise<OrgChartResult | null> {
  if (!cpf) return null;

  const snapshot = await getHierarquiaSnapshot();

  return buildOrgChart(snapshot, cpf);
}
