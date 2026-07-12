"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import type { CanalDelta, SalesView } from "@/lib/data/sales/types";

function Delta({ v }: { v: number }) {
  const up = v >= 0;

  return (
    <span
      className={cn(
        "flex items-center justify-end gap-0.5 tabular-nums",
        up ? "text-success" : "text-destructive",
      )}
    >
      {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {Math.abs(v).toFixed(1).replace(".", ",")}%
    </span>
  );
}

function CanalList({ title, rows, dimLabel }: { title: string; rows: CanalDelta[]; dimLabel: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/40">
      <div className="border-b border-border px-4 py-2 text-sm font-semibold">{title}</div>
      <div className="max-h-[360px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur">
            <tr className="text-left text-[11px] tracking-wider text-muted-foreground uppercase">
              <th className="px-4 py-2 font-medium">{dimLabel}</th>
              <th className="px-3 py-2 text-right font-medium">Média/dia</th>
              <th className="px-3 py-2 text-right font-medium">vs mês</th>
              <th className="px-3 py-2 text-right font-medium">vs semana</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.canal}-${i}`} className="border-t border-border/40 hover:bg-secondary/40">
                <td className="px-4 py-2">
                  <div className="font-medium">{r.canal}</div>
                  <div className="text-[11px] text-muted-foreground">{r.gerente}</div>
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">
                  {formatNumber(r.mediaDia)}
                </td>
                <td className="px-3 py-2 text-right">
                  <Delta v={r.vsMesAnterior} />
                </td>
                <td className="px-3 py-2 text-right">
                  <Delta v={r.vsSemanaAnterior} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AnaliseCanais({ canais }: { canais: SalesView["canais"] }) {
  const [dim, setDim] = useState<"canal" | "nicho">("canal");
  const data = canais[dim];
  const dimLabel = dim === "canal" ? "Canal" : "Nicho";

  return (
    <section className="shadow-elegant rounded-2xl border border-border bg-card/40 p-5 backdrop-blur">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Análise por {dimLabel}</h2>
          <p className="text-sm text-muted-foreground">
            Média por dia útil e variação vs mês/semana anterior
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-secondary/40 p-0.5">
          {(["canal", "nicho"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDim(d)}
              className={cn(
                "cursor-pointer rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors",
                dim === d
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {d}
            </button>
          ))}
        </div>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        <CanalList title="Banda Larga" rows={data.bl} dimLabel={dimLabel} />
        <CanalList title="5G" rows={data.g5} dimLabel={dimLabel} />
      </div>
    </section>
  );
}
