"use client";

import { Area, AreaChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatChartLabel, formatMonth, formatNumber } from "@/lib/format";

interface Props {
  data: { mes: string; valor: number }[];
  color?: string;
}

export function HistoryChart({ data, color = "var(--primary)" }: Props) {
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
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
            tickFormatter={(v) => formatNumber(v)}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={64}
          />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(l) => formatMonth(String(l))}
            formatter={(v: number) => [formatNumber(v), "Valor"]}
          />
          <Area type="monotone" dataKey="valor" stroke={color} strokeWidth={2} fill="url(#histGrad)">
            <LabelList
              dataKey="valor"
              position="top"
              offset={8}
              formatter={(v: number) => formatChartLabel(v)}
              style={{ fill: "var(--foreground)", fontSize: 10, fontWeight: 600 }}
            />
          </Area>
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
