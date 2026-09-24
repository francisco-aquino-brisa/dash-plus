"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { CitiesFilterBar } from "@/components/dashboard/CitiesFilterBar";
import { KpiBlock } from "@/components/dashboard/KpiBlock";
import { Quadrants } from "@/components/dashboard/Quadrants";
import { GrowthBlocks } from "@/components/dashboard/GrowthBlocks";
import { NegativesTable } from "@/components/dashboard/NegativesTable";
import { ChurnBlock, CoverageBlock, FunnelBlock } from "@/components/dashboard/ExtraBlocks";
import { DrillModal } from "@/components/dashboard/DrillModal";
import { TimeSeriesChart } from "@/components/ui/time-series-chart";
import type { DashboardView } from "@/lib/data/cities/compute";
import type { IndicatorCardVM } from "@/lib/data/cities/indicator-blocks";
import type { FilterOptions, Filters } from "@/lib/data/cities/types";
import { DEFAULT_SELECTION, SELECTION_PREF_KEY } from "@/lib/data/cities/indicators";
import { usePreference } from "@/lib/preferences/use-preference";
import { useReportNavPending } from "@/lib/ui/nav-pending";
import { formatMonth, formatNumber } from "@/lib/format";

interface Props {
  view: DashboardView;
  options: FilterOptions;
  cache: { autoRefresh: boolean; pollSeconds: number };
  isMock: boolean;
  watermark: string;
  /** Null for a reader who sees every city — then there is nothing to say. */
  escopo: { total: number; nomes: string[] } | null;
}

function toQuery(f: Filters): string {
  const p = new URLSearchParams();

  if (f.competencia) p.set("mes", f.competencia);

  if (f.gerencia) p.set("gerencia", f.gerencia);

  if (f.coordenacao) p.set("coordenacao", f.coordenacao);

  if (f.tipoCidade) p.set("tipo", f.tipoCidade);

  if (f.cidade) p.set("cidade", f.cidade);

  if (f.tecnologia) p.set("tec", f.tecnologia);

  return p.toString();
}

export function Dashboard({ view, options, cache, watermark, escopo }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { filters, kpis, growth, negatives, quartis, history, coverage, churn5g, desativados } = view;

  const [selected, setSelected] = useState<IndicatorCardVM | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Optimistic filters: the chips reflect the new value instantly, while the
  // server request (which recomputes the data) runs behind the transition. Sync
  // back whenever the server responds with a fresh view.
  const [uiFilters, setUiFilters] = useState<Filters>(view.filters);

  useEffect(() => {
    setUiFilters(view.filters);
  }, [view.filters]);

  // Drive the shell's brand loader while a filter navigation or a refresh runs.
  useReportNavPending(isPending || refreshing);

  const [blSelection, setBlSelection] = usePreference<string[]>(
    SELECTION_PREF_KEY["banda-larga"],
    DEFAULT_SELECTION["banda-larga"],
  );
  const [g5Selection, setG5Selection] = usePreference<string[]>(
    SELECTION_PREF_KEY["5g"],
    DEFAULT_SELECTION["5g"],
  );

  // The Tecnologia filter drives which blocks show (5G collapses to its block;
  // FTTH/FWA scope the BL block and hide 5G; empty / Banda Larga shows both).
  const tec = filters.tecnologia;
  const showBL = tec === "" || tec === "Banda Larga" || tec === "FTTH" || tec === "FWA";
  const showG5 = tec === "" || tec === "Banda Larga" || tec === "5G";

  const navigate = useCallback(
    (f: Filters) => {
      setUiFilters(f); // reflect the chip immediately, request afterwards
      const qs = toQuery(f);

      startTransition(() => router.push(qs ? `/dashboard?${qs}` : "/dashboard", { scroll: false }));
    },
    [router],
  );
  const latest = options.meses[options.meses.length - 1] ?? "";
  const resetFilters = useCallback(() => {
    setUiFilters({
      competencia: latest,
      gerencia: "",
      coordenacao: "",
      tipoCidade: "",
      cidade: "",
      tecnologia: "",
    });
    startTransition(() => router.push("/dashboard", { scroll: false }));
  }, [router, latest]);

  // Freshness polling: the cheap watermark probe refreshes only when the source
  // advances (see ADR 0002). Server-configured (cache.autoRefresh) — there is no
  // on-page toggle; the data-source status lives in the sidebar footer.
  const wmRef = useRef(watermark);

  wmRef.current = watermark;
  useEffect(() => {
    if (!cache.autoRefresh) return;

    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/cities/freshness", { cache: "no-store" });

        if (!res.ok) return;

        const data = (await res.json()) as { watermark: string };

        if (data.watermark && data.watermark !== wmRef.current) {
          setRefreshing(true);
          router.refresh();
          setTimeout(() => setRefreshing(false), 800);
        }
      } catch {
        /* best-effort */
      }
    }, cache.pollSeconds * 1000);

    return () => clearInterval(id);
  }, [cache.autoRefresh, cache.pollSeconds, router]);

  const manualRefresh = useCallback(() => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 800);
  }, [router]);

  const comp = formatMonth(filters.competencia);
  const efetCriado =
    kpis.vendasCriadas.resultado === 0
      ? 0
      : (kpis.vendasEfetivadas.resultado / kpis.vendasCriadas.resultado) * 100;
  const instEfet =
    kpis.vendasEfetivadas.resultado === 0
      ? 0
      : (kpis.vendasInstaladas.resultado / kpis.vendasEfetivadas.resultado) * 100;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: "16px 16px 40px",
        opacity: isPending ? 0.6 : 1,
        pointerEvents: isPending ? "none" : "auto",
        transition: "opacity .18s",
        animation: "bdIn .3s ease both",
      }}
    >
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          padding: "2px 2px 0",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: ".11em",
              textTransform: "uppercase",
              color: "var(--s-brand)",
            }}
          >
            Brisanet · Dashboard executivo
          </div>
          <h1
            style={{
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: "-.025em",
              lineHeight: 1.05,
              marginTop: 4,
            }}
          >
            Performance Cidades
          </h1>
          <p style={{ fontSize: 13, color: "var(--s-t3)", marginTop: 4 }}>
            Meta × realizado de banda larga por cidade, com drill por gerência, coordenação e cidade.
            {escopo && (
              <span
                // Deliberately quiet: it answers "por que meu total é menor que
                // o da empresa?" for whoever goes looking, without turning the
                // reader's own scope into a headline.
                title={`Seu escopo: ${escopo.nomes.join(", ")}`}
                style={{ marginLeft: 6, color: "var(--s-t3)", opacity: 0.65, cursor: "help" }}
              >
                · {escopo.total} cidade(s) no seu escopo
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={manualRefresh}
          className="bd-ghost"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            height: 34,
            padding: "0 14px",
            border: "1px solid var(--s-border)",
            borderRadius: 999,
            background: "var(--s-card)",
            color: "var(--s-t2)",
            font: "inherit",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            transition: ".16s",
          }}
        >
          <RefreshCw size={14} style={{ animation: refreshing ? "bdSpin 1s linear infinite" : undefined }} />
          Atualizar
        </button>
      </header>

      <CitiesFilterBar filters={uiFilters} options={options} onChange={navigate} onReset={resetFilters} />

      {/* KPI blocks */}
      {showBL && (
        <KpiBlock
          title="Banda Larga (INTERNET + FWA)"
          subtitle={`Meta × Realizado · ${comp} · toque num indicador para o histórico`}
          vms={view.blocks.bandaLarga}
          selection={blSelection}
          onSelectionChange={setBlSelection}
          onCardClick={setSelected}
        />
      )}
      {showG5 && (
        <KpiBlock
          title="5G"
          subtitle="Ativações, portabilidade, ticket e churn · toque para o histórico"
          vms={view.blocks.g5}
          selection={g5Selection}
          onSelectionChange={setG5Selection}
          onCardClick={setSelected}
        />
      )}

      {/* Crescimento de Base */}
      <GrowthBlocks
        growth={growth}
        summary={{
          meta: kpis.crescimentoBase.meta,
          resultado: kpis.crescimentoBase.resultado,
          atingimento: kpis.crescimentoBase.atingimento,
        }}
      />

      {/* Histórico de Crescimento */}
      <section
        style={{
          border: "1px solid var(--s-border)",
          borderRadius: "var(--r-panel)",
          background: "var(--s-card)",
          padding: 15,
          boxShadow: "var(--s-sh)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div>
          <h3
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: 15,
              letterSpacing: "-.02em",
            }}
          >
            Histórico de Crescimento
          </h3>
          <div style={{ fontSize: 11.5, color: "var(--s-t3)", marginTop: 2 }}>
            Soma do crescimento mensal · últimos 12 meses
          </div>
        </div>
        <TimeSeriesChart
          data={history.map((h) => ({ label: formatMonth(h.mes), value: h.valor, meta: h.target ?? null }))}
          formatValue={(n) => formatNumber(n)}
          height={230}
          selectableRange
        />
      </section>

      {/* Bloco 5 · Churn (FTTH/FWA/BL + 5G) */}
      <ChurnBlock
        churnRate={kpis.churnRate}
        cancelamentosMes={kpis.baseFechada.resultado}
        voluntarios={desativados.voluntarios}
        involuntarios={desativados.involuntarios}
        churn5g={churn5g}
      />

      {/* Bloco 7 · Funil de Vendas */}
      <FunnelBlock
        criadas={kpis.vendasCriadas}
        efetivadas={kpis.vendasEfetivadas}
        instaladas={kpis.vendasInstaladas}
        ativacoes5g={kpis.ativacoes5g}
        efetCriado={efetCriado}
        instEfet={instEfet}
      />

      {/* Quadrantes (esq) + Cobertura & Penetração (dir) — layout legado */}
      <div className="bd-row-quartis">
        <Quadrants quartis={quartis} />
        <CoverageBlock
          scope={kpis.scope}
          coverage={coverage}
          base5g={kpis.base5g}
          showBase5g={filters.tecnologia !== "5G"}
        />
      </div>

      {/* Negativações */}
      <NegativesTable negatives={negatives} />

      <DrillModal indicator={selected} competencia={filters.competencia} onClose={() => setSelected(null)} />
    </div>
  );
}
