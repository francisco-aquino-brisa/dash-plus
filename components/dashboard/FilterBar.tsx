"use client";

import { formatMonth } from "@/lib/format";
import type { Filters, FilterOptions } from "@/lib/data/cities/types";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/ui/filter-select";
import { RotateCcw } from "lucide-react";

interface Props {
  filters: Filters;
  options: FilterOptions;
  onChange: (f: Filters) => void;
  onReset: () => void;
}

export function FilterBar({ filters, options, onChange, onReset }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card/60 p-3 backdrop-blur">
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
          Competência
        </label>
        <Combobox
          value={filters.competencia}
          onChange={(v) => onChange({ ...filters, competencia: v })}
          options={[...options.meses].reverse().map((m) => ({ value: m, label: formatMonth(m) }))}
          aria-label="Competência"
          searchPlaceholder="Buscar competência…"
          triggerClassName="min-w-[140px] bg-secondary/60"
        />
      </div>
      <FilterSelect
        label="Gerência"
        value={filters.gerencia}
        options={options.gerencias}
        onChange={(v) => onChange({ ...filters, gerencia: v, coordenacao: "" })}
        triggerClassName="min-w-[140px]"
      />
      <FilterSelect
        label="Coordenação"
        value={filters.coordenacao}
        options={options.coordenacoes}
        onChange={(v) => onChange({ ...filters, coordenacao: v })}
        triggerClassName="min-w-[140px]"
      />
      <FilterSelect
        label="Tipo Cidade"
        value={filters.tipoCidade}
        options={options.tiposCidade}
        onChange={(v) => onChange({ ...filters, tipoCidade: v })}
        triggerClassName="min-w-[140px]"
      />
      <FilterSelect
        label="Cidade"
        value={filters.cidade}
        options={options.cidades}
        onChange={(v) => onChange({ ...filters, cidade: v })}
        triggerClassName="min-w-[140px]"
      />
      <FilterSelect
        label="Tecnologia"
        value={filters.tecnologia}
        options={options.tecnologias}
        onChange={(v) => onChange({ ...filters, tecnologia: v })}
        triggerClassName="min-w-[140px]"
      />
      <Button variant="ghost" size="sm" onClick={onReset} className="ml-auto gap-2">
        <RotateCcw className="h-3.5 w-3.5" /> Limpar
      </Button>
    </div>
  );
}
