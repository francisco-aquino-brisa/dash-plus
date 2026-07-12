"use client";

import { useEffect, useState } from "react";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { CalendarIcon, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { FilterSelect } from "@/components/ui/filter-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDateRange, fromIso, toIso } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { SalesFilters, SalesFilterOptions } from "@/lib/data/sales/types";

function getDefaultRange(): DateRange {
  const today = new Date();

  return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: today };
}

function formatRange(range: DateRange | undefined): string {
  if (!range?.from) return "Personalizado";

  return formatDateRange(range.from, range.to);
}

export function SalesFiltersBar({
  filters,
  options,
  onChange,
  onReset,
}: {
  filters: SalesFilters;
  options: SalesFilterOptions;
  onChange: (f: SalesFilters) => void;
  onReset: () => void;
}) {
  const custom = filters.period === "custom";

  // Local draft so the calendar shows the in-progress selection; only commit
  // (navigate) once both ends are picked.
  const currentRange: DateRange | undefined = filters.from
    ? { from: fromIso(filters.from), to: fromIso(filters.to) }
    : undefined;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(currentRange);

  useEffect(() => {
    setDraft(filters.from ? { from: fromIso(filters.from), to: fromIso(filters.to) } : undefined);
  }, [filters.from, filters.to, filters.period]);

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card/60 p-3 backdrop-blur">
      {/* Period presets + styled custom-range calendar */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
          Período
        </span>
        {options.periods.map((p) => (
          <button
            key={p.key}
            onClick={() => onChange({ ...filters, period: p.key, from: undefined, to: undefined })}
            className={cn(
              "cursor-pointer rounded-md border px-2.5 py-1 text-xs transition-colors",
              filters.period === p.key
                ? "border-primary/40 bg-primary/15 font-medium text-primary"
                : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground",
            )}
          >
            {p.label}
          </button>
        ))}

        <Popover
          open={open}
          onOpenChange={(o) => {
            setOpen(o);

            if (o) setDraft(currentRange); // reopen shows the committed range; discard unapplied drafts
          }}
        >
          <PopoverTrigger asChild>
            <button
              className={cn(
                "ml-1 flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors",
                custom
                  ? "border-primary/40 bg-primary/10 font-medium text-foreground"
                  : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground",
              )}
              title="Buscar por período (intervalo livre)"
            >
              <CalendarIcon className="h-3.5 w-3.5 text-primary" />
              {custom && (
                <span className="text-[10px] tracking-wide text-muted-foreground uppercase">Período:</span>
              )}
              {custom ? formatRange(currentRange) : "Personalizado"}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            {/* Selecting only updates a local draft — no fetch until "Aplicar". */}
            <Calendar
              mode="range"
              selected={draft}
              onSelect={setDraft}
              numberOfMonths={2}
              defaultMonth={draft?.from ?? new Date()}
              locale={ptBR}
              autoFocus
              className="p-3"
            />
            <div className="flex items-center justify-between gap-2 border-t border-border p-2">
              <span className="px-1 text-[11px] text-muted-foreground">
                {draft?.from && draft?.to ? formatRange(draft) : "Selecione a data inicial e a final"}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setDraft(getDefaultRange())}
                >
                  Mês atual
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  disabled={!draft?.from || !draft?.to}
                  onClick={() => {
                    if (!draft?.from || !draft?.to) return;

                    // Enforce início ≤ fim before fetching.
                    const [lo, hi] = draft.from <= draft.to ? [draft.from, draft.to] : [draft.to, draft.from];

                    onChange({ ...filters, period: "custom", from: toIso(lo), to: toIso(hi) });
                    setOpen(false);
                  }}
                >
                  Aplicar
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Dimension filters */}
      <div className="flex flex-wrap items-end gap-3">
        <FilterSelect
          label="Serviço"
          value={filters.servico}
          options={options.servicos}
          onChange={(v) => onChange({ ...filters, servico: v })}
        />
        <FilterSelect
          label="Gerente"
          value={filters.gerente}
          options={options.gerentes}
          onChange={(v) => onChange({ ...filters, gerente: v })}
        />
        <FilterSelect
          label="Canal"
          value={filters.canal}
          options={options.canais}
          onChange={(v) => onChange({ ...filters, canal: v })}
        />
        <FilterSelect
          label="Nicho"
          value={filters.nicho}
          options={options.nichos}
          onChange={(v) => onChange({ ...filters, nicho: v })}
        />
        <FilterSelect
          label="UF"
          value={filters.uf}
          options={options.ufs}
          onChange={(v) => {
            // Narrow Cidade to the chosen UF; drop a city that doesn't belong to it.
            const allowed = v ? (options.cidadesByUf[v] ?? []) : null;
            const keepCidade = !filters.cidade || !allowed || allowed.includes(filters.cidade);

            onChange({ ...filters, uf: v, cidade: keepCidade ? filters.cidade : "" });
          }}
        />
        <FilterSelect
          label="Cidade"
          value={filters.cidade}
          options={filters.uf ? (options.cidadesByUf[filters.uf] ?? []) : options.cidades}
          onChange={(v) => onChange({ ...filters, cidade: v })}
        />
        <FilterSelect
          label="Tipo Cidade"
          value={filters.tipo}
          options={options.tipos}
          onChange={(v) => onChange({ ...filters, tipo: v })}
        />
        <Button variant="ghost" size="sm" onClick={onReset} className="ml-auto gap-2">
          <RotateCcw className="h-3.5 w-3.5" /> Limpar
        </Button>
      </div>
    </div>
  );
}
