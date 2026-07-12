"use client";

import { useState } from "react";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { CalendarIcon, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { FilterSelect } from "@/components/ui/filter-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDateRange, fromIso, toIso } from "@/lib/date";
import { cn } from "@/lib/utils";
import { MANAGEMENT_MODES, type ProdFilters, type ProdFilterOptions } from "@/lib/data/produtividade/types";

function formatRange(from?: string, to?: string): string {
  const a = fromIso(from);

  if (!a) return "Selecionar período";

  return formatDateRange(a, fromIso(to));
}

export function ProdFiltersBar({
  filters,
  options,
  onChange,
  onReset,
}: {
  filters: ProdFilters;
  options: ProdFilterOptions;
  onChange: (f: ProdFilters) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>({
    from: fromIso(filters.from),
    to: fromIso(filters.to),
  });

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card/60 p-3 backdrop-blur">
      {/* Period range + management mode */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
          Período
        </span>
        <Popover
          open={open}
          onOpenChange={(o) => {
            setOpen(o);

            if (o) setDraft({ from: fromIso(filters.from), to: fromIso(filters.to) });
          }}
        >
          <PopoverTrigger asChild>
            <button className="flex cursor-pointer items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-primary/15">
              <CalendarIcon className="h-3.5 w-3.5 text-primary" />
              {formatRange(filters.from, filters.to)}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
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
                {draft?.from && draft?.to
                  ? formatRange(toIso(draft.from), toIso(draft.to))
                  : "Selecione a data inicial e a final"}
              </span>
              <Button
                size="sm"
                className="h-7 text-xs"
                disabled={!draft?.from || !draft?.to}
                onClick={() => {
                  if (!draft?.from || !draft?.to) return;

                  const [lo, hi] = draft.from <= draft.to ? [draft.from, draft.to] : [draft.to, draft.from];

                  onChange({ ...filters, from: toIso(lo)!, to: toIso(hi)! });
                  setOpen(false);
                }}
              >
                Aplicar
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <span className="ml-2 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
          Gestão
        </span>
        {MANAGEMENT_MODES.map((m) => (
          <button
            key={m.key}
            onClick={() =>
              onChange({ ...filters, mode: m.key, gerencia: "", coordenacao: "", gerente: "", nicho: "" })
            }
            className={cn(
              "cursor-pointer rounded-md border px-2.5 py-1 text-xs transition-colors",
              filters.mode === m.key
                ? "border-primary/40 bg-primary/15 font-medium text-primary"
                : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Mode-aware dimension filters */}
      <div className="flex flex-wrap items-end gap-3">
        <FilterSelect
          label="Serviço"
          value={filters.servico}
          options={options.servicos}
          onChange={(v) => onChange({ ...filters, servico: v })}
          triggerClassName="min-w-[140px]"
        />
        {filters.mode === "externas" ? (
          <>
            <FilterSelect
              label="Gerência"
              value={filters.gerencia}
              options={options.gerencias}
              onChange={(v) => onChange({ ...filters, gerencia: v })}
              triggerClassName="min-w-[140px]"
            />
            <FilterSelect
              label="Coordenação"
              value={filters.coordenacao}
              options={options.coordenacoes}
              onChange={(v) => onChange({ ...filters, coordenacao: v })}
              triggerClassName="min-w-[140px]"
            />
          </>
        ) : (
          <>
            <FilterSelect
              label="Gerente"
              value={filters.gerente}
              options={options.gerentes}
              onChange={(v) => onChange({ ...filters, gerente: v })}
              triggerClassName="min-w-[140px]"
            />
            <FilterSelect
              label="Nicho"
              value={filters.nicho}
              options={options.nichos}
              onChange={(v) => onChange({ ...filters, nicho: v })}
              triggerClassName="min-w-[140px]"
            />
          </>
        )}
        <FilterSelect
          label="Cidade"
          value={filters.cidade}
          options={options.cidades}
          onChange={(v) => onChange({ ...filters, cidade: v })}
          triggerClassName="min-w-[140px]"
        />
        <Button variant="ghost" size="sm" onClick={onReset} className="ml-auto gap-2">
          <RotateCcw className="h-3.5 w-3.5" /> Limpar
        </Button>
      </div>
    </div>
  );
}
