"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Eye, Info, MinusCircle, RefreshCw, Search, TrendingDown, TrendingUp, Users } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HcContextoAtivo, HcFilterPanel } from "./HcFilterPanel";
import { useReportNavPending } from "@/lib/ui/nav-pending";
import { hcFiltersToQuery } from "@/lib/data/hc-zerado/filters";
import type {
  HcCrossFilters,
  HcDesempenhoView,
  HcFilterOptions,
  HcFilters,
  MatrizRow,
  RegionalRow,
  VendedorRow,
} from "@/lib/data/hc-zerado/types";

const card: React.CSSProperties = {
  border: "1px solid var(--s-border)",
  borderRadius: 14,
  background: "var(--s-card)",
  boxShadow: "var(--s-sh)",
};

const tituloBloco: React.CSSProperties = {
  fontSize: 13.5,
  fontWeight: 800,
  color: "var(--s-t1)",
  letterSpacing: "-.01em",
};

const nf = new Intl.NumberFormat("pt-BR");

function ptBr(iso: string): string {
  return iso.split("-").reverse().join("/");
}

/** Section wrapper: a dot, a title, an optional note and the block's controls. */
function Bloco({
  titulo,
  nota,
  acoes,
  children,
}: {
  titulo: string;
  nota?: React.ReactNode;
  acoes?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section style={card}>
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 10,
          padding: "12px 14px",
          borderBottom: "1px solid var(--s-border)",
        }}
      >
        <span
          style={{ flex: "none", width: 7, height: 7, borderRadius: 999, background: "var(--s-brand)" }}
        />
        <h2 className="font-display" style={tituloBloco}>
          {titulo}
        </h2>
        {nota && <span style={{ fontSize: 11, color: "var(--s-t3)" }}>{nota}</span>}
        <div style={{ marginLeft: "auto", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {acoes}
        </div>
      </header>
      <div style={{ padding: 14 }}>{children}</div>
    </section>
  );
}

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
  const [pending, startTransition] = useTransition();
  // The click has to look answered before the data comes back: the chip/row
  // paints selected from this optimistic copy while the server recomputes, and
  // the screen dims until it lands. Without it a click reads as a dead control.
  const [otimista, setOtimista] = useState<HcCrossFilters | null>(null);
  const cross = otimista ?? filters.cross;
  const crossAplicado = Object.values(filters.cross).join("|");

  useReportNavPending(pending);

  useEffect(() => {
    setOtimista(null);
  }, [crossAplicado]);

  /** Click-to-filter: toggling writes the cross-filter into the URL. */
  const cruza = (chave: keyof HcCrossFilters, valor: string) => {
    const q = new URLSearchParams(hcFiltersToQuery(filters));
    const param = `cf_${chave}`;
    const desmarcando = q.get(param) === valor;

    if (desmarcando) q.delete(param);
    else q.set(param, valor);

    setOtimista({ ...filters.cross, [chave]: desmarcando ? "" : valor });
    startTransition(() => router.push(`${pathname}?${q.toString()}`));
  };

  // The cross-filter has to carry the matrícula (it is the query key), but the
  // chip should say who that is.
  const nomeVendedor = cross.vendedor
    ? (view.vendedores.find((v) => v.matricula === cross.vendedor)?.consultor ??
      `Matrícula ${cross.vendedor}`)
    : undefined;
  const periodo =
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
            Ativos e zerados · {periodo} · referência {ptBr(view.refDate)}
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
      <HcContextoAtivo filters={filters} rotulos={{ vendedor: nomeVendedor }} />
      <QuadroGeralBloco view={view} />
      <TotalizadoresBloco view={view} filters={filters} cross={cross} onCruzar={(s) => cruza("servico", s)} />
      <ZeradoDiaBloco view={view} />
      <RegionalBloco view={view} filters={filters} cross={cross} onCruzar={cruza} />
      <IndividualBloco view={view} cross={cross} onCruzar={(m) => cruza("vendedor", m)} />
      <MatrizBloco view={view} filters={filters} />
      <PduBloco view={view} filters={filters} />
    </div>
  );
}

/* ---------------------------------------------------------------- Bloco 1 */

function QuadroGeralBloco({ view }: { view: HcDesempenhoView }) {
  const { quadroGeral } = view;
  const cores: Record<string, string> = {
    Ativos: "var(--s-ok)",
    Férias: "var(--s-blue)",
    Maternidade: "var(--s-brand)",
    INSS: "var(--s-warn)",
  };

  return (
    <Bloco
      titulo="Total Quadro de HC"
      nota="Reflete a data máxima do filtro final"
      acoes={
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
                  color: cores[item.label] ?? "var(--s-t1)",
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
    </Bloco>
  );
}

/* ---------------------------------------------------------------- Bloco 2 */

function TotalizadoresBloco({
  view,
  filters,
  cross,
  onCruzar,
}: {
  view: HcDesempenhoView;
  filters: HcFilters;
  cross: HcCrossFilters;
  onCruzar: (servico: string) => void;
}) {
  const t = view.totalizadores;
  const cards = [
    {
      servico: "INTERNET",
      label: "FTTH",
      valor: t.ftth,
      cor: "var(--s-brand)",
      sub: `Status: ${filters.statusVenda}`,
    },
    {
      servico: "FWA",
      label: "FWA",
      valor: t.fwa,
      cor: "var(--s-blue)",
      sub: `Status: ${filters.statusVenda}`,
    },
    {
      servico: "5G",
      label: "Chips 5G",
      valor: t.chips5g,
      cor: "var(--s-ok)",
      sub: "Status: Ativado/Efetivado",
    },
    {
      servico: "RENOVAÇÃO",
      label: "Renovações",
      valor: t.renovacoes,
      cor: "var(--s-warn)",
      sub: "Status: Efetivada",
    },
  ];

  return (
    <Bloco
      titulo="Totalizadores de Produção (Entregas do Período)"
      nota={`Status sob análise: ${filters.statusVenda}`}
    >
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        {cards.map((c) => {
          const ativo = cross.servico === c.servico;
          const valor = c.valor;

          return (
            <button
              key={c.servico}
              type="button"
              disabled={valor === null}
              onClick={() => onCruzar(c.servico)}
              style={{
                ...card,
                boxShadow: "none",
                textAlign: "left",
                padding: "12px 14px",
                cursor: valor === null ? "default" : "pointer",
                borderColor: ativo
                  ? "var(--s-brand)"
                  : valor === null
                    ? "var(--s-border-2)"
                    : "var(--s-border)",
                background: ativo ? "var(--s-brand-weak)" : "var(--s-sunken)",
                borderStyle: valor === null ? "dashed" : "solid",
                opacity: valor === null ? 0.75 : 1,
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
              {valor === null ? (
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
                    style={{ fontSize: 26, fontWeight: 800, color: c.cor, lineHeight: 1.1, marginTop: 4 }}
                  >
                    {nf.format(valor)}
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
    </Bloco>
  );
}

/* ---------------------------------------------------------------- Bloco 3 */

const FERIADO_OPTS = [
  { value: "todos" as const, label: "Todos" },
  { value: "sim" as const, label: "Sim" },
  { value: "nao" as const, label: "Não" },
];

function ZeradoDiaBloco({ view }: { view: HcDesempenhoView }) {
  const [feriado, setFeriado] = useState<"todos" | "sim" | "nao">("nao");
  const dados = useMemo(
    () =>
      view.zeradoPorDia.filter((d) =>
        feriado === "todos" ? true : feriado === "sim" ? d.feriado : !d.feriado,
      ),
    [view.zeradoPorDia, feriado],
  );

  return (
    <Bloco
      titulo="Quantidade de HC Zerado por Dia (Ativos vs. Sem Vendas)"
      acoes={
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
        <div style={{ minWidth: Math.max(560, dados.length * 46), height: 340 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dados} margin={{ top: 28, right: 8, left: 0, bottom: 4 }}>
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
    </Bloco>
  );
}

/**
 * Chart tooltips follow the shared chart's `DarkTooltip`: a solid `--s-t1` panel
 * with `--s-page` text. (`--s-ink-a` is a 6% veil, not an ink — using it as a
 * background left the card see-through.)
 */
const tooltipPainel: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  padding: "7px 10px",
  borderRadius: 10,
  background: "var(--s-t1)",
  boxShadow: "var(--s-sh-2)",
};

const tooltipTitulo: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "var(--s-page)",
  opacity: 0.75,
};

const tooltipLinha: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "var(--s-page)",
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
};

function TooltipZerado({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: HcDesempenhoView["zeradoPorDia"][number] }>;
}) {
  if (!active || !payload?.length) return null;

  const d = payload[0].payload;

  return (
    <div style={{ ...tooltipPainel, minWidth: 180 }}>
      <span style={tooltipTitulo}>
        {ptBr(d.data)}
        {d.feriado && " · feriado"}
      </span>
      <span style={tooltipLinha}>
        <span style={{ opacity: 0.7 }}>HC ativo</span>
        <span className="font-mono">{nf.format(d.ativos)}</span>
      </span>
      <span style={tooltipLinha}>
        <span style={{ opacity: 0.7 }}>Zerados no dia</span>
        <span className="font-mono">{nf.format(d.zerados)}</span>
      </span>
      <span
        style={{
          ...tooltipLinha,
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

const HIERARQUIA_OPTS = [
  { value: "gerencia" as const, label: "Gerência" },
  { value: "coordenacao" as const, label: "Coordenação" },
  { value: "cidade" as const, label: "Cidade" },
];

function RegionalBloco({
  view,
  filters,
  cross,
  onCruzar,
}: {
  view: HcDesempenhoView;
  filters: HcFilters;
  cross: HcCrossFilters;
  onCruzar: (chave: keyof HcCrossFilters, valor: string) => void;
}) {
  const [visao, setVisao] = useState<"gerencia" | "coordenacao" | "cidade">("gerencia");
  const rows = view.regional[visao];
  const rotulo = visao === "gerencia" ? "Gerência" : visao === "coordenacao" ? "Coordenação" : "Cidade";
  const chaveCross: keyof HcCrossFilters =
    visao === "gerencia" ? "gerencia" : visao === "coordenacao" ? "coordenacao" : "cidade";
  const selecionado = cross[chaveCross];
  const colunas: Column<RegionalRow>[] = [
    {
      key: "nome",
      header: rotulo,
      render: (r) => (
        <span
          style={{
            fontWeight: r.nome === selecionado ? 800 : 700,
            color: r.nome === selecionado ? "var(--s-brand)" : "var(--s-t1)",
          }}
        >
          {r.nome}
        </span>
      ),
    },
    {
      key: "ativo",
      header: "Total HC Ativo",
      numeric: true,
      align: "right",
      render: (r) => nf.format(r.totalAtivo),
    },
    {
      key: "vendeu",
      header: "QTD. HC Vendeu",
      numeric: true,
      align: "right",
      render: (r) => nf.format(r.totalVenderam),
    },
    {
      key: "pctv",
      header: "% QTD. HC Vendeu",
      numeric: true,
      align: "right",
      render: (r) => `${r.pctVendeu}%`,
    },
    {
      key: "zerou",
      header: "Total HC que Zerou",
      numeric: true,
      align: "right",
      render: (r) => (
        <span style={{ color: "var(--s-bad)", fontWeight: 800 }}>{nf.format(r.totalZerado)}</span>
      ),
    },
    {
      key: "pctz",
      header: "% HC que Zerou",
      numeric: true,
      align: "right",
      render: (r) => <span style={{ color: "var(--s-bad)", fontWeight: 800 }}>{r.pctZerado}%</span>,
    },
    { key: "d1", header: "Comparativo D-1", align: "center", render: (r) => <ComparativoD1 row={r} /> },
    {
      key: "obs",
      header: "Obs.",
      align: "center",
      render: (r) => (
        <TendenciaHover
          titulo={`Ociosidade (HC Zerado): ${r.nome}`}
          valores={r.serieZerados}
          dias={view.dias}
          cor="var(--s-bad)"
        />
      ),
    },
  ];

  return (
    <Bloco
      titulo="Desempenho Regional por Hierarquia"
      nota={`Dados referentes a: ${ptBr(filters.to)}`}
      acoes={
        <Segmented
          options={HIERARQUIA_OPTS}
          value={visao}
          onChange={setVisao}
          size="sm"
          ariaLabel="Hierarquia"
        />
      }
    >
      <DataTable
        columns={colunas}
        rows={rows}
        rowKey={(r) => r.id}
        minWidth={880}
        maxHeight={420}
        pageSize={visao === "cidade" ? 25 : undefined}
        onRowClick={(r) => onCruzar(chaveCross, r.nome)}
        isRowSelected={(r) => r.nome === selecionado}
        empty={{ title: "Sem dados no período", hint: "Ajuste o período ou os filtros de hierarquia." }}
      />
    </Bloco>
  );
}

function ComparativoD1({ row }: { row: RegionalRow }) {
  const delta = row.countZeradoD0 - row.countZeradoD1;
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    borderRadius: 6,
    padding: "1px 7px",
    fontSize: 11,
    fontWeight: 800,
  };

  if (delta === 0) {
    return (
      <span
        style={{ ...base, background: "var(--s-sunken)", color: "var(--s-t3)" }}
        title="Estável — sem alteração na quantidade de HC zerado"
      >
        <MinusCircle size={13} />0
      </span>
    );
  }

  const melhorou = delta < 0;
  const Icone = melhorou ? TrendingDown : TrendingUp;

  return (
    <span
      style={{
        ...base,
        background: melhorou ? "var(--s-ok-bg)" : "var(--s-bad-bg)",
        color: melhorou ? "var(--s-ok)" : "var(--s-bad)",
      }}
      title={`${melhorou ? "Melhorou" : "Piorou"} em ${Math.abs(delta)} HC — zerados de ${row.countZeradoD1} para ${row.countZeradoD0}`}
    >
      <Icone size={13} />
      {melhorou ? `-${Math.abs(delta)}` : `+${delta}`}
    </span>
  );
}

/**
 * The "Obs." column: an eye that opens the daily trend on hover.
 *
 * It goes through the shared Radix tooltip because these tables scroll — an
 * absolutely positioned card gets clipped by the scroll container, which is why
 * an inline sparkline read as "nothing happens".
 */
function TendenciaHover({
  titulo,
  valores,
  dias,
  cor,
}: {
  titulo: string;
  valores: number[];
  dias: HcDesempenhoView["dias"];
  cor: string;
}) {
  const dados = valores.map((valor, i) => ({ label: dias[i]?.label.replace(" - ", "-") ?? "", valor }));

  return (
    <Tooltip delayDuration={80}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label={titulo}
          style={{
            display: "inline-grid",
            placeItems: "center",
            width: 26,
            height: 26,
            border: 0,
            borderRadius: 7,
            background: "transparent",
            color: "var(--s-t3)",
            cursor: "help",
          }}
        >
          <Eye size={14} />
        </button>
      </TooltipTrigger>
      {/* The shared tooltip paints itself with `bg-primary`, which is the brand
          red — a chart inside it disappears. This one is a panel, not a hint. */}
      <TooltipContent
        side="left"
        style={{
          width: 420,
          padding: 12,
          background: "var(--s-card)",
          color: "var(--s-t1)",
          border: "1px solid var(--s-border)",
          boxShadow: "var(--s-sh-2)",
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "var(--s-t3)",
            marginBottom: 6,
          }}
        >
          {titulo}
        </div>
        <div style={{ height: 150 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dados} margin={{ top: 16, right: 14, left: -12, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--s-border)" />
              <XAxis
                dataKey="label"
                padding={{ left: 12, right: 8 }}
                tick={{ fontSize: 9, fill: "var(--s-t2)", fontWeight: 600 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 8, fill: "var(--s-t3)" }}
                tickLine={false}
                axisLine={false}
                width={20}
                domain={[0, "dataMax + 1"]}
              />
              <Line
                type="monotone"
                dataKey="valor"
                stroke={cor}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              >
                <LabelList
                  dataKey="valor"
                  position="top"
                  style={{ fill: cor, fontSize: 9, fontWeight: 700 }}
                />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/* ---------------------------------------------------------------- Bloco 5 */

const INDIVIDUAL_OPTS = [
  { value: "hoje" as const, label: "Zerando Hoje" },
  { value: "mes" as const, label: "Recorrência Mês" },
];

function IndividualBloco({
  view,
  cross,
  onCruzar,
}: {
  view: HcDesempenhoView;
  cross: HcCrossFilters;
  onCruzar: (matricula: string) => void;
}) {
  const [visao, setVisao] = useState<"hoje" | "mes">("hoje");
  const rows = useMemo(
    () => (visao === "hoje" ? view.vendedores.filter((v) => v.zerouHoje) : view.vendedores),
    [view.vendedores, visao],
  );
  const colunas: Column<VendedorRow>[] = [
    {
      key: "nome",
      header: "Nome",
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
          <span
            style={{
              fontWeight: r.matricula === cross.vendedor ? 800 : 700,
              color: r.matricula === cross.vendedor ? "var(--s-brand)" : "var(--s-t1)",
            }}
          >
            {r.consultor || "—"}
          </span>
        </span>
      ),
    },
    { key: "canal", header: "Canal", render: (r) => r.canal || "—" },
    { key: "cidade", header: "Cidade", render: (r) => r.cidade || "—" },
    {
      key: "lideranca",
      header: "Liderança",
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
      render: (r) => <span style={{ color: "var(--s-ok)", fontWeight: 800 }}>{r.diasComVenda}</span>,
    },
    {
      key: "sv",
      header: "Dias que zerou",
      numeric: true,
      align: "right",
      render: (r) => <span style={{ color: "var(--s-bad)", fontWeight: 800 }}>{r.diasSemVenda}</span>,
    },
    {
      key: "apr",
      header: "Aproveitamento",
      numeric: true,
      align: "right",
      render: (r) => `${r.aproveitamento}%`,
    },
    {
      key: "obs",
      header: "Obs.",
      align: "center",
      render: (r) => (
        <TendenciaHover
          titulo={`Produção diária: ${r.consultor}`}
          valores={r.vendasPorDia}
          dias={view.dias}
          cor="var(--s-brand)"
        />
      ),
    },
  ];

  return (
    <Bloco
      titulo="Desempenho Individual & Análise de Ociosidade"
      nota={`${nf.format(rows.length)} consultores · ${view.diasUteisDecorridos} dias úteis`}
      acoes={
        <Segmented
          options={INDIVIDUAL_OPTS}
          value={visao}
          onChange={setVisao}
          size="sm"
          ariaLabel="Visão individual"
        />
      }
    >
      <DataTable
        columns={colunas}
        rows={rows}
        rowKey={(r) => r.matricula}
        minWidth={900}
        maxHeight={460}
        pageSize={25}
        onRowClick={(r) => onCruzar(r.matricula)}
        isRowSelected={(r) => r.matricula === cross.vendedor}
        empty={{
          title: visao === "hoje" ? "Ninguém zerou na data de referência" : "Sem consultores no período",
          hint: "Ajuste o período ou os filtros de hierarquia.",
        }}
      />
    </Bloco>
  );
}

/* ---------------------------------------------------------------- Bloco 6 */

const MATRIZ_OPTS = [
  { value: "consultor" as const, label: "Consultor" },
  { value: "gerencia" as const, label: "Gerência" },
  { value: "coordenacao" as const, label: "Coordenação" },
  { value: "cidade" as const, label: "Cidade" },
];

const NOME_SERVICO: Record<string, string> = { INTERNET: "FTTH", FWA: "FWA", "5G": "5G" };

function MatrizBloco({ view, filters }: { view: HcDesempenhoView; filters: HcFilters }) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [busca, setBusca] = useState("");
  const visao = (Object.keys(view.matriz).find((k) => view.matriz[k as keyof typeof view.matriz]?.length) ??
    "consultor") as keyof typeof view.matriz;
  const filtradas = useMemo(() => {
    const rows = view.matriz[visao] ?? [];
    const termo = busca.trim().toLowerCase();

    return termo ? rows.filter((r) => r.nome.toLowerCase().includes(termo)) : rows;
  }, [view.matriz, visao, busca]);
  const porNome = useMemo(() => {
    const mapa = new Map<string, MatrizRow[]>();

    for (const r of filtradas) mapa.set(r.nome, [...(mapa.get(r.nome) ?? []), r]);

    return [...mapa.entries()].slice(0, 120);
  }, [filtradas]);

  const trocaVisao = (v: string) => {
    const q = new URLSearchParams(hcFiltersToQuery(filters));

    q.set("matriz", v);
    startTransition(() => router.push(`${pathname}?${q.toString()}`));
  };

  return (
    <Bloco
      titulo="Produtividade Diária Detalhada (Matriz de Vendas)"
      nota={porNome.length >= 120 ? "mostrando os 120 primeiros — refine a busca" : undefined}
      acoes={
        <>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              height: 34,
              padding: "0 12px",
              border: "1px solid var(--s-border)",
              borderRadius: 999,
              background: "var(--s-sunken)",
            }}
          >
            <Search size={13} strokeWidth={2.2} style={{ color: "var(--s-t3)", flex: "none" }} />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar consultor..."
              aria-label="Buscar na matriz"
              style={{
                border: 0,
                background: "none",
                outline: "none",
                font: "inherit",
                fontSize: 12.5,
                color: "var(--s-t1)",
                width: 130,
              }}
            />
          </label>
          <Segmented
            options={MATRIZ_OPTS}
            value={visao as string}
            onChange={trocaVisao}
            size="sm"
            ariaLabel="Agrupamento da matriz"
          />
        </>
      }
    >
      <div style={{ overflow: "auto", maxHeight: 460 }}>
        <table
          style={{
            borderCollapse: "separate",
            borderSpacing: 0,
            fontSize: 11.5,
            minWidth: 190 + view.dias.length * 62 + 60,
          }}
        >
          <thead>
            <tr>
              <th style={{ ...thMatriz, position: "sticky", left: 0, zIndex: 3, minWidth: 190 }}>
                Consultor / Serviço
              </th>
              {view.dias.map((d) => {
                // Sunday red, Saturday amber, holiday brand — the original's own
                // colour code for the day columns.
                const domingo = new Date(`${d.data}T00:00:00Z`).getUTCDay() === 0;
                const cor = d.feriado
                  ? { fg: "var(--s-brand)", bg: "var(--s-brand-weak)", titulo: "Feriado" }
                  : domingo
                    ? { fg: "var(--s-bad)", bg: "var(--s-bad-bg)", titulo: "Domingo" }
                    : d.fimDeSemana
                      ? { fg: "var(--s-warn)", bg: "var(--s-warn-bg)", titulo: "Sábado" }
                      : { fg: "var(--s-t3)", bg: "var(--s-card)", titulo: undefined };

                return (
                  <th
                    key={d.data}
                    title={cor.titulo}
                    style={{ ...thMatriz, minWidth: 62, color: cor.fg, background: cor.bg }}
                  >
                    {d.label}
                  </th>
                );
              })}
              <th style={{ ...thMatriz, minWidth: 60 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {porNome.map(([nome, linhas]) => (
              <>
                <tr key={nome}>
                  <td
                    colSpan={view.dias.length + 2}
                    style={{
                      position: "sticky",
                      left: 0,
                      padding: "7px 10px",
                      background: "var(--s-sunken)",
                      borderTop: "1px solid var(--s-border)",
                      fontWeight: 800,
                      color: "var(--s-t1)",
                    }}
                  >
                    {nome}
                    <span style={{ fontWeight: 600, color: "var(--s-t3)", marginLeft: 8 }}>
                      {linhas[0]?.detalhe}
                    </span>
                  </td>
                </tr>
                {linhas.map((linha) => (
                  <tr key={linha.id}>
                    <td
                      style={{
                        ...tdMatriz,
                        position: "sticky",
                        left: 0,
                        background: "var(--s-card)",
                        fontWeight: 700,
                      }}
                    >
                      {NOME_SERVICO[linha.servico] ?? linha.servico}
                    </td>
                    {linha.valores.map((v, i) => (
                      <td
                        key={view.dias[i].data}
                        style={{
                          ...tdMatriz,
                          minWidth: 62,
                          textAlign: "center",
                          color: v > 0 ? "var(--s-t1)" : "var(--s-t3)",
                          fontWeight: v > 0 ? 800 : 400,
                          background: v > 0 ? "var(--s-brand-weak)" : undefined,
                        }}
                      >
                        {v > 0 ? nf.format(v) : "·"}
                      </td>
                    ))}
                    <td style={{ ...tdMatriz, textAlign: "right", fontWeight: 800 }}>
                      {nf.format(linha.total)}
                    </td>
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </Bloco>
  );
}

const thMatriz: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 2,
  background: "var(--s-card)",
  borderBottom: "1px solid var(--s-border)",
  padding: "7px 6px",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: ".06em",
  textTransform: "uppercase",
  color: "var(--s-t3)",
  textAlign: "center",
  whiteSpace: "nowrap",
};

const tdMatriz: React.CSSProperties = {
  padding: "5px 6px",
  borderBottom: "1px solid var(--s-border)",
  whiteSpace: "nowrap",
};

/* ---------------------------------------------------------------- Bloco 7 */

const PDU_OPTS = [
  { value: "dia" as const, label: "PDU Dia" },
  { value: "mes" as const, label: "PDU Mês" },
];

function PduBloco({ view, filters }: { view: HcDesempenhoView; filters: HcFilters }) {
  const [visao, setVisao] = useState<"dia" | "mes">("dia");
  const servicos = filters.servico.length
    ? filters.servico.map((s) => (s === "INTERNET" ? "FTTH" : s)).join(" + ")
    : "TODOS";

  return (
    <Bloco
      titulo="PDU (HC Ativo)"
      nota={`Serviços: ${servicos} · status: ${filters.statusVenda}`}
      acoes={
        <Segmented options={PDU_OPTS} value={visao} onChange={setVisao} size="sm" ariaLabel="Visão da PDU" />
      }
    >
      <div style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          {visao === "dia" ? (
            <AreaChart data={view.pduDia} margin={{ top: 28, right: 8, left: 0, bottom: 4 }}>
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
              <ChartTooltip content={<TooltipPduDia />} />
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
            <AreaChart data={view.pduMes} margin={{ top: 28, right: 8, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="pduGradMes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--s-brand)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--s-brand)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--s-border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10.5, fill: "var(--s-t3)" }} />
              <YAxis tick={{ fontSize: 10, fill: "var(--s-t3)" }} width={44} />
              <ChartTooltip content={<TooltipPduMes />} />
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
        {visao === "dia"
          ? "Cálculo: (produção acumulada ÷ dias úteis decorridos) ÷ total de HC ativo."
          : "Cálculo: (produção dos HCs ativos no fechamento ÷ dias úteis) ÷ total desses mesmos HCs."}
      </p>
    </Bloco>
  );
}

function TooltipPduDia({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: HcDesempenhoView["pduDia"][number] }>;
}) {
  if (!active || !payload?.length) return null;

  const d = payload[0].payload;

  return (
    <div style={{ ...tooltipPainel, minWidth: 180 }}>
      <span style={tooltipTitulo}>{d.label}</span>
      <span style={tooltipLinha}>
        <span style={{ opacity: 0.7 }}>PDU acumulada</span>
        <span className="font-mono">{d.pdu.toLocaleString("pt-BR")}</span>
      </span>
      <span style={tooltipLinha}>
        <span style={{ opacity: 0.7 }}>Produção do dia</span>
        <span className="font-mono">{nf.format(d.producao)}</span>
      </span>
    </div>
  );
}

function TooltipPduMes({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: HcDesempenhoView["pduMes"][number] }>;
}) {
  if (!active || !payload?.length) return null;

  const m = payload[0].payload;
  const linhas: Array<[string, string]> = [
    ["PDU", m.pdu.toLocaleString("pt-BR")],
    ["FTTH (Internet)", nf.format(m.ftth)],
    ["FWA", nf.format(m.fwa)],
    ["5G (Chips)", nf.format(m.chips5g)],
  ];

  return (
    <div style={{ ...tooltipPainel, minWidth: 210 }}>
      <span style={tooltipTitulo}>{m.label}</span>
      {linhas.map(([rotulo, valor]) => (
        <span key={rotulo} style={tooltipLinha}>
          <span style={{ opacity: 0.7 }}>{rotulo}</span>
          <span className="font-mono">{valor}</span>
        </span>
      ))}
      <span
        style={{
          ...tooltipLinha,
          borderTop: "1px solid rgba(255,255,255,.16)",
          paddingTop: 4,
          marginTop: 2,
        }}
      >
        <span style={{ opacity: 0.7 }}>Volume total</span>
        <span className="font-mono">{nf.format(m.total)}</span>
      </span>
      <span style={{ ...tooltipLinha, fontSize: 11, opacity: 0.7 }}>
        <span>HC ativo</span>
        <span className="font-mono">
          {nf.format(m.hcAtivo)} · {m.diasUteis} dias úteis
        </span>
      </span>
    </div>
  );
}
