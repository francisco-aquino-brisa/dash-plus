import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { ProdutividadeScreen, type ProdutividadeTab } from "@/components/hc-zerado/ProdutividadeScreen";
import { HcNoSource } from "@/components/hc-zerado/HcNoSource";
import { parseHcFilters } from "@/lib/data/hc-zerado/filters";
import {
  getHcFilterOptions,
  getHcProdutividade,
  getHcZerados,
  HcMockUnsupportedError,
} from "@/lib/data/hc-zerado/repository";
import type { ProdutividadeGrouping } from "@/lib/data/hc-zerado/types";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const GROUPINGS: ProdutividadeGrouping[] = ["vendedor", "gerencia", "coordenacao", "cidade"];

/** Each tab keeps its own hierarchy, so switching one does not re-aggregate the other. */
function grouping(sp: SearchParams, key: string): ProdutividadeGrouping {
  const value = typeof sp[key] === "string" ? (sp[key] as ProdutividadeGrouping) : "vendedor";

  return GROUPINGS.includes(value) ? value : "vendedor";
}

export default async function ProdutividadeHcPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();

  if (!session) redirect("/bootstrap?next=/hc-zerado/produtividade");

  const filters = parseHcFilters(searchParams);
  const grupos = { produtividade: grouping(searchParams, "ap"), zerados: grouping(searchParams, "az") };
  // The open tab rides in the URL so a hierarchy change does not send the user
  // back to the first one when the route remounts.
  const tab: ProdutividadeTab = searchParams.aba === "zerados" ? "zerados" : "produtividade";

  try {
    const [produtividade, zerados, options] = await Promise.all([
      getHcProdutividade(filters, grupos.produtividade),
      getHcZerados(filters, grupos.zerados),
      getHcFilterOptions(filters),
    ]);

    return (
      <ProdutividadeScreen
        produtividade={produtividade}
        zerados={zerados}
        filters={filters}
        options={options}
        grouping={grupos}
        tab={tab}
      />
    );
  } catch (error) {
    if (error instanceof HcMockUnsupportedError) return <HcNoSource reason={error.message} />;

    throw error;
  }
}
