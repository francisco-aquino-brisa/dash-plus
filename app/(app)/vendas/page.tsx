import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getSalesView, buildSalesFilterOptions } from "@/lib/data/sales/repository";
import { SalesDashboard } from "@/components/sales/SalesDashboard";
import type { SalesFilters } from "@/lib/data/sales/types";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function parseFilters(sp: SearchParams): SalesFilters {
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const periodo = get("periodo");
  const de = get("de");
  const ate = get("ate");

  return {
    period: periodo || (de || ate ? "custom" : "mes_atual"),
    from: de || undefined,
    to: ate || undefined,
    servico: get("servico"),
    gerente: get("gerente"),
    canal: get("canal"),
    nicho: get("nicho"),
    uf: get("uf"),
    cidade: get("cidade"),
    tipo: get("tipo"),
  };
}

export default async function VendasPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();

  if (!session) redirect("/login");

  const filters = parseFilters(searchParams);
  const [view, options] = await Promise.all([getSalesView(filters), buildSalesFilterOptions()]);

  return <SalesDashboard view={view} options={options} usesMock={view.source === "mock"} />;
}
