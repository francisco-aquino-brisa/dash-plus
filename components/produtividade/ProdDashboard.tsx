"use client";

import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { SalesKpiCard } from "@/components/sales/SalesKpiCard";
import { PduBlock } from "@/components/sales/PduBlock";
import { ProdFiltersBar } from "@/components/produtividade/ProdFiltersBar";
import { RankingVendedores } from "@/components/produtividade/RankingVendedores";
import { TamBlock } from "@/components/produtividade/TamBlock";
import { MockDataBadge } from "@/components/ui/mock-data-badge";
import { cn } from "@/lib/utils";
import type { ProdFilters, ProdFilterOptions, ProdView } from "@/lib/data/produtividade/types";

function toQuery(f: ProdFilters): string {
  const p = new URLSearchParams();

  if (f.from) p.set("de", f.from);

  if (f.to) p.set("ate", f.to);

  if (f.mode && f.mode !== "externas") p.set("modo", f.mode);

  for (const [k, key] of [
    ["servico", "servico"],
    ["gerencia", "gerencia"],
    ["coordenacao", "coordenacao"],
    ["gerente", "gerente"],
    ["nicho", "nicho"],
    ["cidade", "cidade"],
  ] as const) {
    const v = f[k];

    if (v) p.set(key, v);
  }

  return p.toString();
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export function ProdDashboard({
  view,
  options,
  usesMock,
}: {
  view: ProdView;
  options: ProdFilterOptions;
  usesMock: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { filters, indicadores, ranking, pdu, periodLabel, tamAvailable } = view;

  const navigate = useCallback(
    (f: ProdFilters) => {
      const qs = toQuery(f);

      startTransition(() => router.push(qs ? `/produtividade?${qs}` : "/produtividade", { scroll: false }));
    },
    [router],
  );
  const reset = useCallback(
    () => startTransition(() => router.push("/produtividade", { scroll: false })),
    [router],
  );

  const grupoLabel = filters.mode === "canais" ? "por Nicho" : "por Coordenação";

  return (
    <div className="min-h-screen pb-12">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="bg-gradient-primary shadow-glow grid h-10 w-10 place-items-center rounded-xl text-primary-foreground">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl leading-tight font-bold">
                Produtividade <span className="text-gradient">Comercial</span>
              </h1>
              <p className="text-xs text-muted-foreground">Performance da força de vendas · {periodLabel}</p>
            </div>
          </div>
          {usesMock && <MockDataBadge />}
        </div>
      </header>

      <main
        className={cn(
          "mx-auto max-w-[1600px] space-y-6 px-6 py-6 transition-opacity",
          isPending && "pointer-events-none opacity-60",
        )}
      >
        <div className="sticky top-10 z-30">
          <ProdFiltersBar filters={filters} options={options} onChange={navigate} onReset={reset} />
        </div>

        <Section title="Indicadores" subtitle="Visão consolidada conforme os filtros aplicados">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {indicadores.map((k) => (
              <SalesKpiCard key={k.label} kpi={k} />
            ))}
          </div>
        </Section>

        <RankingVendedores rows={ranking} grupoLabel={grupoLabel} />

        <PduBlock pdu={pdu} />

        <TamBlock available={tamAvailable} />

        <footer className="pt-6 text-center text-xs text-muted-foreground">
          Brisanet · Produtividade Comercial · v1
        </footer>
      </main>
    </div>
  );
}
