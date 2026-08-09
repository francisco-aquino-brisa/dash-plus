"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { ProdFilterBar } from "@/components/produtividade/ProdFilterBar";
import { ProdKpiCard } from "@/components/produtividade/ProdKpiCard";
import { RankingVendedores } from "@/components/produtividade/RankingVendedores";
import { ProdLockedBlock } from "@/components/produtividade/ProdLockedBlock";
import { useSetNavPending } from "@/lib/ui/nav-pending";
import { toIso } from "@/lib/date";
import type { ProdFilters, ProdFilterOptions, ProdView } from "@/lib/data/produtividade/types";

function defaultFilters(): ProdFilters {
  const today = new Date();
  const from = new Date(today);

  from.setDate(from.getDate() - 29);

  return {
    from: toIso(from) ?? "",
    to: toIso(today) ?? "",
    mode: "externas",
    servico: "",
    gerencia: "",
    coordenacao: "",
    gerente: "",
    nicho: "",
    cidade: "",
  };
}

function toQuery(f: ProdFilters): string {
  const p = new URLSearchParams();

  if (f.from) p.set("de", f.from);

  if (f.to) p.set("ate", f.to);

  if (f.mode && f.mode !== "externas") p.set("modo", f.mode);

  for (const [key, param] of [
    ["servico", "servico"],
    ["gerencia", "gerencia"],
    ["coordenacao", "coordenacao"],
    ["gerente", "gerente"],
    ["nicho", "nicho"],
    ["cidade", "cidade"],
  ] as const) {
    const v = f[key];

    if (v) p.set(param, v);
  }

  return p.toString();
}

export function ProdDashboard({ view, options }: { view: ProdView; options: ProdFilterOptions }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { indicadores, ranking, periodLabel } = view;

  const [refreshing, setRefreshing] = useState(false);

  // Optimistic filters: the chips reflect the new value instantly, while the
  // server request (which recomputes the data) runs behind the transition.
  const [uiFilters, setUiFilters] = useState<ProdFilters>(view.filters);

  useEffect(() => {
    setUiFilters(view.filters);
  }, [view.filters]);

  const setNavPending = useSetNavPending();

  useEffect(() => {
    setNavPending(isPending);

    return () => setNavPending(false);
  }, [isPending, setNavPending]);

  const navigate = useCallback(
    (f: ProdFilters) => {
      setUiFilters(f);
      const qs = toQuery(f);

      startTransition(() => router.push(qs ? `/produtividade?${qs}` : "/produtividade", { scroll: false }));
    },
    [router],
  );
  const resetFilters = useCallback(() => {
    setUiFilters(defaultFilters());
    startTransition(() => router.push("/produtividade", { scroll: false }));
  }, [router]);

  const manualRefresh = useCallback(() => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 800);
  }, [router]);

  const grupoLabel = uiFilters.mode === "canais" ? "por Nicho" : "por Coordenação";

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
            Brisanet · Força de vendas
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
            Produtividade Comercial
          </h1>
          <p style={{ fontSize: 13, color: "var(--s-t3)", marginTop: 4 }}>
            Performance da força de vendas · {periodLabel}
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

      <ProdFilterBar filters={uiFilters} options={options} onChange={navigate} onReset={resetFilters} />

      {/* Indicadores (funil) */}
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
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: 17,
              letterSpacing: "-.02em",
            }}
          >
            Indicadores
          </h2>
          <div style={{ fontSize: 11.5, color: "var(--s-t3)", marginTop: 2 }}>
            Funil de vendas no período · variação vs período anterior
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(228px, 1fr))",
            gap: 10,
          }}
        >
          {indicadores.map((k) => (
            <ProdKpiCard key={k.label} kpi={k} />
          ))}
        </div>
      </section>

      <RankingVendedores rows={ranking} grupoLabel={grupoLabel} />

      {/* Blocos do legado mantidos (não estão no new_ui §3), travados */}
      <ProdLockedBlock
        title="PDU · Produtividade por Dia Útil"
        subtitle="Produção realizada ÷ dia útil, por tecnologia"
        reason="Fórmula (denominador) e meta da PDU em confirmação com o time de dados. Assim que definidas, este bloco passa a exibir a produtividade por dia útil de cada tecnologia."
      />
      <ProdLockedBlock
        title="TAM de Vendedores"
        subtitle="Distribuição da força de vendas por faixa de atingimento da meta"
        reason="Sem acesso à meta por vendedor — necessária para calcular o atingimento por faixa. Aguardando liberação do time de dados."
      />
    </div>
  );
}
