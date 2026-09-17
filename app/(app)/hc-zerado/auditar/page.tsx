import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AuditarScreen } from "@/components/hc-zerado/AuditarScreen";
import { HcNoSource } from "@/components/hc-zerado/HcNoSource";
import { parseHcFilters } from "@/lib/data/hc-zerado/filters";
import { isStatus } from "@/lib/data/hc-zerado/catalog";
import { getHcAuditar, getHcFilterOptions, HcMockUnsupportedError } from "@/lib/data/hc-zerado/repository";
import type { JustificativaStatus } from "@/lib/data/hc-zerado/types";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function one(sp: SearchParams, key: string): string {
  const v = sp[key];

  return typeof v === "string" ? v.trim() : "";
}

export default async function AuditarHcPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();

  if (!session) redirect("/bootstrap?next=/hc-zerado/auditar");

  const filters = parseHcFilters(searchParams);
  const requested = one(searchParams, "st");
  const status: JustificativaStatus | "Todos" = isStatus(requested) ? requested : "Todos";
  const categorias = one(searchParams, "cat")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 50);

  try {
    const [view, options] = await Promise.all([getHcAuditar(filters), getHcFilterOptions(filters)]);

    return (
      <AuditarScreen
        view={view}
        filters={filters}
        options={options}
        status={status}
        categorias={categorias}
      />
    );
  } catch (error) {
    if (error instanceof HcMockUnsupportedError) return <HcNoSource reason={error.message} />;

    throw error;
  }
}
