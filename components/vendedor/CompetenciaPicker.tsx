"use client";

import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
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

/** Prototype-style competência pill → month/year picker modal. */
export function CompetenciaPicker({ value, onChange }: { value: string; onChange: (ym: string) => void }) {
  const [open, setOpen] = useState(false);
  const [y, m] = value.split("-").map((s) => parseInt(s, 10));
  const [tempYear, setTempYear] = useState(y || new Date().getFullYear());
  const [tempMonth, setTempMonth] = useState((m || 1) - 1); // 0-based

  const label = `${MESES_LONG[(m || 1) - 1]} ${y}`;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);

        if (o) {
          setTempYear(y || new Date().getFullYear());
          setTempMonth((m || 1) - 1);
        }
      }}
    >
      <DialogTrigger asChild>
        <button className="shadow-elegant flex items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2.5 text-sm backdrop-blur transition-colors hover:border-primary/40">
          <CalendarDays className="h-4 w-4 text-primary" />
          <span className="min-w-0">
            <span className="block text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Competência
            </span>
            <span className="block font-medium text-foreground">{label}</span>
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Competência</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Ano
            </label>
            <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 p-1.5">
              <button
                onClick={() => setTempYear((v) => v - 1)}
                className="grid h-8 w-8 place-items-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Ano anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-lg font-bold text-foreground">{tempYear}</span>
              <button
                onClick={() => setTempYear((v) => v + 1)}
                className="grid h-8 w-8 place-items-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Próximo ano"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Mês
            </label>
            <div className="grid grid-cols-3 gap-2">
              {MESES.map((mes, i) => (
                <button
                  key={mes}
                  onClick={() => setTempMonth(i)}
                  className={cn(
                    "rounded-md border py-2 text-xs font-medium tracking-wider uppercase transition-colors",
                    tempMonth === i
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {mes}
                </button>
              ))}
            </div>
          </div>

          <Button
            className="w-full"
            onClick={() => {
              onChange(`${tempYear}-${String(tempMonth + 1).padStart(2, "0")}`);
              setOpen(false);
            }}
          >
            Aplicar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
