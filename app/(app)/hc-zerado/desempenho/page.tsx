import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { DesempenhoScreen } from "@/components/hc-zerado/DesempenhoScreen";
import { HcSemFonte } from "@/components/hc-zerado/HcSemFonte";
import { parseHcFilters } from "@/lib/data/hc-zerado/filters";
import { getHcDesempenho, getHcFilterOptions, HcMockUnsupportedError } from "@/lib/data/hc-zerado/repository";
import type { MatrizVisao } from "@/lib/data/hc-zerado/databricks";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const VISOES: MatrizVisao[] = ["consultor", "gerencia", "coordenacao", "cidade"];

export default async function DesempenhoHcPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();

  if (!session) redirect("/bootstrap?next=/hc-zerado/desempenho");

  const filters = parseHcFilters(searchParams);
  const pedida = typeof searchParams.matriz === "string" ? (searchParams.matriz as MatrizVisao) : "consultor";
  const visao = VISOES.includes(pedida) ? pedida : "consultor";

  try {
    const [view, options] = await Promise.all([getHcDesempenho(filters, visao), getHcFilterOptions(filters)]);

    return <DesempenhoScreen view={view} filters={filters} options={options} />;
  } catch (error) {
    if (error instanceof HcMockUnsupportedError) return <HcSemFonte motivo={error.message} />;

    throw error;
  }
}
