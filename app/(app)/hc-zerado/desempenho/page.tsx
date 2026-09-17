import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { DesempenhoScreen } from "@/components/hc-zerado/DesempenhoScreen";
import { HcNoSource } from "@/components/hc-zerado/HcNoSource";
import { parseHcFilters } from "@/lib/data/hc-zerado/filters";
import { getHcDesempenho, getHcFilterOptions, HcMockUnsupportedError } from "@/lib/data/hc-zerado/repository";
import type { MatrizView } from "@/lib/data/hc-zerado/databricks";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const VIEWS: MatrizView[] = ["consultor", "gerencia", "coordenacao", "cidade"];

export default async function DesempenhoHcPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();

  if (!session) redirect("/bootstrap?next=/hc-zerado/desempenho");

  const filters = parseHcFilters(searchParams);
  const requested =
    typeof searchParams.matriz === "string" ? (searchParams.matriz as MatrizView) : "consultor";
  const matrizView = VIEWS.includes(requested) ? requested : "consultor";

  try {
    const [view, options] = await Promise.all([
      getHcDesempenho(filters, matrizView),
      getHcFilterOptions(filters),
    ]);

    return <DesempenhoScreen view={view} filters={filters} options={options} />;
  } catch (error) {
    if (error instanceof HcMockUnsupportedError) return <HcNoSource reason={error.message} />;

    throw error;
  }
}
