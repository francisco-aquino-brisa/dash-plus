import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { currentCityScope } from "@/lib/auth/city-scope";
import { applyEstrutura, getScopedCityDataset, getVinculosEstrutura } from "@/lib/data/cities/repository";
import { buildFilterOptions, buildTuplas, cidadesDaEstrutura } from "@/lib/data/cities/estrutura-filtros";
import { buildDashboardView } from "@/lib/data/cities/compute";
import { getCacheConfig } from "@/lib/data/config";
import { isDatabricks } from "@/lib/data/client";
import { Dashboard } from "@/components/dashboard/Dashboard";
import type { DashboardFilters } from "@/lib/data/cities/types";

// Server-rendered per request; the heavy fetch is served from the watermark-aware
// cache (ADR 0002) and all KPI math runs here, so the client receives a small
// view-model instead of the full ~93k-row dataset.
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function parseFilters(sp: SearchParams, months: string[]): DashboardFilters {
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const list = (k: string) =>
    get(k)
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  const latest = months[months.length - 1] ?? "";
  const mes = get("mes");

  return {
    competencia: mes && months.includes(mes) ? mes : latest,
    gerencia: list("gerencia"),
    coordenacao: list("coordenacao"),
    supervisao: list("supervisao"),
    tipoCidade: get("tipo"),
    cidade: list("cidade"),
    tecnologia: get("tec"),
  };
}

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();

  if (!session) redirect("/bootstrap?next=/dashboard");

  const [dataset, scope] = await Promise.all([getScopedCityDataset(), currentCityScope()]);

  if (!scope.all && dataset.records.length === 0) return <SemCidades />;

  const escopo = scope.all ? null : resumirEscopo(dataset);
  const filters = parseFilters(searchParams, dataset.months);
  const tuplas = buildTuplas(dataset, await getVinculosEstrutura(dataset));
  const options = buildFilterOptions(dataset, tuplas, filters);
  const recortado = applyEstrutura(dataset, cidadesDaEstrutura(tuplas, filters));
  const view = buildDashboardView(recortado.records, recortado.metaRecords, dataset.months, filters);
  const cfg = getCacheConfig();

  return (
    <Dashboard
      view={view}
      options={options}
      cache={{ autoRefresh: cfg.autoRefresh, pollSeconds: cfg.pollSeconds }}
      isMock={!isDatabricks()}
      watermark={dataset.watermark}
      escopo={escopo}
    />
  );
}

/** The reader's slice, for the discreet hint next to the subtitle. */
function resumirEscopo(dataset: { records: { cidade: string }[] }) {
  const nomes = [...new Set(dataset.records.map((r) => r.cidade).filter(Boolean))].sort();

  return { total: nomes.length, nomes };
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
          Você ainda não responde por nenhuma cidade. Fale com a administração do dashboard para liberar o seu
          acesso.
        </p>
      </div>
    </div>
  );
}
