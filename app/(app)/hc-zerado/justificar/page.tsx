import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { JustificarScreen, type JustificarTab } from "@/components/hc-zerado/JustificarScreen";
import { HcNoSource } from "@/components/hc-zerado/HcNoSource";
import { parseHcFilters } from "@/lib/data/hc-zerado/filters";
import { getHcFilterOptions, getHcJustificar, HcMockUnsupportedError } from "@/lib/data/hc-zerado/repository";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const TABS: JustificarTab[] = ["Todos", "Pendente", "Em Análise", "Aprovado", "Rejeitado"];

export default async function JustificarHcPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();

  if (!session) redirect("/bootstrap?next=/hc-zerado/justificar");

  const filters = parseHcFilters(searchParams);
  const requested = typeof searchParams.jf === "string" ? (searchParams.jf as JustificarTab) : "Todos";
  const tab = TABS.includes(requested) ? requested : "Todos";

  try {
    const [view, options] = await Promise.all([getHcJustificar(filters), getHcFilterOptions(filters)]);

    return <JustificarScreen view={view} filters={filters} options={options} tab={tab} />;
  } catch (error) {
    if (error instanceof HcMockUnsupportedError) return <HcNoSource reason={error.message} />;

    throw error;
  }
}
