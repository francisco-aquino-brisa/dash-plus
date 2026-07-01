import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getVendedorView, buildVendedorFilterOptions } from "@/lib/data/vendedor/repository";
import { defaultCompetencia } from "@/lib/data/vendedor/dates";
import { VendedorDashboard } from "@/components/vendedor/VendedorDashboard";
import type { VendedorFilters } from "@/lib/data/vendedor/types";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function parseFilters(sp: SearchParams): VendedorFilters {
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  return {
    matricula: get("matricula"),
    competencia: get("competencia") || defaultCompetencia(),
  };
}

export default async function VendedorPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const filters = parseFilters(searchParams);
  const [view, options] = await Promise.all([
    getVendedorView(filters),
    buildVendedorFilterOptions(filters.competencia),
  ]);

  return <VendedorDashboard view={view} options={options} usesMock={view.source === "mock"} />;
}
