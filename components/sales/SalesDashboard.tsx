"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { SalesFilterBar } from "@/components/sales/SalesFilterBar";
import { SalesKpiBlock } from "@/components/sales/SalesKpiBlock";
import { SalesPduBlock } from "@/components/sales/SalesPduBlock";
import { AnaliseCanais } from "@/components/sales/AnaliseCanais";
import { SelecaoLivre } from "@/components/sales/SelecaoLivre";
import { SalesDrillModal } from "@/components/sales/SalesDrillModal";
import { usePreference } from "@/lib/preferences/use-preference";
import { useSetNavPending } from "@/lib/ui/nav-pending";
import { DEFAULT_SELECTION, SELECTION_PREF_KEY, type SalesIndicatorVM } from "@/lib/data/sales/indicators";
import { formatMonth } from "@/lib/format";
import type { SalesFilters, SalesFilterOptions, SalesView } from "@/lib/data/sales/types";

const DEFAULT_FILTERS: SalesFilters = {
  period: "mes_atual",
  from: undefined,
  to: undefined,
  servico: "",
  gerente: "",
  canal: "",
  nicho: "",
  uf: "",
  cidade: "",
  tipo: "",
};

function toQuery(f: SalesFilters): string {
  const p = new URLSearchParams();

  if (f.period && f.period !== "mes_atual") p.set("periodo", f.period);

  if (f.from) p.set("de", f.from);

  if (f.to) p.set("ate", f.to);

  for (const [key, param] of [
    ["servico", "servico"],
    ["gerente", "gerente"],
    ["canal", "canal"],
    ["nicho", "nicho"],
    ["uf", "uf"],
    ["cidade", "cidade"],
    ["tipo", "tipo"],
  ] as const) {
    const v = f[key];

    if (v) p.set(param, v);
  }

  return p.toString();
}

export function SalesDashboard({ view, options }: { view: SalesView; options: SalesFilterOptions }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { competencia, blocksBL, blocks5G, canais, freeIndicators, freeSeries } = view;

  const [selected, setSelected] = useState<SalesIndicatorVM | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Optimistic filters: the chips reflect the new value instantly, while the
  // server request (which recomputes the data) runs behind the transition.
  const [uiFilters, setUiFilters] = useState<SalesFilters>(view.filters);

  useEffect(() => {
    setUiFilters(view.filters);
  }, [view.filters]);

  // Report filter-navigation pending state to the shell (brand loading shimmer).
  const setNavPending = useSetNavPending();

  useEffect(() => {
    setNavPending(isPending);

    return () => setNavPending(false);
  }, [isPending, setNavPending]);

  const [blSelection, setBlSelection] = usePreference<string[]>(
    SELECTION_PREF_KEY["banda-larga"],
    DEFAULT_SELECTION["banda-larga"],
  );
  const [g5Selection, setG5Selection] = usePreference<string[]>(
    SELECTION_PREF_KEY["5g"],
    DEFAULT_SELECTION["5g"],
  );

  const navigate = useCallback(
    (f: SalesFilters) => {
      setUiFilters(f); // reflect the chip immediately, request afterwards
      const qs = toQuery(f);

      startTransition(() => router.push(qs ? `/vendas?${qs}` : "/vendas", { scroll: false }));
    },
    [router],
  );
  const resetFilters = useCallback(() => {
    setUiFilters(DEFAULT_FILTERS);
    startTransition(() => router.push("/vendas", { scroll: false }));
  }, [router]);

  const manualRefresh = useCallback(() => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 800);
  }, [router]);

  const comp = formatMonth(competencia);

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
            Brisanet · Acompanhamento comercial
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
            Vendas · Canais
          </h1>
          <p style={{ fontSize: 13, color: "var(--s-t3)", marginTop: 4 }}>
            Funil de vendas por canal — Banda Larga e 5G, com produtividade por dia útil.
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

      <SalesFilterBar filters={uiFilters} options={options} onChange={navigate} onReset={resetFilters} />

      {/* KPI blocks */}
      <SalesKpiBlock
        title="Banda Larga (INTERNET + FWA)"
        subtitle={`Meta × Realizado · ${comp} · toque num indicador para o histórico`}
        vms={blocksBL}
        selection={blSelection}
        onSelectionChange={setBlSelection}
        onCardClick={setSelected}
      />
      <SalesKpiBlock
        title="5G"
        subtitle={`Ativações, portabilidade, ticket e churn · ${comp} · toque para o histórico`}
        vms={blocks5G}
        selection={g5Selection}
        onSelectionChange={setG5Selection}
        onCardClick={setSelected}
      />

      {/* PDU (travada — fórmula/meta pendentes) */}
      <SalesPduBlock />

      {/* Blocos do legado mantidos (não estão no new_ui §2) */}
      <AnaliseCanais canais={canais} />
      <SelecaoLivre indicators={freeIndicators} series={freeSeries} />

      <SalesDrillModal indicator={selected} competencia={competencia} onClose={() => setSelected(null)} />
    </div>
  );
}
