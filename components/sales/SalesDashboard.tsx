"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { SalesFiltersBar } from "@/components/sales/SalesFiltersBar";
import { SalesIndicatorCard } from "@/components/sales/SalesIndicatorCard";
import { PduBlock } from "@/components/sales/PduBlock";
import { AnaliseCanais } from "@/components/sales/AnaliseCanais";
import { SelecaoLivre } from "@/components/sales/SelecaoLivre";
import { IndicatorPicker } from "@/components/dashboard/IndicatorPicker";
import { HistoryChart } from "@/components/dashboard/HistoryChart";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MockDataBadge } from "@/components/ui/mock-data-badge";
import { usePreference } from "@/lib/preferences/use-preference";
import { DEFAULT_SELECTION, SELECTION_PREF_KEY, type SalesIndicatorVM } from "@/lib/data/sales/indicators";
import { formatChartLabel, formatMonth, formatNumber, formatPct } from "@/lib/format";
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
  right,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="shadow-elegant rounded-2xl border border-border bg-card/40 p-5 backdrop-blur">
      <header className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {right}
      </header>
      {children}
    </section>
  );
}

function MiniStat({ label, value, good }: { label: string; value: string; good?: boolean | null }) {
  return (
    <div className="h-full rounded-lg border border-border bg-secondary/30 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-1 text-xl font-bold tracking-tight",
          good === true && "text-success",
          good === false && "text-destructive",
        )}
      >
        {value}
      </div>
    </div>
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
  const { filters, competencia, blocksBL, blocks5G, pdu, canais, freeIndicators, freeSeries } = view;

  const [selected, setSelected] = useState<SalesIndicatorVM | null>(null);
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
      const qs = toQuery(f);

      startTransition(() => router.push(qs ? `/vendas?${qs}` : "/vendas", { scroll: false }));
    },
    [router],
  );
  const reset = useCallback(() => startTransition(() => router.push("/vendas", { scroll: false })), [router]);

  const renderBlock = (
    title: string,
    subtitle: string,
    vms: SalesIndicatorVM[],
    selection: string[],
    setSelection: (next: string[]) => void,
  ) => {
    const pickerOptions = vms.map((v) => ({ id: v.id, label: v.label, available: v.available }));
    const cards = vms.filter((v) => selection.includes(v.id));

    return (
      <Section
        title={title}
        subtitle={subtitle}
        right={<IndicatorPicker options={pickerOptions} selected={selection} onChange={setSelection} />}
      >
        {cards.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            Nenhum indicador selecionado. Use “Indicadores” para escolher.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {cards.map((vm) => (
              <SalesIndicatorCard
                key={vm.id}
                vm={vm}
                onClick={vm.available ? () => setSelected(vm) : undefined}
              />
            ))}
          </div>
        )}
      </Section>
    );
  };

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

        {renderBlock(
          "Banda Larga (INTERNET + FWA)",
          `Meta x Realizado · ${formatMonth(competencia)}`,
          blocksBL,
          blSelection,
          setBlSelection,
        )}
        {renderBlock(
          "5G",
          `Ativações, portabilidade, ticket e churn · ${formatMonth(competencia)}`,
          blocks5G,
          g5Selection,
          setG5Selection,
        )}

        <PduBlock pdu={pdu} />
        <AnaliseCanais canais={canais} />
        <SelecaoLivre indicators={freeIndicators} series={freeSeries} />

        <footer className="pt-6 text-center text-xs text-muted-foreground">
          Brisanet · Vendas · Acompanhamento de Canais · v1
        </footer>
      </main>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl">
          {selected &&
            (() => {
              const vm = selected;
              const fmtU = (v: number) =>
                vm.unit === "currency"
                  ? `R$ ${formatNumber(+v.toFixed(vm.decimals))}`
                  : vm.unit === "percent"
                    ? formatPct(v, vm.decimals)
                    : formatNumber(v);
              const compact = (v: number) =>
                vm.unit === "currency"
                  ? `R$ ${formatChartLabel(v)}`
                  : vm.unit === "percent"
                    ? formatPct(v, 0)
                    : formatChartLabel(v);
              const atinGood =
                vm.attainment === null
                  ? undefined
                  : vm.polarity === "down"
                    ? vm.attainment <= 100
                    : vm.attainment >= 100;

              return (
                <>
                  <DialogHeader>
                    <DialogTitle>{vm.label} · Histórico</DialogTitle>
                    <DialogDescription>
                      Evolução mensal (Real{vm.meta !== null ? " × Meta" : ""}) no escopo filtrado.
                    </DialogDescription>
                  </DialogHeader>

                  <div
                    className={cn(
                      "grid grid-cols-2 gap-3",
                      vm.meta !== null ? "sm:grid-cols-3" : "sm:grid-cols-1",
                    )}
                  >
                    <MiniStat label={`Atual · ${formatMonth(competencia)}`} value={fmtU(vm.value)} />
                    {vm.meta !== null && <MiniStat label="Meta" value={fmtU(vm.meta)} />}
                    {vm.attainment !== null && (
                      <MiniStat label="Atingimento" value={formatPct(vm.attainment, 0)} good={atinGood} />
                    )}
                  </div>

                  <HistoryChart
                    data={vm.series}
                    unit={vm.unit}
                    valueFormatter={fmtU}
                    compactFormatter={compact}
                  />
                </>
              );
            })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
