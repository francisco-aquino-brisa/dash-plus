// Organograma repository — the only module the route/actions call into.
// Chooses mock vs Databricks by DATA_SOURCE and caches the (small) hierarchy
// snapshot by watermark, same pattern as lib/data/cities/repository.ts. The
// per-person chart is then computed in memory (compute.ts) instead of one
// round-trip per viewer — see the plan's "why load it all" note.

import { cachedByWatermark } from "../cache";
import { isDatabricks } from "../client";
import { buildOrgChart } from "./compute";
import { mockHierarquiaSnapshot } from "./mock";
import type { HierarquiaSnapshot, OrgChartResult, OrgCidade, OrgTreeNode } from "./types";

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

/** Every `id_estrutura` the chart draws — ancestors, subtree roots and their nodes. */
function chartPaths(chart: OrgChartResult): string[] {
  const paths: string[] = chart.ancestors.map((a) => a.path);

  const walk = (node: OrgTreeNode) => {
    paths.push(node.path);
    node.children.forEach(walk);
  };

  chart.subtrees.forEach(walk);

  return paths;
}

/**
 * City bindings are NOT cached with the hierarchy snapshot: the admin screen
 * writes them, and a watermark that only moves when the RH reloads would serve
 * yesterday's bindings for a day.
 */
async function getCidadesPorNo(): Promise<Record<string, OrgCidade[]>> {
  if (!isDatabricks()) return {};

  const { readCidadesPorNo } = await import("./cidades");

  return readCidadesPorNo();
}

/** The chart for one CPF, or `null` when the CPF is absent/not in the hierarchy. */
export async function getOrgChartForCpf(cpf: string | null | undefined): Promise<OrgChartResult | null> {
  if (!cpf) return null;

  const [snapshot, cidades] = await Promise.all([getHierarquiaSnapshot(), getCidadesPorNo()]);
  const chart = buildOrgChart(snapshot, cpf);

  if (!chart) return null;

  const visiveis = Object.fromEntries(
    chartPaths(chart)
      .map((path) => [path, cidades[path]] as const)
      .filter(([, lista]) => lista?.length),
  );

  return { ...chart, cidades: visiveis };
}
