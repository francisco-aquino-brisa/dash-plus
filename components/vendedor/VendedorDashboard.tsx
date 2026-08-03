"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Clock, RefreshCw, Search, Zap, type LucideIcon } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { useSetNavPending } from "@/lib/ui/nav-pending";
import { VendedorFilterBar } from "./VendedorFilterBar";
import { VendedorHeader } from "./VendedorHeader";
import { ServicoCard } from "./ServicoCard";
import { DiasZeradosBlock } from "./DiasZeradosBlock";
import { RankingsBlock } from "./RankingsBlock";
import { MixVendasBlock } from "./MixVendasBlock";
import { RaioXModal } from "./RaioXModal";
import { type Visibility } from "./VisibilityFilter";
import { SERVICO_STYLE } from "./vendedor-format";
import {
  type PendenciaOrcamento,
  type ServicoKey,
  type VendedorFilterOptions,
  type VendedorFilters,
  type VendedorView,
} from "@/lib/data/vendedor/types";

const INITIAL_VIS: Visibility = {
  FTTH: true,
  FWA: true,
  "5G": true,
  Banda: true,
  diasZerados: true,
  rankings: true,
  mix: true,
};

type Tab = "resultados" | "pendencias";

const TABS = [
  { value: "resultados" as const, label: "Resultados" },
  { value: "pendencias" as const, label: "Pendências" },
];

export function VendedorDashboard({ view, options }: { view: VendedorView; options: VendedorFilterOptions }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<Tab>("resultados");
  const [raioX, setRaioX] = useState<ServicoKey | null>(null);
  const [vis, setVis] = useState<Visibility>(INITIAL_VIS);
  const [refreshing, setRefreshing] = useState(false);

  const { profile, servicos, diasZerados, ranking, mix, pendencias, pendenciasAvailable, competenciaLabel } =
    view;

  // Optimistic filters: the chips reflect the new value instantly while the
  // server request (which recomputes the VM) runs behind the transition.
  const [uiFilters, setUiFilters] = useState<VendedorFilters>(view.filters);

  useEffect(() => {
    setUiFilters(view.filters);
  }, [view.filters]);

  const setNavPending = useSetNavPending();

  useEffect(() => {
    setNavPending(isPending);

    return () => setNavPending(false);
  }, [isPending, setNavPending]);

  const navigate = useCallback(
    (next: VendedorFilters) => {
      setUiFilters(next); // reflect immediately, request afterwards
      const p = new URLSearchParams();

      if (next.matricula) p.set("matricula", next.matricula);

      if (next.competencia) p.set("competencia", next.competencia);

      const qs = p.toString();

      startTransition(() => router.push(qs ? `/vendedor?${qs}` : "/vendedor", { scroll: false }));
    },
    [router],
  );

  const manualRefresh = useCallback(() => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 800);
  }, [router]);

  const raioXCard = servicos.find((s) => s.key === raioX) ?? null;
  const subtitle = `${profile ? profile.nome : "Selecione um vendedor"} · ${competenciaLabel}`;

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
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: ".11em",
              textTransform: "uppercase",
              color: "var(--s-brand)",
            }}
          >
            Raio-X individual
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
            Dashboard Vendedor
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "var(--s-t3)",
              marginTop: 4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={manualRefresh}
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
          }}
        >
          <RefreshCw size={14} style={{ animation: refreshing ? "bdSpin 1s linear infinite" : undefined }} />
          Atualizar
        </button>
      </header>

      <VendedorFilterBar
        filters={uiFilters}
        options={options}
        vis={vis}
        onNavigate={navigate}
        onVisChange={setVis}
      />

      <Segmented options={TABS} value={tab} onChange={setTab} ariaLabel="Resultados ou Pendências" />

      {!profile ? (
        <EmptyState />
      ) : tab === "resultados" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <VendedorHeader profile={profile} />

          <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                fontSize: 17,
                letterSpacing: "-.02em",
                padding: "0 2px",
              }}
            >
              Resultado por Serviço
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(215px, 1fr))",
                gap: 10,
                alignItems: "stretch",
              }}
            >
              {servicos
                .filter((s) => vis[s.key])
                .map((s) => (
                  <ServicoCard key={s.key} card={s} onOpen={setRaioX} />
                ))}
            </div>
          </section>

          {vis.diasZerados && <DiasZeradosBlock dias={diasZerados} />}
          {vis.rankings && <RankingsBlock ranking={ranking} />}
          {vis.mix && <MixVendasBlock mix={mix} />}
        </div>
      ) : (
        <PendenciasTab pendencias={pendencias} available={pendenciasAvailable} />
      )}

      <RaioXModal
        card={raioXCard}
        ano={diasZerados.ano}
        mes={diasZerados.mes}
        hoje={diasZerados.hoje}
        onClose={() => setRaioX(null)}
      />
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        border: "1px dashed var(--s-border-2)",
        borderRadius: "var(--r-panel)",
        background: "var(--s-card)",
        padding: "72px 24px",
        textAlign: "center",
      }}
    >
      <span
        style={{
          display: "grid",
          placeItems: "center",
          width: 56,
          height: 56,
          borderRadius: 16,
          background: "var(--s-brand-weak)",
          color: "var(--s-brand)",
        }}
      >
        <Search size={26} />
      </span>
      <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: "var(--s-t1)" }}>
        Selecione um vendedor
      </h2>
      <p style={{ maxWidth: 360, fontSize: 13, color: "var(--s-t3)" }}>
        Use a busca acima (nome ou matrícula) para abrir o raio-X individual de um vendedor.
      </p>
    </div>
  );
}

const PENDENCIA_STATUS: Record<PendenciaOrcamento["status"], { label: string; bg: string; fg: string }> = {
  aguardando_efetivacao: { label: "Aguardando Efetivação", bg: "var(--s-blue-bg)", fg: "var(--s-blue)" },
  aguardando_instalacao: { label: "Aguardando Instalação", bg: "var(--s-warn-bg)", fg: "var(--s-warn)" },
};

type PendenciaFiltro = "todos" | PendenciaOrcamento["status"];

const PENDENCIA_FILTROS: { key: PendenciaFiltro; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "aguardando_efetivacao", label: "Aguardando Efetivação" },
  { key: "aguardando_instalacao", label: "Aguardando Instalação" },
];

const PENDENCIA_ICON: Record<PendenciaOrcamento["servico"], LucideIcon> = {
  FTTH: SERVICO_STYLE.FTTH.icon,
  FWA: SERVICO_STYLE.FWA.icon,
  "5G": Zap,
};

function PendenciasTab({ pendencias, available }: { pendencias: PendenciaOrcamento[]; available: boolean }) {
  const [filtro, setFiltro] = useState<PendenciaFiltro>("todos");

  if (!available) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          border: "1px dashed var(--s-border-2)",
          borderRadius: "var(--r-panel)",
          background: "var(--s-card)",
          padding: "64px 24px",
          textAlign: "center",
        }}
      >
        <span
          style={{
            display: "grid",
            placeItems: "center",
            width: 56,
            height: 56,
            borderRadius: 16,
            background: "var(--s-warn-bg)",
            color: "var(--s-warn)",
          }}
        >
          <Clock size={26} />
        </span>
        <h2
          style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: "var(--s-t1)" }}
        >
          Orçamentos Pendentes
        </h2>
        <p style={{ maxWidth: 420, fontSize: 13, color: "var(--s-t3)" }}>
          Não foi possível carregar os orçamentos pendentes agora. Tente novamente em instantes.
        </p>
      </div>
    );
  }

  const filtered = pendencias.filter((p) => filtro === "todos" || p.status === filtro);

  return (
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
      <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            display: "grid",
            placeItems: "center",
            width: 30,
            height: 30,
            borderRadius: 9,
            background: "var(--s-warn-bg)",
            color: "var(--s-warn)",
          }}
        >
          <ClipboardList size={16} />
        </span>
        <div>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: 17,
              letterSpacing: "-.02em",
            }}
          >
            Orçamentos Pendentes
          </h2>
          <div style={{ fontSize: 11.5, color: "var(--s-t3)", marginTop: 2 }}>
            {pendencias.length} orçamento(s) aguardando ação
          </div>
        </div>
      </header>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {PENDENCIA_FILTROS.map((f) => {
          const active = filtro === f.key;

          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFiltro(f.key)}
              style={{
                padding: "5px 11px",
                border: `1px solid ${active ? "var(--s-brand)" : "var(--s-border)"}`,
                borderRadius: 999,
                background: active ? "var(--s-brand-weak)" : "var(--s-sunken)",
                color: active ? "var(--s-brand)" : "var(--s-t2)",
                font: "inherit",
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: ".04em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p
          style={{
            border: "1px dashed var(--s-border-2)",
            borderRadius: 12,
            background: "var(--s-sunken)",
            padding: "28px 12px",
            textAlign: "center",
            fontSize: 12.5,
            color: "var(--s-t3)",
          }}
        >
          {pendencias.length === 0
            ? "Nenhum orçamento pendente na competência."
            : "Nenhum orçamento para o filtro atual."}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((p) => {
            const Icon = PENDENCIA_ICON[p.servico];
            const status = PENDENCIA_STATUS[p.status];

            return (
              <div
                key={p.orcamentoId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  border: "1px solid var(--s-border)",
                  borderRadius: 12,
                  background: "var(--s-sunken)",
                  padding: 11,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <span
                    style={{
                      flex: "none",
                      display: "grid",
                      placeItems: "center",
                      width: 32,
                      height: 32,
                      borderRadius: 9,
                      background: status.bg,
                      color: status.fg,
                    }}
                  >
                    <Icon size={16} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: "var(--s-t1)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {p.cliente}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: 6,
                        marginTop: 3,
                      }}
                    >
                      <Tag>{p.servico}</Tag>
                      <Tag>{p.avulso ? "Avulso" : "Combo"}</Tag>
                      <span style={{ fontSize: 10.5, color: "var(--s-t3)" }}>Nº {p.orcamentoId}</span>
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--s-t3)",
                        marginTop: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {p.plano}
                    </div>
                  </div>
                </div>
                <span
                  style={{
                    flex: "none",
                    borderRadius: 999,
                    background: status.bg,
                    color: status.fg,
                    padding: "4px 10px",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {status.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        borderRadius: 5,
        background: "var(--s-card)",
        color: "var(--s-t3)",
        padding: "1px 6px",
        fontSize: 10,
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
}
