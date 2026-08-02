"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";

/**
 * Time-series chart (DESIGN_SYSTEM §4.4).
 *
 * A recharts wrapper restyled with the `--s-*` tokens: a brand area + line for
 * the realised series, a dashed `--s-t3` reference line for the meta, every
 * point labelled (≥ 12px), and a dark hover tooltip. Below a usable width the
 * plot keeps its size and the card scrolls horizontally instead of shrinking
 * labels — §4.4 rule 3. (recharts renders its own SVG `<text>`, so §4.4 rules 1
 * and 2 — the hand-measured viewBox and HTML labels — don't apply here.)
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
}

const defaultFormat = (n: number) => new Intl.NumberFormat("pt-BR").format(Math.round(n));

export function TimeSeriesChart({
  data,
  height = 260,
  valueName = "Realizado",
  metaName = "Meta",
  formatValue = defaultFormat,
  minPointWidth = 60,
}: TimeSeriesChartProps) {
  const hasMeta = data.some((d) => d.meta != null);
  // Below a usable width, keep the plot readable and let the card scroll.
  const minWidth = data.length * minPointWidth;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ overflowX: "auto", scrollbarWidth: "none", margin: "0 -4px", padding: "0 4px" }}>
        <div style={{ minWidth, height }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 20, right: 12, bottom: 4, left: 12 }}>
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
                content={<DarkTooltip fmt={formatValue} />}
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
}: TooltipProps<number, string> & { fmt: (n: number) => string }) {
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
    </div>
  );
}
