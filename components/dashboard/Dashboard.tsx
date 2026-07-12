"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Building2,
  CheckCircle2,
  Minus,
  Radio,
  RefreshCw,
  Rocket,
  ShoppingCart,
  Users,
  Wifi,
  Zap,
} from "lucide-react";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { CityIndicatorCard } from "@/components/dashboard/CityIndicatorCard";
import { IndicatorPicker } from "@/components/dashboard/IndicatorPicker";
import { NegativeCitiesTable } from "@/components/dashboard/NegativeCitiesTable";
import { QuartileChart } from "@/components/dashboard/QuartileChart";
import { HistoryChart } from "@/components/dashboard/HistoryChart";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { DashboardView } from "@/lib/data/cities/compute";
import type { IndicatorCardVM } from "@/lib/data/cities/indicator-blocks";
import type { FilterOptions, Filters } from "@/lib/data/cities/types";
import {
  DEFAULT_SELECTION,
  SELECTION_PREF_KEY,
  DEFAULT_DETAIL_STATS,
  DETAIL_STATS_PREF_KEY,
  DETAIL_STAT_LABELS,
  DETAIL_STAT_ORDER,
  type DetailStat,
} from "@/lib/data/cities/indicators";
import { usePreference } from "@/lib/preferences/use-preference";
import { MOCK_DATA_LABEL } from "@/lib/copy";
import { formatChartLabel, formatMonth, formatNumber, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  view: DashboardView;
  options: FilterOptions;
  cache: { autoRefresh: boolean; pollSeconds: number };
  isMock: boolean;
  watermark: string;
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

function MiniStat({
  label,
  value,
  hint,
  good,
}: {
  label: string;
  value: string;
  hint?: string;
  good?: boolean | null;
}) {
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
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function Dashboard({ view, options, cache, isMock, watermark }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { filters, kpis, growth, negatives, quartis, history, coverage, churn5g, desativados, blocks } = view;

  const [selectedIndicator, setSelectedIndicator] = useState<IndicatorCardVM | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(cache.autoRefresh);
  const [refreshing, setRefreshing] = useState(false);

  const [blSelection, setBlSelection] = usePreference<string[]>(
    SELECTION_PREF_KEY["banda-larga"],
    DEFAULT_SELECTION["banda-larga"],
  );
  const [g5Selection, setG5Selection] = usePreference<string[]>(
    SELECTION_PREF_KEY["5g"],
    DEFAULT_SELECTION["5g"],
  );

  // Detail modal: which stat cards to show, and which related metric is charted
  // (null = the main indicator). Reset the chart selection when a new card opens.
  const [detailStats, setDetailStats] = usePreference<string[]>(DETAIL_STATS_PREF_KEY, DEFAULT_DETAIL_STATS);
  const [activeRelatedId, setActiveRelatedId] = useState<string | null>(null);

  useEffect(() => {
    setActiveRelatedId(null);
  }, [selectedIndicator]);

  // The Tecnologia filter drives which blocks show (5G collapses to its block;
  // FTTH/FWA scope the BL block and hide 5G; empty / Banda Larga shows both).
  const tec = filters.tecnologia;
  const showBL = tec === "" || tec === "Banda Larga" || tec === "FTTH" || tec === "FWA";
  const showG5 = tec === "" || tec === "Banda Larga" || tec === "5G";

  const navigate = useCallback(
    (f: Filters) => {
      const qs = toQuery(f);

      startTransition(() => router.push(qs ? `/dashboard?${qs}` : "/dashboard", { scroll: false }));
    },
    [router],
  );
  const resetFilters = useCallback(() => {
    startTransition(() => router.push("/dashboard", { scroll: false }));
  }, [router]);

  // Auto-refresh flag: poll the cheap watermark probe; refresh only when the
  // source advances (see ADR 0002).
  const wmRef = useRef(watermark);

  wmRef.current = watermark;
  useEffect(() => {
    if (!autoRefresh) return;

    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/cities/freshness", { cache: "no-store" });

        if (!res.ok) return;

        const data = (await res.json()) as { watermark: string };

        if (data.watermark && data.watermark !== wmRef.current) router.refresh();
      } catch {
        /* best-effort */
      }
    }, cache.pollSeconds * 1000);

    return () => clearInterval(id);
  }, [autoRefresh, cache.pollSeconds, router]);

  const manualRefresh = useCallback(() => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 800);
  }, [router]);

  const efetCriado =
    kpis.vendasCriadas.resultado === 0
      ? 0
      : (kpis.vendasEfetivadas.resultado / kpis.vendasCriadas.resultado) * 100;
  const instEfet =
    kpis.vendasEfetivadas.resultado === 0
      ? 0
      : (kpis.vendasInstaladas.resultado / kpis.vendasEfetivadas.resultado) * 100;

  const renderBlock = (
    title: string,
    subtitle: string,
    vms: IndicatorCardVM[],
    selection: string[],
    setSelection: (next: string[]) => void,
  ) => {
    const options = vms.map((v) => ({ id: v.id, label: v.label, available: v.available }));
    const cards = vms.filter((v) => selection.includes(v.id));

    return (
      <Section
        title={title}
        subtitle={subtitle}
        right={<IndicatorPicker options={options} selected={selection} onChange={setSelection} />}
      >
        {cards.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            Nenhum indicador selecionado. Use “Indicadores” para escolher.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {cards.map((vm) => (
              <CityIndicatorCard
                key={vm.id}
                kpi={vm}
                onClick={vm.available ? () => setSelectedIndicator(vm) : undefined}
              />
            ))}
          </div>
        )}
      </Section>
    );
  };

  return (
    <div className="min-h-screen pb-12">
      <header className="sticky top-10 z-40 border-b border-border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="bg-gradient-primary shadow-glow grid h-10 w-10 place-items-center rounded-xl text-primary-foreground">
              <Activity className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl leading-tight font-bold">
                Performance <span className="text-gradient">Cidades</span>
              </h1>
              <p className="text-xs text-muted-foreground">Dashboard executivo · Brisanet</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <label className="flex cursor-pointer items-center gap-1.5 select-none">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="h-3.5 w-3.5 accent-[var(--primary)]"
              />
              Auto-refresh
            </label>
            <button
              onClick={manualRefresh}
              className="flex items-center gap-1 rounded-md border border-border bg-secondary/60 px-2 py-1 transition hover:text-foreground"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} /> Atualizar
            </button>
            <span className="hidden items-center gap-1.5 sm:flex">
              <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
              {isMock ? MOCK_DATA_LABEL : "Databricks"} · {formatMonth(filters.competencia)}
            </span>
            <span className="rounded-md border border-border bg-secondary/60 px-2 py-1">
              {coverage.totalCidades} cidades · {formatNumber(coverage.totalBase)} clientes
            </span>
          </div>
        </div>
      </header>

      <main
        className={cn(
          "mx-auto max-w-[1600px] space-y-6 px-6 py-6 transition-opacity",
          isPending && "pointer-events-none opacity-60",
        )}
      >
        <div className="sticky top-[112px] z-30 -mx-6 bg-background/80 px-6 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <FilterBar filters={filters} options={options} onChange={navigate} onReset={resetFilters} />
        </div>

        {/* Selectable indicator blocks (Banda Larga + 5G) */}
        {showBL &&
          renderBlock(
            "Banda Larga (INTERNET + FWA)",
            `Meta x Realizado · ${formatMonth(filters.competencia)}`,
            blocks.bandaLarga,
            blSelection,
            setBlSelection,
          )}
        {showG5 &&
          renderBlock(
            "5G",
            "Ativações, portabilidade, ticket e churn",
            blocks.g5,
            g5Selection,
            setG5Selection,
          )}

        {/* Bloco 1 - Crescimento de Base */}
        <Section
          title="Bloco 1 · Crescimento de Base"
          subtitle="Base atual − base mês anterior, por tecnologia"
          right={
            <div className="flex items-center gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Meta: </span>
                <span className="font-semibold">{formatNumber(kpis.crescimentoBase.meta)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Resultado: </span>
                <span className="font-semibold">
                  {formatNumber(kpis.crescimentoBase.resultado, { signed: true })}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Ating.: </span>
                <span className="font-semibold text-primary">
                  {formatPct(kpis.crescimentoBase.atingimento, 0)}
                </span>
              </div>
            </div>
          }
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {growth.map((g) => (
              <div key={g.tecnologia} className="rounded-lg border border-border bg-card/60 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold">{g.tecnologia}</h3>
                  <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/15 text-primary">
                    {g.tecnologia === "5G" ? (
                      <Zap className="h-3.5 w-3.5" />
                    ) : g.tecnologia === "FWA" ? (
                      <Radio className="h-3.5 w-3.5" />
                    ) : (
                      <Wifi className="h-3.5 w-3.5" />
                    )}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <MiniStat label="Base Clientes" value={formatNumber(g.baseClientes)} />
                  <MiniStat
                    label="Cidades Ativas"
                    value={String(g.cidadesAtivas)}
                    good={g.cidadesAtivas >= g.cidadesNeg}
                  />
                  <MiniStat
                    label="Cidades Negativas"
                    value={String(g.cidadesNeg)}
                    good={g.cidadesNeg < g.cidadesAtivas ? null : false}
                  />
                  {g.tecnologia === "FTTH" && g.takeup !== undefined && (
                    <MiniStat
                      label="Takeup"
                      value={formatPct(g.takeup)}
                      hint={`HP ${formatNumber(g.hp || 0)}`}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Histórico */}
        <Section title="Histórico de Crescimento" subtitle="Soma do crescimento mensal (últimos 12 meses)">
          <HistoryChart data={history} />
        </Section>

        {/* Bloco 5 - Churn */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Bloco 5 · Churn FTTH/FWA/BL" subtitle="Cancelamentos do mês">
            <div className="grid grid-cols-2 gap-3">
              <MiniStat
                label="Churn Rate"
                value={formatPct(kpis.churnRate.resultado)}
                hint={`Meta ${formatPct(kpis.churnRate.meta)}`}
                good={kpis.churnRate.resultado <= kpis.churnRate.meta}
              />
              <MiniStat label="Cancelamentos Mês" value={formatNumber(kpis.baseFechada.resultado)} />
              <MiniStat label="Desativados Solicitados" value={formatNumber(desativados.solicitados)} />
              <MiniStat label="Desativados Automáticos" value={formatNumber(desativados.automaticos)} />
            </div>
          </Section>
          <Section title="Bloco 5 · Churn 5G" subtitle="Cancelamentos com/sem consumo">
            <div className="grid grid-cols-2 gap-3">
              <MiniStat
                label="Churn Rate 5G"
                value={formatPct(churn5g.churnRate)}
                hint="Meta 2,00%"
                good={churn5g.churnRate <= 2}
              />
              <MiniStat label="Cancelamentos" value={formatNumber(churn5g.cancelamentos)} />
              <MiniStat label="Com Consumo" value={formatNumber(churn5g.comConsumo)} />
              <MiniStat label="Sem Consumo" value={formatNumber(churn5g.semConsumo)} />
            </div>
          </Section>
        </div>

        {/* Bloco 7 - Funil de Vendas */}
        <Section title="Bloco 7 · Funil de Vendas" subtitle="Criadas → Efetivadas → Instaladas">
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { label: "Criadas", k: kpis.vendasCriadas, icon: ShoppingCart },
              { label: "Efetivadas", k: kpis.vendasEfetivadas, icon: CheckCircle2 },
              { label: "Instaladas", k: kpis.vendasInstaladas, icon: Rocket },
            ].map(({ label, k, icon: Icon }) => (
              <div key={label} className="rounded-lg border border-border bg-card/60 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-muted-foreground">Vendas {label}</h3>
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="text-3xl font-bold">{formatNumber(k.resultado)}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Meta {formatNumber(k.meta)} · Projeção {formatNumber(k.projecao)}
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      k.atingimento >= 100
                        ? "bg-success"
                        : k.atingimento >= 70
                          ? "bg-warning"
                          : "bg-destructive",
                    )}
                    style={{ width: `${Math.max(2, Math.min(100, k.atingimento))}%` }}
                  />
                </div>
                <div className="mt-2 text-right text-sm font-semibold text-primary">
                  {formatPct(k.atingimento, 0)}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <MiniStat label="Efetivado / Criado" value={formatPct(efetCriado)} />
            <MiniStat label="Instalado / Efetivado" value={formatPct(instEfet)} />
            <MiniStat
              label="Ativações 5G"
              value={formatNumber(kpis.ativacoes5g.resultado)}
              hint={`Meta ${formatNumber(kpis.ativacoes5g.meta)}`}
            />
          </div>
        </Section>

        {/* Quartil & Cobertura */}
        <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
          <Section
            title="Distribuição de Atingimento (Quartis)"
            subtitle="Crescimento / Meta de Crescimento por cidade × tecnologia"
          >
            <QuartileChart buckets={quartis} />
          </Section>
          <Section title="Cobertura & Penetração" subtitle="Visão consolidada do escopo filtrado">
            <div className="mb-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
              Escopo principal: {kpis.scope} {kpis.scope === "Banda Larga" && "(FTTH + FWA)"}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MiniStat label="Cidades no escopo" value={String(coverage.totalCidades)} />
              <MiniStat label={`Base Ativa ${kpis.scope}`} value={formatNumber(coverage.totalBase)} />
              <MiniStat label="Home Passed" value={formatNumber(coverage.totalHP)} />
              <MiniStat
                label="Takeup Geral"
                value={formatPct(coverage.takeup)}
                good={coverage.takeup >= 25}
              />
              <MiniStat label="Bloqueados" value={formatNumber(kpis.bloqueados)} />
              <MiniStat
                label="Reativação"
                value={formatPct(kpis.reativPct)}
                good={kpis.reativPct >= 25}
                hint={`${formatNumber(kpis.reativacao.resultado)} reativados`}
              />
              {filters.tecnologia !== "5G" && (
                <MiniStat
                  label="Base 5G (independente)"
                  value={formatNumber(kpis.base5g)}
                  hint="Não soma à Banda Larga"
                />
              )}
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 text-primary" />
              Drill-down: use os filtros acima para descer por Gerência → Coordenação → Cidade.
            </div>
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5 text-primary" />
              KPIs recalculados no servidor a cada filtro · projeção pro-rata pelo dia atual.
            </div>
          </Section>
        </div>

        {/* Cidades Negativas */}
        <NegativeCitiesTable rows={negatives} />

        <footer className="pt-6 text-center text-xs text-muted-foreground">
          Brisanet · Dashboard de Performance Cidades · v1
        </footer>
      </main>

      <Dialog open={!!selectedIndicator} onOpenChange={(o) => !o && setSelectedIndicator(null)}>
        <DialogContent className="max-w-3xl">
          {selectedIndicator &&
            (() => {
              const ind = selectedIndicator;
              const fmtU = (unit: IndicatorCardVM["unit"], v: number, decimals = 1) =>
                unit === "currency"
                  ? `R$ ${v.toFixed(decimals).replace(".", ",")}`
                  : unit === "percent"
                    ? formatPct(v, decimals)
                    : formatNumber(v);
              const fmt = (v: number) => fmtU(ind.unit, v, ind.decimals);
              const atinGood =
                ind.atingimento === null
                  ? undefined
                  : ind.polarity === "down"
                    ? ind.atingimento <= 100
                    : ind.atingimento >= 100;
              const deltaGood = ind.polarity === "down" ? ind.delta <= 0 : ind.delta >= 0;

              // The related metric being charted (null → the main indicator).
              const activeRel = ind.related.find((r) => r.id === activeRelatedId) ?? null;
              const chartSeries = activeRel ? activeRel.series : ind.series;
              const chartUnit = activeRel ? activeRel.unit : ind.unit;
              const chartDecimals = activeRel ? activeRel.decimals : ind.decimals;
              const chartLabel = activeRel ? activeRel.label : ind.label;
              const chartFmt = (v: number) => fmtU(chartUnit, v, chartDecimals);
              const chartCompact = (v: number) =>
                chartUnit === "qtd" ? formatChartLabel(v) : fmtU(chartUnit, v, chartDecimals);

              const statFor = (s: DetailStat) => {
                if (s === "atual")
                  return (
                    <MiniStat label="Atual" value={fmt(ind.value)} hint={formatMonth(filters.competencia)} />
                  );

                if (s === "meta")
                  return (
                    <MiniStat
                      label="Meta"
                      value={ind.meta === null ? "—" : fmtU(ind.metaUnit, ind.meta, ind.decimals)}
                    />
                  );

                if (s === "atingimento")
                  return (
                    <MiniStat
                      label="Atingimento"
                      value={ind.atingimento === null ? "—" : formatPct(ind.atingimento, 0)}
                      good={atinGood}
                    />
                  );

                if (s === "media") return <MiniStat label="Média 12m" value={fmt(ind.media)} />;

                return (
                  <MiniStat
                    label="Variação mês"
                    value={`${ind.delta >= 0 ? "+" : ""}${ind.delta.toFixed(1).replace(".", ",")}%`}
                    good={deltaGood}
                  />
                );
              };

              // Meta/Atingimento only make sense when a meta exists — indicators
              // without one (e.g. Reativação de Bloqueados) hide them from the modal.
              const shown = DETAIL_STAT_ORDER.filter(
                (s) =>
                  detailStats.includes(s) && !(ind.meta === null && (s === "meta" || s === "atingimento")),
              );
              const statCols: Record<number, string> = {
                1: "sm:grid-cols-1",
                2: "sm:grid-cols-2",
                3: "sm:grid-cols-3",
                4: "sm:grid-cols-4",
                5: "sm:grid-cols-5",
              };

              return (
                <>
                  <DialogHeader>
                    <DialogTitle>{ind.label} · Histórico Anual</DialogTitle>
                    <DialogDescription>Evolução mensal do indicador no escopo filtrado.</DialogDescription>
                  </DialogHeader>

                  {/* Shown stat cards — inline chips (a popover won't work inside the
                      modal Dialog: Radix sets pointer-events:none outside it). */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                      Cards
                    </span>
                    {DETAIL_STAT_ORDER.map((s) => {
                      const on = detailStats.includes(s);

                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() =>
                            setDetailStats(
                              DETAIL_STAT_ORDER.filter((k) => (k === s ? !on : detailStats.includes(k))),
                            )
                          }
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                            on
                              ? "border-primary bg-primary/15 text-foreground"
                              : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {DETAIL_STAT_LABELS[s]}
                        </button>
                      );
                    })}
                  </div>

                  {shown.length > 0 && (
                    <div className={cn("grid grid-cols-2 gap-3", statCols[shown.length])}>
                      {shown.map((s) => (
                        <div key={s} className="h-full">
                          {statFor(s)}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-1 text-xs text-muted-foreground">
                    Exibindo no gráfico: <span className="font-medium text-foreground">{chartLabel}</span>
                  </div>
                  <HistoryChart
                    data={chartSeries}
                    unit={chartUnit}
                    valueFormatter={chartFmt}
                    compactFormatter={chartCompact}
                  />

                  {ind.related.length > 0 && (
                    <div className="mt-2">
                      <h4 className="mb-2 text-sm font-semibold text-foreground">Indicadores relacionados</h4>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {ind.related.map((rel) => {
                          const on = rel.id === activeRelatedId;
                          const up = rel.delta > 0.5;
                          const down = rel.delta < -0.5;
                          const tendGood = rel.polarity === "down" ? down : up;
                          const TendIcon = up ? ArrowUp : down ? ArrowDown : Minus;

                          return (
                            <button
                              key={rel.id}
                              type="button"
                              onClick={() => setActiveRelatedId(on ? null : rel.id)}
                              className={cn(
                                "rounded-lg border p-3 text-left transition-colors",
                                on
                                  ? "border-primary bg-primary/10"
                                  : "border-border bg-secondary/30 hover:border-primary/50",
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-xs leading-tight text-muted-foreground">
                                  {rel.label}
                                </span>
                                <span
                                  className={cn(
                                    "flex shrink-0 items-center gap-0.5 text-[11px] font-medium",
                                    tendGood ? "text-success" : "text-destructive",
                                  )}
                                >
                                  <TendIcon className="h-3 w-3" />
                                  {Math.abs(rel.delta).toFixed(0)}%
                                </span>
                              </div>
                              <div className="mt-1 text-xl font-bold tracking-tight text-foreground">
                                {fmtU(rel.unit, rel.value, rel.decimals)}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
