"use client";

import { useState } from "react";
import type { NegativeCityRow } from "@/lib/data/cities/compute";
import { formatNumber, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

const STATUS_STYLE: Record<NegativeCityRow["status"], string> = {
  "Negativa Crescimento": "bg-warning/15 text-warning",
  "Negativa Base Ativa": "bg-accent/15 text-accent",
  Ambas: "bg-destructive/15 text-destructive",
};

export function NegativeCitiesTable({ rows }: { rows: NegativeCityRow[] }) {
  const [q, setQ] = useState("");
  const filtered = rows.filter((r) => r.cidade.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="rounded-xl border border-border bg-card/40">
      <div className="flex items-center justify-between gap-3 border-b border-border p-4">
        <div>
          <h3 className="font-semibold">Cidades Negativas</h3>
          <p className="text-xs text-muted-foreground">
            {rows.length} cidade(s) abaixo da meta de crescimento ou base ativa
          </p>
        </div>
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar cidade…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-8 bg-secondary/60 pl-7 text-sm"
          />
        </div>
      </div>
      <div className="max-h-[440px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur">
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2 font-medium">Cidade</th>
              <th className="px-3 py-2 font-medium">Gerência</th>
              <th className="px-3 py-2 font-medium">Coord.</th>
              <th className="px-3 py-2 font-medium">Tec</th>
              <th className="px-3 py-2 text-right font-medium">Meta Cresc.</th>
              <th className="px-3 py-2 text-right font-medium">Resultado</th>
              <th className="px-3 py-2 text-right font-medium">Ating.</th>
              <th className="px-3 py-2 text-right font-medium">Meta BA</th>
              <th className="px-3 py-2 text-right font-medium">Resultado BA</th>
              <th className="px-3 py-2 text-right font-medium">Ating. BA</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={i} className="border-t border-border/40 hover:bg-secondary/40">
                <td className="px-4 py-2 font-medium">{r.cidade}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.gerencia}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.coordenacao}</td>
                <td className="px-3 py-2">{r.tecnologia}</td>
                <td className="px-3 py-2 text-right">{formatNumber(r.metaCrescimento)}</td>
                <td className={cn("px-3 py-2 text-right", r.resultadoCrescimento < 0 && "text-destructive")}>
                  {formatNumber(r.resultadoCrescimento, { signed: true })}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 text-right font-semibold",
                    r.atingCresc < 0 ? "text-destructive" : r.atingCresc < 70 ? "text-warning" : "text-foreground",
                  )}
                >
                  {formatPct(r.atingCresc, 0)}
                </td>
                <td className="px-3 py-2 text-right">{formatNumber(r.metaBaseAtiva)}</td>
                <td className="px-3 py-2 text-right">{formatNumber(r.resultadoBaseAtiva)}</td>
                <td
                  className={cn(
                    "px-3 py-2 text-right font-semibold",
                    r.atingBaseAtiva < 100 ? "text-warning" : "text-success",
                  )}
                >
                  {formatPct(r.atingBaseAtiva, 0)}
                </td>
                <td className="px-3 py-2">
                  <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", STATUS_STYLE[r.status])}>
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Nenhuma cidade negativa com os filtros atuais.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
