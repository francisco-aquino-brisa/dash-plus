import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { MatrizScreen } from "@/components/hc-zerado/MatrizScreen";
import { HcNoSource } from "@/components/hc-zerado/HcNoSource";
import { parseHcFilters } from "@/lib/data/hc-zerado/filters";
import { getHcFilterOptions, getHcMatriz, HcMockUnsupportedError } from "@/lib/data/hc-zerado/repository";
import type { OciosidadeGrouping } from "@/lib/data/hc-zerado/types";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const GROUPINGS: OciosidadeGrouping[] = ["gerencia", "coordenacao", "cidade"];

export default async function MatrizHcPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();

  if (!session) redirect("/bootstrap?next=/hc-zerado/matriz");

  const filters = parseHcFilters(searchParams);
  const requested =
    typeof searchParams.mg === "string" ? (searchParams.mg as OciosidadeGrouping) : "gerencia";
  const grouping = GROUPINGS.includes(requested) ? requested : "gerencia";

  try {
    const [view, options] = await Promise.all([getHcMatriz(filters, grouping), getHcFilterOptions(filters)]);

    return <MatrizScreen view={view} filters={filters} options={options} grouping={grouping} />;
  } catch (error) {
    if (error instanceof HcMockUnsupportedError) return <HcNoSource reason={error.message} />;

    throw error;
  }
}
