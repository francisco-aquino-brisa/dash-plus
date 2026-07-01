"use client";

import { cn } from "@/lib/utils";
import { formatNumber, formatPct } from "@/lib/format";
import type { VendedorRow } from "@/lib/data/produtividade/types";

function Pct({ value }: { value: number }) {
  const color = value >= 80 ? "text-success" : value >= 50 ? "text-warning" : "text-destructive";
  return <span className={cn("text-xs font-medium", color)}>{formatPct(value, 0)}</span>;
}

export function RankingVendedores({ rows, grupoLabel }: { rows: VendedorRow[]; grupoLabel: string }) {
  return (
    <section className="rounded-2xl border border-border bg-card/40 p-5 shadow-elegant backdrop-blur">
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">Ranking de Vendedores</h2>
        <p className="text-sm text-muted-foreground">Top 15 por vendas efetivadas no período · {grupoLabel}</p>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-2 py-2 text-left font-medium">#</th>
              <th className="px-2 py-2 text-left font-medium">Vendedor</th>
              <th className="px-2 py-2 text-right font-medium">Criadas</th>
              <th className="px-2 py-2 text-right font-medium">Efetivadas</th>
              <th className="px-2 py-2 text-right font-medium">Instaladas</th>
              <th className="px-2 py-2 text-right font-medium">Ativ. 5G</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.nome}-${i}`} className="border-b border-border/50 transition-colors hover:bg-secondary/40">
                <td className="px-2 py-2 text-muted-foreground tabular-nums">{i + 1}</td>
                <td className="px-2 py-2">
                  <div className="font-medium text-foreground">{r.nome}</div>
                  <div className="mt-0.5 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                    <span className="rounded border border-border bg-secondary/40 px-1.5 py-0.5">{r.grupo}</span>
                    <span className="rounded border border-border bg-secondary/40 px-1.5 py-0.5">{r.cidade}</span>
                  </div>
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-foreground">{formatNumber(r.criado)}</td>
                <td className="px-2 py-2 text-right tabular-nums">
                  <div className="text-foreground">{formatNumber(r.efetivado)}</div>
                  <Pct value={r.efetVsCriado} />
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  <div className="text-foreground">{formatNumber(r.instalado)}</div>
                  <Pct value={r.instVsEfet} />
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-foreground">{formatNumber(r.ativ5g)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-2 py-8 text-center text-muted-foreground">
                  Nenhum vendedor com resultado nos filtros atuais.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
