"use client";

import { useEffect, useRef, useState } from "react";
import {
  Area,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CategoricalChartState } from "recharts/types/chart/types";
import type { TooltipProps } from "recharts";
import { formatChartLabel, formatMonth, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type Unit = "qtd" | "percent" | "currency";

interface Props {
  data: {
    mes: string;
    valor: number;
    target?: number | null;
    extras?: { label: string; display: string }[];
  }[];
  color?: string;
  /** Unit of the series — drives how the period dispersion is expressed. */
  unit?: Unit;
  /** Precise value formatter (tooltip + axis). Defaults to plain number. */
  valueFormatter?: (v: number) => string;
  /** Compact formatter for the on-point labels. Defaults to abbreviated number. */
  compactFormatter?: (v: number) => string;
}

/** % dispersion of a point vs the previous month (relative). */
function relPct(cur: number, prev: number): number {
  return prev === 0 ? 0 : ((cur - prev) / Math.abs(prev)) * 100;
}

/** Signed pt-BR number (comma decimals), always showing the sign. */
function signed(n: number, digits = 1): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(digits).replace(".", ",")}`;
}

/** Datum augmented with its month-over-month dispersion. */
type ChartDatum = {
  mes: string;
  valor: number;
  delta: number | null;
  target?: number | null;
  extras?: { label: string; display: string }[];
};

function ChartTooltip({
  active,
  payload,
  label,
  fmt,
}: TooltipProps<number, string> & { fmt: (v: number) => string }) {
  if (!active || !payload?.length) return null;

  const d = payload[0].payload as ChartDatum;

  return (
    <div className="shadow-elegant rounded-lg border border-border bg-card px-3 py-2 text-xs">
      <div className="mb-1 font-medium text-foreground">{formatMonth(String(label))}</div>
      <div>
        <span className="text-muted-foreground">Real: </span>
        <span className="font-semibold text-foreground">{fmt(d.valor)}</span>
      </div>
      {d.target != null && (
        <div>
          <span className="text-muted-foreground">Meta: </span>
          <span className="font-semibold text-foreground">{fmt(d.target)}</span>
        </div>
      )}
      {d.extras?.map((e) => (
        <div key={e.label}>
          <span className="text-muted-foreground">{e.label}: </span>
          <span className="font-semibold text-foreground">{e.display}</span>
        </div>
      ))}
      {d.delta !== null && (
        <div>
          <span className="text-muted-foreground">Disp. mês anterior: </span>
          <span className={cn("font-semibold", d.delta >= 0 ? "text-success" : "text-destructive")}>
            {signed(d.delta)}%
          </span>
        </div>
      )}
    </div>
  );
}

export function HistoryChart({
  data,
  color = "var(--primary)",
  unit = "qtd",
  valueFormatter = formatNumber,
  compactFormatter = formatChartLabel,
}: Props) {
  // Precompute each point's dispersion vs the previous month so the tooltip can
  // always show it (the request: hover shows current value + % vs prior month).
  const chart: ChartDatum[] = data.map((d, i) => ({
    ...d,
    delta: i > 0 ? relPct(d.valor, data[i - 1].valor) : null,
  }));
  const hasTarget = chart.some((d) => d.target != null);

  // Google-Finance-style period selection: drag over the plot to pick a range;
  // we then show the dispersion between the first and last month of the range.
  const [refLeft, setRefLeft] = useState<string | null>(null);
  const [refRight, setRefRight] = useState<string | null>(null);
  const [sel, setSel] = useState<{ start: string; end: string } | null>(null);
  const dragging = useRef(false);

  // Reset any selection when the underlying series changes (e.g. switching the
  // charted indicator inside the detail modal).
  useEffect(() => {
    setSel(null);
    setRefLeft(null);
    setRefRight(null);
  }, [data]);

  const onDown = (e: CategoricalChartState | null) => {
    if (!e?.activeLabel) return;

    dragging.current = true;
    setRefLeft(e.activeLabel);
    setRefRight(e.activeLabel);
  };

  const onMove = (e: CategoricalChartState | null) => {
    if (!dragging.current || !e?.activeLabel) return;

    setRefRight(e.activeLabel);
  };

  const onUp = () => {
    dragging.current = false;

    if (refLeft && refRight && refLeft !== refRight) {
      const i = chart.findIndex((d) => d.mes === refLeft);
      const j = chart.findIndex((d) => d.mes === refRight);
      const [start, end] = i <= j ? [refLeft, refRight] : [refRight, refLeft];

      setSel({ start, end });
    } else {
      // A plain click (no drag) clears any existing selection.
      setSel(null);
    }

    setRefLeft(null);
    setRefRight(null);
  };

  // Live band while dragging, otherwise the committed selection.
  const band =
    refLeft && refRight ? { x1: refLeft, x2: refRight } : sel ? { x1: sel.start, x2: sel.end } : null;

  // Period summary (only for a committed range).
  let summary: { range: string; endpoints: string; disp: string; positive: boolean } | null = null;

  if (sel) {
    const i = chart.findIndex((d) => d.mes === sel.start);
    const j = chart.findIndex((d) => d.mes === sel.end);

    if (i >= 0 && j >= 0) {
      const vi = chart[i].valor;
      const vj = chart[j].valor;
      const range = `${formatMonth(sel.start)} → ${formatMonth(sel.end)}`;
      const endpoints = `${valueFormatter(vi)} → ${valueFormatter(vj)}`;
      // Percent series: point-to-point difference in percentage POINTS — never
      // sum/average percentages (that has no real meaning). Others: relative %.
      const disp =
        unit === "percent" ? `${signed(vj - vi)} p.p.` : `${signed(relPct(vj, vi))}% (${signed(vj - vi, 0)})`;

      summary = { range, endpoints, disp, positive: vj - vi >= 0 };
    }
  }

  return (
    <div>
      <div className="mb-1 flex min-h-[20px] items-center justify-between text-xs">
        {summary ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-medium text-foreground">{summary.range}</span>
            <span className="text-muted-foreground">{summary.endpoints}</span>
            <span className={cn("font-semibold", summary.positive ? "text-success" : "text-destructive")}>
              {summary.disp}
            </span>
            <button
              type="button"
              onClick={() => setSel(null)}
              className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              limpar
            </button>
          </div>
        ) : (
          <span className="text-muted-foreground">Arraste sobre o gráfico para medir um período.</span>
        )}
      </div>
      <div className="h-[280px] w-full select-none">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chart}
            margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
            onMouseDown={onDown}
            onMouseMove={onMove}
            onMouseUp={onUp}
            onMouseLeave={onUp}
          >
            <defs>
              <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.5} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="mes"
              tickFormatter={formatMonth}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={(v) => compactFormatter(v)}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={64}
            />
            <Tooltip content={<ChartTooltip fmt={valueFormatter} />} />
            {hasTarget && <Legend iconType="plainline" wrapperStyle={{ fontSize: 11 }} />}
            <Area
              type="monotone"
              name="Real"
              dataKey="valor"
              stroke={color}
              strokeWidth={2}
              fill="url(#histGrad)"
            >
              {!hasTarget && (
                <LabelList
                  dataKey="valor"
                  position="top"
                  offset={8}
                  formatter={(v: number) => compactFormatter(v)}
                  style={{ fill: "var(--foreground)", fontSize: 10, fontWeight: 600 }}
                />
              )}
            </Area>
            {hasTarget && (
              <Line
                type="monotone"
                name="Meta"
                dataKey="target"
                stroke="var(--muted-foreground)"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
                connectNulls
              />
            )}
            {band && (
              <ReferenceArea
                x1={band.x1}
                x2={band.x2}
                strokeOpacity={0.3}
                stroke={color}
                fill={color}
                fillOpacity={0.12}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
