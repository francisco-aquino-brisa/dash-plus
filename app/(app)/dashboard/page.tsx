import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { currentCityScope } from "@/lib/auth/city-scope";
import { getScopedCityDataset, buildFilterOptions } from "@/lib/data/cities/repository";
import { buildDashboardView } from "@/lib/data/cities/compute";
import { getCacheConfig } from "@/lib/data/config";
import { isDatabricks } from "@/lib/data/client";
import { Dashboard } from "@/components/dashboard/Dashboard";
import type { Filters } from "@/lib/data/cities/types";

// Server-rendered per request; the heavy fetch is served from the watermark-aware
// cache (ADR 0002) and all KPI math runs here, so the client receives a small
// view-model instead of the full ~93k-row dataset.
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function parseFilters(sp: SearchParams, months: string[]): Filters {
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const latest = months[months.length - 1] ?? "";
  const mes = get("mes");

  return {
    competencia: mes && months.includes(mes) ? mes : latest,
    gerencia: get("gerencia"),
    coordenacao: get("coordenacao"),
    tipoCidade: get("tipo"),
    cidade: get("cidade"),
    tecnologia: get("tec"),
  };
}

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();

  if (!session) redirect("/bootstrap?next=/dashboard");

  const [dataset, scope] = await Promise.all([getScopedCityDataset(), currentCityScope()]);

  if (!scope.all && dataset.records.length === 0) return <SemCidades />;

  const options = buildFilterOptions(dataset);
  const filters = parseFilters(searchParams, dataset.months);
  const view = buildDashboardView(dataset.records, dataset.metaRecords, dataset.months, filters);
  const cfg = getCacheConfig();

  return (
    <Dashboard
      view={view}
      options={options}
      cache={{ autoRefresh: cfg.autoRefresh, pollSeconds: cfg.pollSeconds }}
      isMock={!isDatabricks()}
      watermark={dataset.watermark}
    />
  );
}

function SemCidades() {
  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "60vh", padding: 24 }}>
      <div
        style={{
          maxWidth: 460,
          textAlign: "center",
          padding: "28px 26px",
          borderRadius: 16,
          border: "1px solid var(--s-border)",
          background: "var(--s-card)",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--s-t1)" }}>
          Nenhuma cidade atribuída
        </h2>
        <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.6, color: "var(--s-t3)" }}>
          Você ainda não responde por nenhuma cidade, e a supervisão acima de você também não tem cidades
          vinculadas. Peça à administração para fazer o vínculo em Administração › Cidades por supervisão.
        </p>
      </div>
    </div>
  );
}
