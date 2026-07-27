"use client";

import { useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
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

/**
 * Prototype-style competência month/year picker modal. Two triggers:
 * - `pill` (default): the card-style pill used on the vendedor dashboard.
 * - `field`: matches the labeled `FilterSelect` controls so it lines up with the
 *   other filters in a filter bar (label above + select-like trigger).
 */
export function CompetenciaPicker({
  value,
  onChange,
  variant = "pill",
  available,
}: {
  value: string;
  onChange: (ym: string) => void;
  variant?: "pill" | "field";
  /**
   * Optional whitelist of selectable competências as `YYYY-MM`. When provided,
   * months/years without data are disabled so the caller can't emit a value that
   * would be rejected server-side (and silently fall back to the latest month).
   */
  available?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [y, m] = value.split("-").map((s) => parseInt(s, 10));
  const [tempYear, setTempYear] = useState(y || new Date().getFullYear());
  const [tempMonth, setTempMonth] = useState((m || 1) - 1); // 0-based

  const label = `${MESES_LONG[(m || 1) - 1]} ${y}`;

  // Competências may arrive as "YYYY-MM" (vendedor) or "YYYY-MM-01" (cities), so
  // match on the year-month key and emit whichever exact string the caller uses.
  const monthKey = (s: string) => s.split("-").slice(0, 2).join("-");
  const availableSet = available ? new Set(available.map(monthKey)) : null;
  const availableYears = available
    ? [...new Set(available.map((s) => parseInt(s.split("-")[0], 10)))].sort((a, b) => a - b)
    : null;
  const minYear = availableYears?.length ? availableYears[0] : null;
  const maxYear = availableYears?.length ? availableYears[availableYears.length - 1] : null;
  const ymKey = (year: number, monthIdx: number) => `${year}-${String(monthIdx + 1).padStart(2, "0")}`;
  const monthEnabled = (monthIdx: number) => !availableSet || availableSet.has(ymKey(tempYear, monthIdx));
  const selectionValid = monthEnabled(tempMonth);

  const emitValue = (year: number, monthIdx: number) => {
    const key = ymKey(year, monthIdx);

    if (available) return available.find((s) => monthKey(s) === key) ?? key;

    // No whitelist: preserve the incoming value's shape (e.g. keep a "-01" day).
    return value.split("-").length >= 3 ? `${key}-01` : key;
  };

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
        {variant === "field" ? (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Competência
            </label>
            <button
              aria-label="Competência"
              className="flex h-9 min-w-[140px] cursor-pointer items-center justify-between gap-2 rounded-md border border-input bg-secondary/60 px-3 py-2 text-sm whitespace-nowrap shadow-sm ring-offset-background focus:ring-1 focus:ring-ring focus:outline-none"
            >
              <span className="line-clamp-1 text-left">{label}</span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
            </button>
          </div>
        ) : (
          <button className="shadow-elegant flex items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2.5 text-sm backdrop-blur transition-colors hover:border-primary/40">
            <CalendarDays className="h-4 w-4 text-primary" />
            <span className="min-w-0">
              <span className="block text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                Competência
              </span>
              <span className="block font-medium text-foreground">{label}</span>
            </span>
          </button>
        )}
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
                disabled={minYear != null && tempYear <= minYear}
                className="grid h-8 w-8 place-items-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-muted-foreground"
                aria-label="Ano anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-lg font-bold text-foreground">{tempYear}</span>
              <button
                onClick={() => setTempYear((v) => v + 1)}
                disabled={maxYear != null && tempYear >= maxYear}
                className="grid h-8 w-8 place-items-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-muted-foreground"
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
              {MESES.map((mes, i) => {
                const enabled = monthEnabled(i);

                return (
                  <button
                    key={mes}
                    onClick={() => setTempMonth(i)}
                    disabled={!enabled}
                    className={cn(
                      "rounded-md border py-2 text-xs font-medium tracking-wider uppercase transition-colors",
                      tempMonth === i
                        ? "border-primary/40 bg-primary/15 text-primary"
                        : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground",
                      !enabled && "cursor-not-allowed opacity-40 hover:text-muted-foreground",
                    )}
                  >
                    {mes}
                  </button>
                );
              })}
            </div>
          </div>

          <Button
            className="w-full"
            disabled={!selectionValid}
            onClick={() => {
              onChange(emitValue(tempYear, tempMonth));
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
