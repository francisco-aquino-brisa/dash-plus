"use client";

import {
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { InfoHint } from "@/components/ui/info-hint";
import { formatChartLabel } from "@/lib/format";
import { getIndicatorDef } from "@/lib/indicators/definitions";
import type { PduPoint } from "@/lib/data/sales/types";

export function PduBlock({ pdu }: { pdu: PduPoint[] }) {
  const def = getIndicatorDef("PDU");

  return (
    <section className="shadow-elegant rounded-2xl border border-border bg-card/40 p-5 backdrop-blur">
      <header className="mb-4">
        <h2 className="flex items-center gap-1.5 text-lg font-semibold text-foreground">
          PDU · Produtividade por Dia Útil {def && <InfoHint def={def} />}
        </h2>
        <p className="text-sm text-muted-foreground">
          Produção realizada / HC ativo / dia útil, por tecnologia
        </p>
      </header>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={pdu} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="mes"
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Line type="monotone" dataKey="FTTH" stroke="var(--chart-1)" strokeWidth={2} dot={false}>
              <LabelList
                dataKey="FTTH"
                position="top"
                offset={8}
                formatter={(v: number) => formatChartLabel(v)}
                style={{ fill: "var(--chart-1)", fontSize: 10, fontWeight: 600 }}
              />
            </Line>
            <Line type="monotone" dataKey="FWA" stroke="var(--chart-2)" strokeWidth={2} dot={false}>
              <LabelList
                dataKey="FWA"
                position="bottom"
                offset={8}
                formatter={(v: number) => formatChartLabel(v)}
                style={{ fill: "var(--chart-2)", fontSize: 10, fontWeight: 600 }}
              />
            </Line>
            <Line type="monotone" dataKey="5G" stroke="var(--chart-3)" strokeWidth={2} dot={false}>
              <LabelList
                dataKey="5G"
                position="top"
                offset={8}
                formatter={(v: number) => formatChartLabel(v)}
                style={{ fill: "var(--chart-3)", fontSize: 10, fontWeight: 600 }}
              />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <Legend color="var(--chart-1)" label="FTTH" />
        <Legend color="var(--chart-2)" label="FWA" />
        <Legend color="var(--chart-3)" label="5G" />
      </div>
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} /> {label}
    </span>
  );
}
