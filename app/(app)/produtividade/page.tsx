import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getProdView, buildProdFilterOptions } from "@/lib/data/produtividade/repository";
import { defaultProdRange } from "@/lib/data/produtividade/dates";
import { ProdDashboard } from "@/components/produtividade/ProdDashboard";
import type { ManagementMode, ProdFilters } from "@/lib/data/produtividade/types";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function parseFilters(sp: SearchParams): ProdFilters {
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const def = defaultProdRange();
  const mode: ManagementMode = get("modo") === "canais" ? "canais" : "externas";
  return {
    from: get("de") || def.from,
    to: get("ate") || def.to,
    mode,
    servico: get("servico"),
    gerencia: get("gerencia"),
    coordenacao: get("coordenacao"),
    gerente: get("gerente"),
    nicho: get("nicho"),
    cidade: get("cidade"),
  };
}

export default async function ProdutividadePage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const filters = parseFilters(searchParams);
  const [view, options] = await Promise.all([getProdView(filters), buildProdFilterOptions()]);

  return <ProdDashboard view={view} options={options} usesMock={view.source === "mock"} />;
}
