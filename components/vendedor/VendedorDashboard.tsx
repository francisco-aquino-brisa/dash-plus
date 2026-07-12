"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, ClipboardList, Clock, Search, UserRound } from "lucide-react";
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

  const { filters, profile, servicos, diasZerados, ranking, mix, competenciaLabel } = view;

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
          <PendenciasTab />
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

function PendenciasTab() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/30 px-6 py-20 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-warning/10 text-warning">
        <Clock className="h-7 w-7" />
      </span>
      <h2 className="text-lg font-semibold text-foreground">Orçamentos Pendentes</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Aguardando fonte atualizada de orçamentos. A base disponível de orçamentos por cliente está congelada
        em 2025 — o bloco acende automaticamente quando o time de dados liberar a fonte atual.
      </p>
    </div>
  );
}
