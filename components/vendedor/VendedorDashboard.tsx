"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, ClipboardList, Clock, Radio, Search, Smartphone, UserRound, Wifi } from "lucide-react";
import { MockDataBadge } from "@/components/ui/mock-data-badge";
import { cn } from "@/lib/utils";
import { VendedorSearch } from "./VendedorSearch";
import { CompetenciaPicker } from "./CompetenciaPicker";
import { VisibilityFilter, type Visibility } from "./VisibilityFilter";
import { VendedorHeader } from "./VendedorHeader";
import { ServicoCard } from "./ServicoCard";
import { DiasZeradosBlock } from "./DiasZeradosBlock";
import { RankingsBlock } from "./RankingsBlock";
import { MixVendasBlock } from "./MixVendasBlock";
import { RaioXModal } from "./RaioXModal";
import {
  SERVICOS,
  type PendenciaOrcamento,
  type ServicoKey,
  type VendedorFilterOptions,
  type VendedorFilters,
  type VendedorView,
} from "@/lib/data/vendedor/types";

const CHART_VAR: Record<ServicoKey, string> = {
  FTTH: "var(--chart-1)",
  FWA: "var(--chart-2)",
  "5G": "var(--chart-3)",
  Banda: "var(--chart-4)",
};

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

export function VendedorDashboard({
  view,
  options,
  usesMock,
}: {
  view: VendedorView;
  options: VendedorFilterOptions;
  usesMock: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<Tab>("resultados");
  const [raioX, setRaioX] = useState<ServicoKey | null>(null);
  const [vis, setVis] = useState<Visibility>(INITIAL_VIS);

  const {
    filters,
    profile,
    servicos,
    diasZerados,
    ranking,
    mix,
    pendencias,
    pendenciasAvailable,
    competenciaLabel,
  } = view;

  const navigate = useCallback(
    (next: VendedorFilters) => {
      const p = new URLSearchParams();

      if (next.matricula) p.set("matricula", next.matricula);

      if (next.competencia) p.set("competencia", next.competencia);

      const qs = p.toString();

      startTransition(() => router.push(qs ? `/vendedor?${qs}` : "/vendedor", { scroll: false }));
    },
    [router],
  );

  const raioXCard = servicos.find((s) => s.key === raioX) ?? null;
  const isCurrentMonth = diasZerados.hoje != null;

  return (
    <div className="min-h-screen pb-24 lg:pb-12">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="bg-gradient-primary shadow-glow grid h-10 w-10 place-items-center rounded-xl text-primary-foreground">
              <UserRound className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl leading-tight font-bold">
                Dashboard <span className="text-gradient">Vendedor</span>
              </h1>
              <p className="text-xs text-muted-foreground">Raio-X individual · {competenciaLabel}</p>
            </div>
          </div>
          {usesMock && <MockDataBadge />}
        </div>
      </header>

      <main
        className={cn(
          "mx-auto max-w-[1600px] space-y-6 px-4 py-6 transition-opacity sm:px-6",
          isPending && "pointer-events-none opacity-60",
        )}
      >
        {/* Controls */}
        <div className="sticky top-10 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background/70 p-2 backdrop-blur">
          <VendedorSearch
            options={options.vendedores}
            value={filters.matricula}
            onSelect={(m) => navigate({ ...filters, matricula: m })}
          />
          <CompetenciaPicker
            value={filters.competencia}
            onChange={(ym) => navigate({ ...filters, competencia: ym })}
          />
          <div className="ml-auto">
            <VisibilityFilter value={vis} onChange={setVis} />
          </div>
        </div>

        {/* Desktop tabs */}
        <div className="hidden lg:block">
          <TabSwitch tab={tab} onChange={setTab} />
        </div>

        {!profile ? (
          <EmptyState />
        ) : tab === "resultados" ? (
          <div className="space-y-6">
            <VendedorHeader profile={profile} />

            <section>
              <h2 className="mb-3 text-lg font-semibold">Resultado por Serviço</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {servicos
                  .filter((s) => vis[s.key])
                  .map((s) => (
                    <ServicoCard key={s.key} card={s} chartVar={CHART_VAR[s.key]} onOpen={setRaioX} />
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

        <footer className="pt-6 text-center text-xs text-muted-foreground">
          Brisanet · Dashboard Vendedor · v1
        </footer>
      </main>

      {/* Mobile bottom-nav (faithful to the prototype) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-border bg-card/95 px-6 py-2 backdrop-blur lg:hidden">
        <BottomTab
          icon={BarChart3}
          label="Resultados"
          active={tab === "resultados"}
          onClick={() => setTab("resultados")}
        />
        <BottomTab
          icon={ClipboardList}
          label="Pendências"
          active={tab === "pendencias"}
          onClick={() => setTab("pendencias")}
        />
      </nav>

      <RaioXModal
        card={raioXCard}
        ano={diasZerados.ano}
        mes={diasZerados.mes}
        isCurrentMonth={isCurrentMonth}
        onClose={() => setRaioX(null)}
      />
    </div>
  );
}

function TabSwitch({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-secondary/40 p-1">
      {(["resultados", "pendencias"] as const).map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={cn(
            "rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors",
            tab === t
              ? "shadow-elegant bg-card text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t === "resultados" ? "Resultados" : "Pendências"}
        </button>
      ))}
    </div>
  );
}

function BottomTab({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 py-1 transition-colors",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <Icon className={cn("h-5 w-5", active && "stroke-[2.5px]")} />
      <span className="text-[10px] font-medium tracking-wider uppercase">{label}</span>
    </button>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/30 px-6 py-20 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Search className="h-7 w-7" />
      </span>
      <h2 className="text-lg font-semibold text-foreground">Selecione um vendedor</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Use a busca acima (nome ou matrícula) para abrir o raio-X individual de um vendedor.
      </p>
    </div>
  );
}

const PENDENCIA_ICONS: Record<PendenciaOrcamento["servico"], React.ElementType> = {
  FTTH: Wifi,
  FWA: Radio,
  "5G": Smartphone,
};

const PENDENCIA_STATUS: Record<PendenciaOrcamento["status"], { label: string; className: string }> = {
  aguardando_efetivacao: { label: "Aguardando Efetivação", className: "bg-accent text-accent-foreground" },
  aguardando_instalacao: { label: "Aguardando Instalação", className: "bg-warning text-warning-foreground" },
};

type PendenciaFiltro = "todos" | PendenciaOrcamento["status"];

const PENDENCIA_FILTROS: { key: PendenciaFiltro; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "aguardando_efetivacao", label: "Aguardando Efetivação" },
  { key: "aguardando_instalacao", label: "Aguardando Instalação" },
];

function PendenciasTab({ pendencias, available }: { pendencias: PendenciaOrcamento[]; available: boolean }) {
  const [filtro, setFiltro] = useState<PendenciaFiltro>("todos");

  if (!available) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/30 px-6 py-20 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-warning/10 text-warning">
          <Clock className="h-7 w-7" />
        </span>
        <h2 className="text-lg font-semibold text-foreground">Orçamentos Pendentes</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Não foi possível carregar os orçamentos pendentes agora. Tente novamente em instantes.
        </p>
      </div>
    );
  }

  const filtered = pendencias.filter((p) => filtro === "todos" || p.status === filtro);

  return (
    <section className="shadow-elegant rounded-2xl border border-border bg-card/40 p-5 backdrop-blur">
      <header className="mb-4 flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-warning/10 text-warning">
          <ClipboardList className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Orçamentos Pendentes</h2>
          <p className="text-sm text-muted-foreground">{pendencias.length} orçamento(s) aguardando ação</p>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {PENDENCIA_FILTROS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFiltro(f.key)}
            className={cn(
              "rounded-full border px-3 py-1 text-[10px] font-medium tracking-wider uppercase transition-colors",
              filtro === f.key
                ? "border-primary/40 bg-primary/15 text-primary"
                : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-secondary/20 px-3 py-10 text-center text-sm text-muted-foreground">
          {pendencias.length === 0
            ? "Nenhum orçamento pendente na competência."
            : "Nenhum orçamento para o filtro atual."}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const Icon = PENDENCIA_ICONS[p.servico] ?? Wifi;
            const status = PENDENCIA_STATUS[p.status];

            return (
              <div
                key={p.orcamentoId}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/30 p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="bg-gradient-primary grid h-11 w-11 shrink-0 place-items-center rounded-xl text-primary-foreground">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">{p.cliente}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span className="rounded bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {p.servico}
                      </span>
                      <span className="rounded bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {p.avulso ? "Avulso" : "Combo"}
                      </span>
                      <span className="text-[11px] text-muted-foreground">Nº {p.orcamentoId}</span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">{p.plano}</div>
                  </div>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold",
                    status.className,
                  )}
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
