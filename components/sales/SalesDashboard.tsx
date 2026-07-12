"use client";

import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { SalesFiltersBar } from "@/components/sales/SalesFiltersBar";
import { SalesKpiCard } from "@/components/sales/SalesKpiCard";
import { PduBlock } from "@/components/sales/PduBlock";
import { AnaliseCanais } from "@/components/sales/AnaliseCanais";
import { SelecaoLivre } from "@/components/sales/SelecaoLivre";
import { MockDataBadge } from "@/components/ui/mock-data-badge";
import { cn } from "@/lib/utils";
import type { SalesFilters, SalesFilterOptions, SalesView } from "@/lib/data/sales/types";

function toQuery(f: SalesFilters): string {
  const p = new URLSearchParams();

  if (f.period && f.period !== "mes_atual") p.set("periodo", f.period);

  if (f.from) p.set("de", f.from);

  if (f.to) p.set("ate", f.to);

  for (const [k, key] of [
    ["servico", "servico"],
    ["gerente", "gerente"],
    ["canal", "canal"],
    ["nicho", "nicho"],
    ["uf", "uf"],
    ["cidade", "cidade"],
    ["tipo", "tipo"],
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
    <section className="shadow-elegant rounded-2xl border border-border bg-card/40 p-5 backdrop-blur">
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

export function SalesDashboard({
  view,
  options,
  usesMock,
}: {
  view: SalesView;
  options: SalesFilterOptions;
  usesMock: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { filters, kpisBL, kpis5G, pdu, canais, freeIndicators, freeSeries } = view;

  const navigate = useCallback(
    (f: SalesFilters) => {
      const qs = toQuery(f);
      startTransition(() => router.push(qs ? `/vendas?${qs}` : "/vendas", { scroll: false }));
    },
    [router],
  );
  const reset = useCallback(() => startTransition(() => router.push("/vendas", { scroll: false })), [router]);

  return (
    <div className="min-h-screen pb-12">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="bg-gradient-primary shadow-glow grid h-10 w-10 place-items-center rounded-xl text-primary-foreground">
              <ShoppingCart className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl leading-tight font-bold">
                Vendas · <span className="text-gradient">Canais</span>
              </h1>
              <p className="text-xs text-muted-foreground">Acompanhamento de canais · Brisanet</p>
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
          <SalesFiltersBar filters={filters} options={options} onChange={navigate} onReset={reset} />
        </div>

        <Section title="Banda Larga (INTERNET + FWA)" subtitle="Meta x Realizado">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {kpisBL.map((k) => (
              <SalesKpiCard key={k.label} kpi={k} />
            ))}
          </div>
        </Section>

        <Section title="5G" subtitle="Ativações, portabilidade, ticket e churn">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {kpis5G.map((k) => (
              <SalesKpiCard key={k.label} kpi={k} />
            ))}
          </div>
        </Section>

        <PduBlock pdu={pdu} />
        <AnaliseCanais canais={canais} />
        <SelecaoLivre indicators={freeIndicators} series={freeSeries} />

        <footer className="pt-6 text-center text-xs text-muted-foreground">
          Brisanet · Vendas · Acompanhamento de Canais · v1
        </footer>
      </main>
    </div>
  );
}
