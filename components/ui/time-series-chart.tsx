"use client";

import { useEffect, useRef, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import type { CategoricalChartState } from "recharts/types/chart/types";

/**
 * Time-series chart (DESIGN_SYSTEM §4.4).
 *
 * A recharts wrapper restyled with the `--s-*` tokens: a brand area + line for
 * the realised series, a dashed `--s-t3` reference line for the meta, every
 * point labelled (≥ 12px), and a dark hover tooltip. Below a usable width the
 * plot keeps its size and the card scrolls horizontally instead of shrinking
 * labels — §4.4 rule 3. (recharts renders its own SVG `<text>`, so §4.4 rules 1
 * and 2 — the hand-measured viewBox and HTML labels — don't apply here.)
 *
 * With `selectableRange`, dragging across the plot measures a period: the band
 * highlights and a summary shows the endpoints and their dispersion.
 */
export interface TimeSeriesPoint {
  /** X label, e.g. "Jul/26". */
  label: string;
  value: number;
  meta?: number | null;
}

export interface TimeSeriesChartProps {
  data: TimeSeriesPoint[];
  height?: number;
  valueName?: string;
  metaName?: string;
  formatValue?: (n: number) => string;
  /** Min horizontal px per point before the plot scrolls instead of shrinking. */
  minPointWidth?: number;
  /** Show each point's % dispersion vs the previous point in the tooltip. */
  showDispersion?: boolean;
  /** Enable drag-to-measure-a-period (Google-Finance style). */
  selectableRange?: boolean;
  /** Series unit — drives how the measured-period dispersion is expressed. */
  unit?: "qtd" | "percent" | "currency";
  /** When the plot overflows, open scrolled to the end (newest months first). */
  scrollToEnd?: boolean;
}

const defaultFormat = (n: number) => new Intl.NumberFormat("pt-BR").format(Math.round(n));

/** % change of a point vs its predecessor (relative). */
function relPct(cur: number, prev: number): number {
  return prev === 0 ? 0 : ((cur - prev) / Math.abs(prev)) * 100;
}

/** Signed pt-BR number (comma decimals), always showing the sign. */
function signed(n: number, digits = 1): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(digits).replace(".", ",")}`;
}

export function TimeSeriesChart({
  data,
  height = 260,
  valueName = "Realizado",
  metaName = "Meta",
  formatValue = defaultFormat,
  minPointWidth = 60,
  showDispersion = true,
  selectableRange = false,
  unit = "qtd",
  scrollToEnd = true,
}: TimeSeriesChartProps) {
  const hasMeta = data.some((d) => d.meta != null);
  // Below a usable width, keep the plot readable and let the card scroll.
  const minWidth = data.length * minPointWidth;
  // Month-over-month dispersion per label, so the tooltip can always show it
  // (recharts hands the tooltip only the active point, not its neighbour).
  const dispByLabel = new Map<string, number | null>();

  data.forEach((d, i) => dispByLabel.set(d.label, i > 0 ? relPct(d.value, data[i - 1].value) : null));

  // Drag-to-measure-a-period state.
  const [refLeft, setRefLeft] = useState<string | null>(null);
  const [refRight, setRefRight] = useState<string | null>(null);
  const [sel, setSel] = useState<{ start: string; end: string } | null>(null);
  const dragging = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset any selection when the series changes (e.g. swapping the drill metric).
  useEffect(() => {
    setSel(null);
    setRefLeft(null);
    setRefRight(null);
  }, [data]);

  // When the plot overflows (typically on mobile), open scrolled to the end so
  // the newest months are visible first instead of the oldest.
  useEffect(() => {
    const el = scrollRef.current;

    if (el && scrollToEnd) el.scrollLeft = el.scrollWidth;
  }, [data, scrollToEnd, minWidth]);

  const onDown = (e: CategoricalChartState | null) => {
    if (!selectableRange || !e?.activeLabel) return;

    dragging.current = true;
    setRefLeft(e.activeLabel);
    setRefRight(e.activeLabel);
  };

  const onMove = (e: CategoricalChartState | null) => {
    if (!dragging.current || !e?.activeLabel) return;

    setRefRight(e.activeLabel);
  };

  const onUp = () => {
    if (!dragging.current) return;

    dragging.current = false;

    if (refLeft && refRight && refLeft !== refRight) {
      const i = data.findIndex((d) => d.label === refLeft);
      const j = data.findIndex((d) => d.label === refRight);
      const [start, end] = i <= j ? [refLeft, refRight] : [refRight, refLeft];

      setSel({ start, end });
    } else {
      setSel(null); // a plain click clears the selection
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
    const i = data.findIndex((d) => d.label === sel.start);
    const j = data.findIndex((d) => d.label === sel.end);

    if (i >= 0 && j >= 0) {
      const vi = data[i].value;
      const vj = data[j].value;
      // Percent series: point-to-point difference in percentage POINTS — never
      // sum/average percentages. Others: relative %.
      const disp =
        unit === "percent" ? `${signed(vj - vi)} p.p.` : `${signed(relPct(vj, vi))}% (${signed(vj - vi, 0)})`;

      summary = {
        range: `${sel.start} → ${sel.end}`,
        endpoints: `${formatValue(vi)} → ${formatValue(vj)}`,
        disp,
        positive: vj - vi >= 0,
      };
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {selectableRange && (
        <div style={{ display: "flex", minHeight: 18, alignItems: "center", fontSize: 11.5 }}>
          {summary ? (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 700, color: "var(--s-t1)" }}>{summary.range}</span>
              <span style={{ color: "var(--s-t3)" }}>{summary.endpoints}</span>
              <span style={{ fontWeight: 800, color: summary.positive ? "var(--s-ok)" : "var(--s-bad)" }}>
                {summary.disp}
              </span>
              <button
                type="button"
                onClick={() => setSel(null)}
                style={{
                  border: 0,
                  background: "none",
                  font: "inherit",
                  fontSize: 11.5,
                  color: "var(--s-t3)",
                  cursor: "pointer",
                  textDecoration: "underline",
                  textUnderlineOffset: 2,
                }}
              >
                limpar
              </button>
            </div>
          ) : (
            <span style={{ color: "var(--s-t3)" }}>Arraste sobre o gráfico para medir um período.</span>
          )}
        </div>
      )}

      <div
        ref={scrollRef}
        style={{
          overflowX: "auto",
          scrollbarWidth: "none",
          margin: "0 -4px",
          padding: "0 4px",
          userSelect: selectableRange ? "none" : undefined,
        }}
      >
        <div style={{ minWidth, height }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 20, right: 12, bottom: 4, left: 12 }}
              onMouseDown={selectableRange ? onDown : undefined}
              onMouseMove={selectableRange ? onMove : undefined}
              onMouseUp={selectableRange ? onUp : undefined}
              onMouseLeave={selectableRange ? onUp : undefined}
            >
              <CartesianGrid vertical={false} stroke="var(--s-border)" />
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--s-t3)", fontSize: 12, fontWeight: 700 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={8}
              />
              <YAxis hide />
              <Tooltip
                cursor={{ stroke: "var(--s-brand)", strokeWidth: 1.2, strokeDasharray: "4 4" }}
                content={(props: TooltipProps<number, string>) => (
                  <DarkTooltip
                    {...props}
                    fmt={formatValue}
                    disp={showDispersion ? (dispByLabel.get(String(props.label)) ?? null) : null}
                  />
                )}
              />
              {hasMeta && (
                <Line
                  type="monotone"
                  name={metaName}
                  dataKey="meta"
                  stroke="var(--s-t3)"
                  strokeWidth={1.4}
                  strokeDasharray="5 5"
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              )}
              <Area
                type="monotone"
                name={valueName}
                dataKey="value"
                stroke="var(--s-brand)"
                strokeWidth={2.2}
                fill="var(--s-brand-weak)"
                dot={{ fill: "var(--s-card)", stroke: "var(--s-brand)", strokeWidth: 2, r: 3 }}
                activeDot={{ fill: "var(--s-brand)", stroke: "var(--s-brand)", r: 4 }}
              >
                <LabelList
                  dataKey="value"
                  position="top"
                  offset={10}
                  formatter={(v: number | string) => formatValue(Number(v))}
                  style={{ fill: "var(--s-t1)", fontSize: 12, fontWeight: 700 }}
                />
              </Area>
              {band && (
                <ReferenceArea
                  x1={band.x1}
                  x2={band.x2}
                  strokeOpacity={0.3}
                  stroke="var(--s-brand)"
                  fill="var(--s-brand)"
                  fillOpacity={0.12}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, fontSize: 11, fontWeight: 700, color: "var(--s-t3)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 14, height: 3, borderRadius: 9, background: "var(--s-brand)" }} />
          {valueName}
        </span>
        {hasMeta && (
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 14, height: 0, borderTop: "2px dashed var(--s-t3)" }} />
            {metaName}
          </span>
        )}
      </div>
    </div>
  );
}

/** Dark hover tooltip (§4.4 rule 6): `--s-t1` surface, `--s-page` text. */
function DarkTooltip({
  active,
  payload,
  label,
  fmt,
  disp,
}: TooltipProps<number, string> & { fmt: (n: number) => string; disp?: number | null }) {
  if (!active || !payload?.length) return null;

  const point = payload.find((p) => p.dataKey === "value") ?? payload[0];
  const meta = payload.find((p) => p.dataKey === "meta");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: "7px 10px",
        borderRadius: 10,
        background: "var(--s-t1)",
        boxShadow: "var(--s-sh-2)",
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--s-page)", opacity: 0.75 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 800, color: "var(--s-page)" }}>
        {fmt(Number(point.value))}
      </span>
      {meta?.value != null && (
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--s-page)", opacity: 0.6 }}>
          Meta {fmt(Number(meta.value))}
        </span>
      )}
      {disp != null && (
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--s-page)", opacity: 0.6 }}>
          Disp. mês anterior{" "}
          <span style={{ fontWeight: 800, opacity: 1, color: disp >= 0 ? "var(--s-ok)" : "var(--s-bad)" }}>
            {disp >= 0 ? "+" : ""}
            {disp.toFixed(1).replace(".", ",")}%
          </span>
        </span>
      )}
    </div>
  );
}
