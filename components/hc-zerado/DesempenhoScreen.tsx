"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Info, RefreshCw, Users } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { DataTable, type Column } from "@/components/ui/data-table";
import { HcActiveContext, HcFilterPanel } from "./HcFilterPanel";
import { RegionalTable, TrendHover } from "./RegionalTable";
import {
  Block,
  SearchInput,
  card,
  SERVICO_LABEL,
  SERVICO_ROWS,
  matrizTd,
  matrizTh,
  nf,
  ptBr,
  stickyCol,
  tooltipLine,
  tooltipPanel,
  tooltipTitle,
} from "./ui";
import { useReportNavPending } from "@/lib/ui/nav-pending";
import { hcFiltersToQuery, keepScreenParams } from "@/lib/data/hc-zerado/filters";
import type {
  HcCrossFilters,
  HcDesempenhoView,
  HcFilterOptions,
  HcFilters,
  MatrizRow,
  VendedorRow,
} from "@/lib/data/hc-zerado/types";

export function DesempenhoScreen({
  view,
  filters,
  options,
}: {
  view: HcDesempenhoView;
  filters: HcFilters;
  options: HcFilterOptions;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const current = useSearchParams();
  const [pending, startTransition] = useTransition();
  // The click has to look answered before the data comes back: the chip/row
  // paints selected from this optimistic copy while the server recomputes, and
  // the screen dims until it lands. Without it a click reads as a dead control.
  const [optimistic, setOptimistic] = useState<HcCrossFilters | null>(null);
  const cross = optimistic ?? filters.cross;
  const appliedCross = Object.values(filters.cross).join("|");

  useReportNavPending(pending);

  useEffect(() => {
    setOptimistic(null);
  }, [appliedCross]);

  /** Click-to-filter: toggling writes the cross-filter into the URL. */
  const applyCross = (key: keyof HcCrossFilters, value: string) => {
    // The matrix grouping is the screen's, not the filters' — keep it.
    const q = keepScreenParams(new URLSearchParams(hcFiltersToQuery(filters)), current);
    const param = `cf_${key}`;
    const clearing = q.get(param) === value;

    if (clearing) q.delete(param);
    else q.set(param, value);

    setOptimistic({ ...filters.cross, [key]: clearing ? "" : value });
    startTransition(() => router.push(`${pathname}?${q.toString()}`, { scroll: false }));
  };

  // The cross-filter has to carry the matrícula (it is the query key), but the
  // chip should say who that is.
  const vendedorName = cross.vendedor
    ? (view.vendedores.find((v) => v.matricula === cross.vendedor)?.consultor ??
      `Matrícula ${cross.vendedor}`)
    : undefined;
  const period =
    filters.from === filters.to ? ptBr(filters.from) : `${ptBr(filters.from)} a ${ptBr(filters.to)}`;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: "16px 16px 40px",
        minWidth: 0,
        opacity: pending ? 0.6 : 1,
        pointerEvents: pending ? "none" : "auto",
        transition: "opacity .18s",
        animation: "bdIn .3s ease both",
      }}
    >
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
            Brisanet · HC & Zero Vendas
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
            Desempenho HC
          </h1>
          <p style={{ fontSize: 13, color: "var(--s-t3)", marginTop: 4 }}>
            Ativos e zerados · {period} · referência {ptBr(view.refDate)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => startTransition(() => router.refresh())}
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
          <RefreshCw size={14} />
          Atualizar
        </button>
      </header>

      <HcFilterPanel filters={filters} options={options} />
      <HcActiveContext filters={filters} labels={{ vendedor: vendedorName }} />
      <QuadroGeralBlock view={view} />
      <TotalizadoresBlock
        view={view}
        filters={filters}
        cross={cross}
        onCross={(s) => applyCross("servico", s)}
      />
      <ZeradoDayBlock view={view} />
      <RegionalBlock view={view} filters={filters} cross={cross} onCross={applyCross} />
      <IndividualBlock view={view} cross={cross} onCross={(m) => applyCross("vendedor", m)} />
      <MatrizBlock view={view} filters={filters} />
      <PduBlock view={view} filters={filters} />
    </div>
  );
}

/* ---------------------------------------------------------------- Bloco 1 */

function QuadroGeralBlock({ view }: { view: HcDesempenhoView }) {
  const { quadroGeral } = view;
  const colors: Record<string, string> = {
    Ativos: "var(--s-ok)",
    Férias: "var(--s-blue)",
    Maternidade: "var(--s-brand)",
    INSS: "var(--s-warn)",
  };

  return (
    <Block
      title="Total Quadro de HC"
      note="Reflete a data máxima do filtro final"
      actions={
        <span
          style={{
            border: "1px solid var(--s-warn)",
            borderRadius: 999,
            padding: "3px 9px",
            background: "var(--s-warn-bg)",
            color: "var(--s-warn)",
            fontSize: 10.5,
            fontWeight: 800,
          }}
        >
          REF: {quadroGeral.refDate ? ptBr(quadroGeral.refDate) : "—"}
        </span>
      }
    >
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        <div style={{ ...card, boxShadow: "none", background: "var(--s-sunken)", padding: "12px 14px" }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "var(--s-t3)",
            }}
          >
            Quadro Geral
          </div>
          <div
            className="font-mono"
            style={{ fontSize: 26, fontWeight: 800, color: "var(--s-warn)", lineHeight: 1.1, marginTop: 4 }}
          >
            {nf.format(quadroGeral.total)}
          </div>
        </div>
        {quadroGeral.items.map((item) => (
          <div
            key={item.id}
            style={{ ...card, boxShadow: "none", background: "var(--s-sunken)", padding: "12px 14px" }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: "var(--s-t3)",
              }}
            >
              {item.label}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
              <span
                className="font-mono"
                style={{
                  fontSize: 26,
                  fontWeight: 800,
                  color: colors[item.label] ?? "var(--s-t1)",
                  lineHeight: 1.1,
                }}
              >
                {nf.format(item.count)}
              </span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--s-t3)" }}>{item.pct}%</span>
            </div>
          </div>
        ))}
      </div>
    </Block>
  );
}

/* ---------------------------------------------------------------- Bloco 2 */

function TotalizadoresBlock({
  view,
  filters,
  cross,
  onCross,
}: {
  view: HcDesempenhoView;
  filters: HcFilters;
  cross: HcCrossFilters;
  onCross: (servico: string) => void;
}) {
  const t = view.totalizadores;
  const cards = [
    {
      servico: "INTERNET",
      label: "FTTH",
      value: t.ftth,
      color: "var(--s-brand)",
      sub: `Status: ${filters.statusVenda}`,
    },
    {
      servico: "FWA",
      label: "FWA",
      value: t.fwa,
      color: "var(--s-blue)",
      sub: `Status: ${filters.statusVenda}`,
    },
    {
      servico: "5G",
      label: "Chips 5G",
      value: t.chips5g,
      color: "var(--s-ok)",
      sub: "Status: Ativado/Efetivado",
    },
    {
      servico: "RENOVAÇÃO",
      label: "Renovações",
      value: t.renovacoes,
      color: "var(--s-warn)",
      sub: "Status: Efetivada",
    },
  ];

  return (
    <Block
      title="Totalizadores de Produção (Entregas do Período)"
      note={`Status sob análise: ${filters.statusVenda}`}
    >
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        {cards.map((c) => {
          const ativo = cross.servico === c.servico;
          const value = c.value;

          return (
            <button
              key={c.servico}
              type="button"
              disabled={value === null}
              onClick={() => onCross(c.servico)}
              style={{
                ...card,
                boxShadow: "none",
                textAlign: "left",
                padding: "12px 14px",
                cursor: value === null ? "default" : "pointer",
                borderColor: ativo
                  ? "var(--s-brand)"
                  : value === null
                    ? "var(--s-border-2)"
                    : "var(--s-border)",
                background: ativo ? "var(--s-brand-weak)" : "var(--s-sunken)",
                borderStyle: value === null ? "dashed" : "solid",
                opacity: value === null ? 0.75 : 1,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  color: "var(--s-t3)",
                }}
              >
                {c.label}
              </div>
              {value === null ? (
                <>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "var(--s-t3)", marginTop: 6 }}>
                    Sem dado na fonte
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--s-t3)", marginTop: 2 }}>
                    A base não carrega o serviço RENOVAÇÃO
                  </div>
                </>
              ) : (
                <>
                  <div
                    className="font-mono"
                    style={{ fontSize: 26, fontWeight: 800, color: c.color, lineHeight: 1.1, marginTop: 4 }}
                  >
                    {nf.format(value)}
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--s-t3)", marginTop: 2 }}>{c.sub}</div>
                </>
              )}
            </button>
          );
        })}
      </div>
      <p
        style={{
          fontSize: 11,
          color: "var(--s-t3)",
          marginTop: 10,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Info size={12} style={{ flex: "none" }} />
        Clique em qualquer cartão acima para filtrar os gráficos e tabelas de forma bidirecional.
      </p>
    </Block>
  );
}

/* ---------------------------------------------------------------- Bloco 3 */

const FERIADO_OPTS = [
  { value: "all" as const, label: "Todos" },
  { value: "yes" as const, label: "Sim" },
  { value: "no" as const, label: "Não" },
];

function ZeradoDayBlock({ view }: { view: HcDesempenhoView }) {
  const [feriado, setFeriado] = useState<"all" | "yes" | "no">("no");
  const chartData = useMemo(
    () =>
      view.zeradoByDay.filter((d) => (feriado === "all" ? true : feriado === "yes" ? d.feriado : !d.feriado)),
    [view.zeradoByDay, feriado],
  );

  return (
    <Block
      title="Quantidade de HC Zerado por Dia (Ativos vs. Sem Vendas)"
      actions={
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--s-t3)" }}>Considerar Feriado?</span>
          <Segmented
            options={FERIADO_OPTS}
            value={feriado}
            onChange={setFeriado}
            size="sm"
            ariaLabel="Considerar feriado"
          />
        </label>
      }
    >
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: Math.max(560, chartData.length * 46), height: 340 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 28, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--s-border)" vertical={false} />
              <XAxis
                dataKey="label"
                interval={0}
                angle={-45}
                textAnchor="end"
                height={58}
                tick={{ fontSize: 10, fill: "var(--s-t2)", fontWeight: 600 }}
                axisLine={{ stroke: "var(--s-border)" }}
                tickLine={false}
              />
              {/* Both axes are hidden and the percentage axis is deliberately
                  offset, which is how the original floats the % line above the
                  bars instead of overlapping them. */}
              <YAxis yAxisId="hc" domain={[0, "dataMax + 4"]} hide />
              <YAxis yAxisId="pct" orientation="right" domain={[-120, 100]} hide />
              <ChartTooltip content={<TooltipZerado />} cursor={{ fill: "var(--s-sunken)" }} />
              <Legend
                verticalAlign="top"
                align="right"
                height={26}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, fontWeight: 700, color: "var(--s-t2)" }}
              />
              <Bar
                yAxisId="hc"
                dataKey="zerados"
                name="HC's Zerados"
                stackId="hc"
                fill="var(--s-brand-2)"
                barSize={34}
                isAnimationActive={false}
              >
                <LabelList
                  dataKey="zerados"
                  position="inside"
                  formatter={(v: number) => (Number(v) > 0 ? String(v) : "")}
                  style={{ fill: "#fff", fontSize: 9, fontWeight: 700 }}
                />
              </Bar>
              <Bar
                yAxisId="hc"
                dataKey="ativosRestantes"
                name="HC's Ativos"
                stackId="hc"
                fill="var(--s-border-2)"
                barSize={34}
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              >
                {/* The crest label is the TOTAL active HC, not this segment. */}
                <LabelList
                  dataKey="ativos"
                  position="top"
                  style={{ fill: "var(--s-t2)", fontSize: 9, fontWeight: 700 }}
                />
              </Bar>
              <Line
                yAxisId="pct"
                type="monotone"
                dataKey="pctZerado"
                name="% que zerou"
                stroke="var(--s-brand)"
                strokeWidth={1.5}
                dot={{ r: 3, fill: "var(--s-brand)", strokeWidth: 1 }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              >
                <LabelList
                  dataKey="pctZerado"
                  position="top"
                  formatter={(v: number) => (v == null ? "" : `${String(v).replace(".", ",")}%`)}
                  style={{ fill: "var(--s-brand)", fontSize: 10, fontWeight: 700 }}
                />
              </Line>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Block>
  );
}

/**
 * Chart tooltips follow the shared chart's `DarkTooltip`: a solid `--s-t1` panel
 * with `--s-page` text. (`--s-ink-a` is a 6% veil, not an ink — using it as a
 * background left the card see-through.)
 */
function TooltipZerado({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: HcDesempenhoView["zeradoByDay"][number] }>;
}) {
  if (!active || !payload?.length) return null;

  const d = payload[0].payload;

  return (
    <div style={{ ...tooltipPanel, minWidth: 180 }}>
      <span style={tooltipTitle}>
        {ptBr(d.data)}
        {d.feriado && " · feriado"}
      </span>
      <span style={tooltipLine}>
        <span style={{ opacity: 0.7 }}>HC ativo</span>
        <span className="font-mono">{nf.format(d.ativos)}</span>
      </span>
      <span style={tooltipLine}>
        <span style={{ opacity: 0.7 }}>Zerados no dia</span>
        <span className="font-mono">{nf.format(d.zerados)}</span>
      </span>
      <span
        style={{
          ...tooltipLine,
          color: "var(--s-brand-2)",
          borderTop: "1px solid rgba(255,255,255,.16)",
          paddingTop: 4,
          marginTop: 2,
        }}
      >
        <span>Ociosidade</span>
        <span className="font-mono">{d.pctZerado.toLocaleString("pt-BR")}%</span>
      </span>
    </div>
  );
}

/* ---------------------------------------------------------------- Bloco 4 */

const HIERARCHY_OPTS = [
  { value: "gerencia" as const, label: "Gerência" },
  { value: "coordenacao" as const, label: "Coordenação" },
  { value: "cidade" as const, label: "Cidade" },
];

/** Bloco 4 — the shared regional table plus this screen's hierarchy switch. */
function RegionalBlock({
  view,
  filters,
  cross,
  onCross,
}: {
  view: HcDesempenhoView;
  filters: HcFilters;
  cross: HcCrossFilters;
  onCross: (key: keyof HcCrossFilters, value: string) => void;
}) {
  const [hierarchy, setHierarchy] = useState<"gerencia" | "coordenacao" | "cidade">("gerencia");
  const crossKey: keyof HcCrossFilters = hierarchy;

  return (
    <RegionalTable
      rows={view.regional[hierarchy]}
      days={view.days}
      label={HIERARCHY_OPTS.find((o) => o.value === hierarchy)?.label ?? "Gerência"}
      refDate={filters.to}
      selected={cross[crossKey]}
      onSelect={(nome) => onCross(crossKey, nome)}
      actions={
        <Segmented
          options={HIERARCHY_OPTS}
          value={hierarchy}
          onChange={setHierarchy}
          size="sm"
          ariaLabel="Hierarquia"
        />
      }
    />
  );
}

const INDIVIDUAL_OPTS = [
  { value: "hoje" as const, label: "Zerando Hoje" },
  { value: "mes" as const, label: "Recorrência Mês" },
];

function IndividualBlock({
  view,
  cross,
  onCross,
}: {
  view: HcDesempenhoView;
  cross: HcCrossFilters;
  onCross: (matricula: string) => void;
}) {
  const [tab, setTab] = useState<"hoje" | "mes">("hoje");
  const rows = useMemo(
    () => (tab === "hoje" ? view.vendedores.filter((v) => v.zeradoToday) : view.vendedores),
    [view.vendedores, tab],
  );
  const columns: Column<VendedorRow>[] = [
    {
      key: "nome",
      header: "Nome",
      sortValue: (r) => r.consultor,
      render: (r) => (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              flex: "none",
              display: "grid",
              placeItems: "center",
              width: 24,
              height: 24,
              borderRadius: 999,
              background: "var(--s-brand-weak)",
              color: "var(--s-brand)",
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            {(r.consultor || "?").charAt(0)}
          </span>
          <span style={{ display: "grid", gap: 1 }}>
            <span
              style={{
                fontWeight: r.matricula === cross.vendedor ? 800 : 700,
                color: r.matricula === cross.vendedor ? "var(--s-brand)" : "var(--s-t1)",
              }}
            >
              {r.consultor || "—"}
            </span>
            <span style={{ fontSize: 10.5, color: "var(--s-t3)" }}>{r.statusLabel}</span>
          </span>
        </span>
      ),
    },
    { key: "canal", header: "Canal", sortValue: (r) => r.canal, render: (r) => r.canal || "—" },
    { key: "cidade", header: "Cidade", sortValue: (r) => r.cidade, render: (r) => r.cidade || "—" },
    {
      key: "lideranca",
      header: "Liderança",
      sortValue: (r) => r.gerente,
      render: (r) => (
        <span style={{ display: "grid", gap: 1 }}>
          <span style={{ fontWeight: 700, color: "var(--s-t1)" }}>{r.gerente || "—"}</span>
          <span style={{ fontSize: 10.5, color: "var(--s-t3)" }}>{r.coordenacao || "—"}</span>
        </span>
      ),
    },
    {
      key: "cv",
      header: "Dias com venda",
      numeric: true,
      align: "right",
      sortValue: (r) => r.diasComVenda,
      render: (r) => <span style={{ color: "var(--s-ok)", fontWeight: 800 }}>{r.diasComVenda}</span>,
    },
    {
      key: "sv",
      header: "Dias que zerou",
      numeric: true,
      align: "right",
      sortValue: (r) => r.diasSemVenda,
      render: (r) => <span style={{ color: "var(--s-bad)", fontWeight: 800 }}>{r.diasSemVenda}</span>,
    },
    {
      key: "apr",
      header: "Aproveitamento",
      numeric: true,
      align: "right",
      sortValue: (r) => r.aproveitamento,
      render: (r) => `${r.aproveitamento}%`,
    },
    {
      key: "obs",
      header: "Obs.",
      align: "center",
      render: (r) => (
        <TrendHover
          title={`Produção diária: ${r.consultor}`}
          values={r.vendasByDay}
          days={view.days}
          color="var(--s-brand)"
        />
      ),
    },
  ];

  return (
    <Block
      title="Desempenho Individual & Análise de Ociosidade"
      note={`${nf.format(rows.length)} consultores · ${view.diasUteisElapsed} dias úteis`}
      actions={
        <Segmented
          options={INDIVIDUAL_OPTS}
          value={tab}
          onChange={setTab}
          size="sm"
          ariaLabel="Visão individual"
        />
      }
    >
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.matricula}
        minWidth={900}
        maxHeight={460}
        pageSize={25}
        infiniteScroll
        onRowClick={(r) => onCross(r.matricula)}
        isRowSelected={(r) => r.matricula === cross.vendedor}
        empty={{
          title: tab === "hoje" ? "Ninguém zerou na data de referência" : "Sem consultores no período",
          hint: "Ajuste o período ou os filtros de hierarquia.",
        }}
      />
    </Block>
  );
}

/* ---------------------------------------------------------------- Bloco 6 */

const MATRIZ_OPTS = [
  { value: "consultor" as const, label: "Consultor" },
  { value: "gerencia" as const, label: "Gerência" },
  { value: "coordenacao" as const, label: "Coordenação" },
  { value: "cidade" as const, label: "Cidade" },
];

const COL_NAME = 190;
const COL_CANAL = 96;
const COL_SERVICO = 104;

function MatrizBlock({ view, filters }: { view: HcDesempenhoView; filters: HcFilters }) {
  const router = useRouter();
  const pathname = usePathname();
  const current = useSearchParams();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const grouping = (Object.keys(view.matriz).find(
    (k) => view.matriz[k as keyof typeof view.matriz]?.length,
  ) ?? "consultor") as keyof typeof view.matriz;
  const filtered = useMemo(() => {
    const rows = view.matriz[grouping] ?? [];
    const term = search.trim().toLowerCase();

    return term ? rows.filter((r) => r.nome.toLowerCase().includes(term)) : rows;
  }, [view.matriz, grouping, search]);
  const byName = useMemo(() => {
    const map = new Map<string, MatrizRow[]>();

    for (const r of filtered) map.set(r.nome, [...(map.get(r.nome) ?? []), r]);

    return [...map.entries()].slice(0, 120);
  }, [filtered]);
  // "Ativo"/"Férias ..." under the consultant's name — Bloco 5 already computed
  // it per person; matched here by name, the same key the adapter itself uses
  // to keep Bloco 5 and 6 in the same order (see `matriz()` in databricks.ts).
  const statusByName = useMemo(
    () => new Map(view.vendedores.map((v) => [v.consultor.trim(), v.statusLabel])),
    [view.vendedores],
  );

  const changeView = (v: string) => {
    const q = keepScreenParams(new URLSearchParams(hcFiltersToQuery(filters)), current);

    q.set("matriz", v);
    startTransition(() => router.push(`${pathname}?${q.toString()}`, { scroll: false }));
  };

  // Sunday red, Saturday amber, holiday brand. Read by the header and the body,
  // so a weekend column reads as one all the way down a table that scrolls.
  const dayColors = useMemo(
    () =>
      view.days.map((d) => {
        const sunday = new Date(`${d.data}T00:00:00Z`).getUTCDay() === 0;

        if (d.feriado) return { fg: "var(--s-brand)", bg: "var(--s-brand-weak)", title: "Feriado" };

        if (sunday) return { fg: "var(--s-bad)", bg: "var(--s-bad-bg)", title: "Domingo" };

        if (d.fimDeSemana) return { fg: "var(--s-warn)", bg: "var(--s-warn-bg)", title: "Sábado" };

        return { fg: "var(--s-t3)", bg: "var(--s-card)", title: undefined };
      }),
    [view.days],
  );

  // Canal only makes sense per person; grouped views hide the column.
  const showCanal = grouping === "consultor";
  const servicoOffset = showCanal ? COL_NAME + COL_CANAL : COL_NAME;
  const frozenWidth = servicoOffset + COL_SERVICO;

  // One tooltip driven by mouse events, not a Radix root per cell — the grid is
  // ~15k cells on a full month and at most one shows a card at a time.
  const areaRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<{
    day: string;
    servico: string;
    value: number;
    breakdown: Array<{ indicador: string; value: number }>;
    x: number;
    y: number;
  } | null>(null);

  const onCellEnter = (
    e: React.MouseEvent<HTMLTableCellElement>,
    servico: string,
    i: number,
    value: number,
    breakdown: Array<{ indicador: string; value: number }> | undefined,
  ) => {
    const area = areaRef.current?.getBoundingClientRect();

    if (value <= 0 || !area) {
      setHovered(null);

      return;
    }

    const cell = e.currentTarget.getBoundingClientRect();
    // Clamped so a cell near either edge keeps the card inside the block.
    const center = cell.left - area.left + cell.width / 2;

    setHovered({
      day: ptBr(view.days[i]?.data ?? ""),
      servico,
      value,
      breakdown: breakdown ?? [],
      x: Math.min(Math.max(center, 120), Math.max(120, area.width - 120)),
      y: cell.top - area.top,
    });
  };

  return (
    <Block
      title="Produtividade Diária Detalhada (Matriz de Vendas)"
      note={
        byName.length >= 120
          ? "mostrando os 120 primeiros — refine a busca · passe o mouse num número para ver a quebra por indicador"
          : "passe o mouse num número para ver a quebra por indicador"
      }
      actions={
        <>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar consultor..."
            label="Buscar na matriz"
            width={130}
          />
          <Segmented
            options={MATRIZ_OPTS}
            value={grouping as string}
            onChange={changeView}
            size="sm"
            ariaLabel="Agrupamento da matriz"
          />
        </>
      }
    >
      <div ref={areaRef} style={{ position: "relative" }}>
        <div style={{ overflow: "auto", maxHeight: 460 }}>
          <table
            style={{
              borderCollapse: "separate",
              borderSpacing: 0,
              fontSize: 11.5,
              minWidth: frozenWidth + view.days.length * 62 + 60,
            }}
          >
            <thead>
              <tr>
                <th style={{ ...matrizTh, ...stickyCol(0, COL_NAME), zIndex: 4, textAlign: "left" }}>
                  {MATRIZ_OPTS.find((o) => o.value === grouping)?.label ?? "Consultor"}
                </th>
                {showCanal && (
                  <th
                    style={{ ...matrizTh, ...stickyCol(COL_NAME, COL_CANAL), zIndex: 4, textAlign: "left" }}
                  >
                    Canal
                  </th>
                )}
                <th
                  style={{
                    ...matrizTh,
                    ...stickyCol(servicoOffset, COL_SERVICO),
                    zIndex: 4,
                    textAlign: "left",
                    borderRight: "2px solid var(--s-border)",
                  }}
                >
                  Serviço
                </th>
                {view.days.map((d, i) => (
                  <th
                    key={d.data}
                    title={dayColors[i].title}
                    style={{
                      ...matrizTh,
                      minWidth: 62,
                      color: dayColors[i].fg,
                      background: dayColors[i].bg,
                    }}
                  >
                    {d.label}
                  </th>
                ))}
                <th style={{ ...matrizTh, minWidth: 60 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {byName.map(([nome, subjectRows], group) => {
                const byServico = new Map(subjectRows.map((r) => [r.servico, r]));
                const border = group === 0 ? undefined : "2px solid var(--s-border-2)";

                return SERVICO_ROWS.map((servico, idx) => {
                  const row = byServico.get(servico);
                  const first = idx === 0;

                  return (
                    <tr key={`${nome}||${servico}`}>
                      {first && (
                        <>
                          <td
                            rowSpan={SERVICO_ROWS.length}
                            style={{
                              ...matrizTd,
                              ...stickyCol(0, COL_NAME),
                              background: "var(--s-card)",
                              borderTop: border,
                              verticalAlign: "middle",
                              whiteSpace: "normal",
                            }}
                          >
                            <div style={{ fontWeight: 800, color: "var(--s-t1)" }} title={nome}>
                              {nome}
                            </div>
                            <div style={{ fontSize: 10.5, color: "var(--s-t3)", marginTop: 1 }}>
                              Total período:{" "}
                              <strong className="font-mono">
                                {nf.format(subjectRows[0]?.subjectTotal ?? 0)}
                              </strong>
                            </div>
                            {grouping === "consultor" && statusByName.get(nome.trim()) && (
                              <div style={{ fontSize: 10.5, color: "var(--s-t3)", marginTop: 1 }}>
                                {statusByName.get(nome.trim())}
                              </div>
                            )}
                          </td>
                          {showCanal && (
                            <td
                              rowSpan={SERVICO_ROWS.length}
                              style={{
                                ...matrizTd,
                                ...stickyCol(COL_NAME, COL_CANAL),
                                background: "var(--s-card)",
                                borderTop: border,
                                verticalAlign: "middle",
                                color: "var(--s-t2)",
                              }}
                            >
                              {subjectRows[0]?.detalhe}
                            </td>
                          )}
                        </>
                      )}
                      <td
                        style={{
                          ...matrizTd,
                          ...stickyCol(servicoOffset, COL_SERVICO),
                          background: "var(--s-sunken)",
                          borderRight: "2px solid var(--s-border)",
                          borderTop: first ? border : undefined,
                          fontWeight: 700,
                          color: "var(--s-t2)",
                        }}
                      >
                        {SERVICO_LABEL[servico] ?? servico}
                      </td>
                      {view.days.map((day, i) => {
                        const v = row?.values[i] ?? 0;
                        const color = dayColors[i];
                        const marked = color.title !== undefined;

                        return (
                          <td
                            key={day.data}
                            onMouseEnter={(e) => onCellEnter(e, servico, i, v, row?.breakdown?.[String(i)])}
                            onMouseLeave={() => setHovered(null)}
                            style={{
                              ...matrizTd,
                              minWidth: 62,
                              textAlign: "center",
                              borderTop: first ? border : undefined,
                              // A cell with production keeps the production colour;
                              // the column's tint shows through the empty ones.
                              color: v > 0 ? "var(--s-t1)" : marked ? color.fg : "var(--s-t3)",
                              fontWeight: v > 0 ? 800 : 400,
                              background: v > 0 ? "var(--s-brand-weak)" : marked ? color.bg : undefined,
                              opacity: v > 0 || !marked ? 1 : 0.75,
                              cursor: v > 0 ? "help" : undefined,
                            }}
                          >
                            {v > 0 ? nf.format(v) : "·"}
                          </td>
                        );
                      })}
                      <td
                        style={{
                          ...matrizTd,
                          textAlign: "center",
                          fontWeight: 800,
                          background: "var(--s-sunken)",
                          borderTop: first ? border : undefined,
                        }}
                      >
                        {nf.format(row?.total ?? 0)}
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>

        {hovered && (
          <div
            style={{
              ...tooltipPanel,
              position: "absolute",
              zIndex: 20,
              width: 224,
              left: hovered.x,
              top: hovered.y - 8,
              transform: "translate(-50%, -100%)",
              pointerEvents: "none",
              gap: 4,
              padding: "9px 11px",
            }}
          >
            <span style={{ ...tooltipTitle, display: "flex", justifyContent: "space-between", gap: 10 }}>
              <span>Detalhamento do dia</span>
              <span className="font-mono">{hovered.day}</span>
            </span>
            <span style={{ ...tooltipLine, color: "var(--s-brand-2)" }}>
              <span>Serviço</span>
              <span>{SERVICO_LABEL[hovered.servico] ?? hovered.servico}</span>
            </span>
            {hovered.breakdown.length === 0 ? (
              <span style={{ ...tooltipLine, fontWeight: 500, opacity: 0.6, justifyContent: "center" }}>
                Nenhum indicador correspondente
              </span>
            ) : (
              hovered.breakdown.map((q) => (
                <span key={q.indicador} style={{ ...tooltipLine, fontSize: 11.5 }}>
                  <span style={{ opacity: 0.7, fontWeight: 600 }}>{q.indicador}</span>
                  <span className="font-mono">{nf.format(q.value)}</span>
                </span>
              ))
            )}
            <span
              style={{
                ...tooltipLine,
                borderTop: "1px solid rgba(255,255,255,.16)",
                paddingTop: 4,
                marginTop: 2,
              }}
            >
              <span style={{ opacity: 0.7 }}>Total consolidado</span>
              <span className="font-mono">{nf.format(hovered.value)}</span>
            </span>
          </div>
        )}
      </div>
    </Block>
  );
}

/* ---------------------------------------------------------------- Bloco 7 */

const PDU_OPTS = [
  { value: "dia" as const, label: "PDU Dia" },
  { value: "mes" as const, label: "PDU Mês" },
];

function PduBlock({ view, filters }: { view: HcDesempenhoView; filters: HcFilters }) {
  const [mode, setMode] = useState<"dia" | "mes">("dia");
  const servicos = filters.servico.length
    ? filters.servico.map((s) => (s === "INTERNET" ? "FTTH" : s)).join(" + ")
    : "TODOS";

  return (
    <Block
      title="PDU (HC Ativo)"
      note={`Serviços: ${servicos} · status: ${filters.statusVenda}`}
      actions={
        <Segmented options={PDU_OPTS} value={mode} onChange={setMode} size="sm" ariaLabel="Visão da PDU" />
      }
    >
      <div style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          {mode === "dia" ? (
            <AreaChart data={view.pduDay} margin={{ top: 28, right: 8, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="pduGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--s-brand)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--s-brand)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--s-border)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "var(--s-t3)" }}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={56}
              />
              <YAxis tick={{ fontSize: 10, fill: "var(--s-t3)" }} width={44} />
              <ChartTooltip content={<TooltipPduDay />} />
              <Legend
                verticalAlign="top"
                align="right"
                height={26}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, fontWeight: 700, color: "var(--s-t2)" }}
              />
              <Area
                type="monotone"
                dataKey="pdu"
                name="PDU acumulada"
                stroke="var(--s-brand)"
                strokeWidth={2}
                fill="url(#pduGrad)"
                isAnimationActive={false}
              >
                <LabelList
                  dataKey="pdu"
                  position="top"
                  formatter={(v: number) => String(v).replace(".", ",")}
                  style={{ fill: "var(--s-t1)", fontSize: 10, fontWeight: 700 }}
                />
              </Area>
            </AreaChart>
          ) : (
            <AreaChart data={view.pduMonth} margin={{ top: 28, right: 8, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="pduGradMes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--s-brand)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--s-brand)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--s-border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10.5, fill: "var(--s-t3)" }} />
              <YAxis tick={{ fontSize: 10, fill: "var(--s-t3)" }} width={44} />
              <ChartTooltip
                content={({ active, payload }) => (
                  <TooltipPduMonth
                    active={active}
                    payload={payload as React.ComponentProps<typeof TooltipPduMonth>["payload"]}
                    servicos={filters.servico}
                  />
                )}
              />
              <Legend
                verticalAlign="top"
                align="right"
                height={26}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, fontWeight: 700, color: "var(--s-t2)" }}
              />
              <Area
                type="monotone"
                dataKey="pdu"
                name="PDU do mês"
                stroke="var(--s-brand)"
                strokeWidth={2}
                fill="url(#pduGradMes)"
                isAnimationActive={false}
              >
                <LabelList
                  dataKey="pdu"
                  position="top"
                  formatter={(v: number) => String(v).replace(".", ",")}
                  style={{ fill: "var(--s-t1)", fontSize: 10, fontWeight: 700 }}
                />
              </Area>
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
      <p
        style={{
          fontSize: 11,
          color: "var(--s-t3)",
          marginTop: 8,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Users size={12} style={{ flex: "none" }} />
        {mode === "dia"
          ? "Cálculo: (produção acumulada ÷ dias úteis decorridos) ÷ total de HC ativo."
          : "Cálculo: (produção dos HCs ativos no fechamento ÷ dias úteis) ÷ total desses mesmos HCs."}
      </p>
    </Block>
  );
}

function TooltipPduDay({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: HcDesempenhoView["pduDay"][number] }>;
}) {
  if (!active || !payload?.length) return null;

  const d = payload[0].payload;

  return (
    <div style={{ ...tooltipPanel, minWidth: 180 }}>
      <span style={tooltipTitle}>{d.label}</span>
      <span style={tooltipLine}>
        <span style={{ opacity: 0.7 }}>PDU acumulada</span>
        <span className="font-mono">{d.pdu.toLocaleString("pt-BR")}</span>
      </span>
      <span style={tooltipLine}>
        <span style={{ opacity: 0.7 }}>Produção do dia</span>
        <span className="font-mono">{nf.format(d.producao)}</span>
      </span>
    </div>
  );
}

function TooltipPduMonth({
  active,
  payload,
  servicos = [],
}: {
  active?: boolean;
  payload?: Array<{ payload: HcDesempenhoView["pduMonth"][number] }>;
  /** Serviço filter in force; empty means all. Filtered-out services are hidden. */
  servicos?: string[];
}) {
  if (!active || !payload?.length) return null;

  const m = payload[0].payload;
  const shows = (s: string) => servicos.length === 0 || servicos.includes(s);
  const lines: Array<[string, string]> = [["PDU", m.pdu.toLocaleString("pt-BR")]];

  if (shows("INTERNET")) lines.push(["FTTH (Internet)", nf.format(m.ftth)]);

  if (shows("FWA")) lines.push(["FWA", nf.format(m.fwa)]);

  if (shows("5G")) lines.push(["5G (Chips)", nf.format(m.chips5g)]);

  if (shows("RENOVAÇÃO")) lines.push(["Renovação", nf.format(m.renovacoes)]);

  return (
    <div style={{ ...tooltipPanel, minWidth: 210 }}>
      <span style={tooltipTitle}>{m.label}</span>
      {lines.map(([label, value]) => (
        <span key={label} style={tooltipLine}>
          <span style={{ opacity: 0.7 }}>{label}</span>
          <span className="font-mono">{value}</span>
        </span>
      ))}
      <span
        style={{
          ...tooltipLine,
          borderTop: "1px solid rgba(255,255,255,.16)",
          paddingTop: 4,
          marginTop: 2,
        }}
      >
        <span style={{ opacity: 0.7 }}>Volume total</span>
        <span className="font-mono">{nf.format(m.total)}</span>
      </span>
      <span style={{ ...tooltipLine, fontSize: 11, opacity: 0.7 }}>
        <span>HC ativo</span>
        <span className="font-mono">
          {/* `situacao` is only filled from March 2026 on — before that the
              count is absent, not zero. */}
          {m.hcAtivo > 0 ? nf.format(m.hcAtivo) : "—"} · {m.diasUteis} dias úteis
        </span>
      </span>
    </div>
  );
}
