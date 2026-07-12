"use client";

import { useState } from "react";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { DiasZeradosView } from "@/lib/data/vendedor/types";

const FILTROS = ["Todos", "FTTH", "FWA", "5G", "Banda"] as const;
const SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
const MESES_LONG = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function DiasZeradosBlock({ dias }: { dias: DiasZeradosView }) {
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]>("Todos");

  const totalTodos = dias.resumo.find((r) => r.servico === "Todos")?.dias ?? 0;
  const porServico = FILTROS.filter((f) => f !== "Todos").map((f) => ({
    servico: f,
    dias: dias.resumo.find((r) => r.servico === f)?.dias ?? 0,
  }));

  const lastDay = new Date(dias.ano, dias.mes, 0).getDate();
  const firstDow = new Date(dias.ano, dias.mes - 1, 1).getDay();
  const zerados = new Set(dias.zeradosPorServico[filtro] ?? []);
  const comVenda = new Set(dias.comVendaPorServico[filtro] ?? []);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="shadow-elegant w-full rounded-2xl border border-warning/30 bg-warning/5 p-4 text-left transition-colors hover:border-warning/50">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-warning/15 text-warning">
                <AlertTriangle className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold tracking-wide text-foreground uppercase">Dias Zerados</h2>
                <p className="text-[11px] text-muted-foreground">{totalTodos} dia(s) sem venda no mês</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {porServico.map((s) => (
              <div key={s.servico} className="rounded-lg border border-border bg-card px-1 py-2 text-center">
                <div className="text-base leading-none font-bold text-foreground">{s.dias}</div>
                <div className="mt-1 truncate text-[9px] font-medium tracking-wider text-muted-foreground uppercase">
                  {s.servico}
                </div>
              </div>
            ))}
          </div>
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" /> Dias Zerados
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5">
          {FILTROS.map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={cn(
                "rounded-full border px-3 py-1 text-[10px] font-medium tracking-wider uppercase transition-colors",
                filtro === f
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground",
              )}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-4 text-center text-xs font-bold tracking-wider text-muted-foreground uppercase">
            {MESES_LONG[dias.mes - 1]} {dias.ano}
          </h3>
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {SEMANA.map((d, i) => (
              <div key={i} className="text-[10px] font-bold text-muted-foreground">
                {d}
              </div>
            ))}
            {Array.from({ length: firstDow }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {Array.from({ length: lastDay }).map((_, i) => {
              const day = i + 1;
              const isFuture = dias.hoje != null && day > dias.hoje;
              const isZerado = zerados.has(day);
              const hasVenda = comVenda.has(day);
              const isToday = dias.hoje === day;

              return (
                <div
                  key={day}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-lg text-[11px] font-medium",
                    isZerado && "bg-destructive text-destructive-foreground",
                    !isZerado && hasVenda && "bg-success/15 text-success",
                    !isZerado && !hasVenda && !isFuture && "bg-secondary/40 text-muted-foreground",
                    isFuture && "bg-secondary/20 text-muted-foreground/50",
                    isToday && "ring-2 ring-primary ring-offset-1 ring-offset-card",
                  )}
                >
                  {day}
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex justify-center gap-4 border-t border-border pt-3 text-[10px] font-medium text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-destructive" /> Zerado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-success/40" /> Com venda
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
