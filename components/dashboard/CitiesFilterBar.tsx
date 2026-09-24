"use client";

import { ChipFilter, FilterClearButton } from "@/components/ui/chip-filter";
import { DateFilter } from "@/components/ui/date-filter";
import { MultiChipFilter } from "@/components/ui/multi-chip-filter";
import { formatMonth } from "@/lib/format";
import type { DashboardFilters, FilterOptions } from "@/lib/data/cities/types";

/**
 * Cities filter bar (DESIGN_SYSTEM "Estrutura comum" + §4.1/§4.2).
 *
 * Sticky card of 40px chips: Competência (date picker, month mode) + Gerência ·
 * Coordenação · Supervisão · Cidade (multi-selects, cascading) + Tipo cidade ·
 * Tecnologia (chip-selects) + "Limpar (n)". State lives in the URL (the page
 * recomputes the view-model server-side per filter, ADR 0002); this only emits
 * the next `DashboardFilters`.
 *
 * The estrutura chips come from the app's own city bindings (ADR 0008), so a
 * city nobody answers for yet shows up under Cidade and under no gerência.
 */
const ALL = "Todos";
const MN = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Map a DateFilter value (`Jul/26` · `14/07/2026` · `27/06 – 26/07/2026`) back
 *  to one of the dataset's ISO competências, coercing day/range to their month. */
function isoFromDateValue(value: string, meses: string[]): string | null {
  const byLabel = new Map(meses.map((iso) => [formatMonth(iso), iso]));

  if (byLabel.has(value)) return byLabel.get(value) ?? null;

  // Day (`dd/mm/yyyy`) or range (end date carries the year): derive the month.
  const m = value.match(/(\d{2})\/(\d{2})\/(\d{4})\s*$/);

  if (m) {
    const label = `${MN[Number(m[2]) - 1]}/${m[3].slice(2)}`;

    return byLabel.get(label) ?? null;
  }

  return null;
}

export function CitiesFilterBar({
  filters,
  options,
  onChange,
  onReset,
}: {
  filters: DashboardFilters;
  options: FilterOptions;
  onChange: (next: DashboardFilters) => void;
  onReset: () => void;
}) {
  const latest = options.meses[options.meses.length - 1] ?? "";
  const set = (patch: Partial<DashboardFilters>) => onChange({ ...filters, ...patch });
  // "Todos" sentinel ↔ "" (the data layer's "no filter") for the chip-selects.
  const pick = (key: "tipoCidade" | "tecnologia", v: string) => set({ [key]: v === ALL ? "" : v });

  const dirtyCount =
    (filters.competencia !== latest ? 1 : 0) +
    (filters.gerencia.length > 0 ? 1 : 0) +
    (filters.coordenacao.length > 0 ? 1 : 0) +
    (filters.supervisao.length > 0 ? 1 : 0) +
    (filters.cidade.length > 0 ? 1 : 0) +
    (filters.tipoCidade ? 1 : 0) +
    (filters.tecnologia ? 1 : 0);

  return (
    <div style={{ position: "sticky", top: 0, zIndex: 30, paddingTop: 4 }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          background: "var(--s-card)",
          border: "1px solid var(--s-border)",
          borderRadius: "var(--r-panel)",
          boxShadow: "var(--s-sh)",
        }}
      >
        <DateFilter
          label="Competência"
          value={formatMonth(filters.competencia)}
          defaultValue={formatMonth(latest)}
          onChange={(v) => {
            const iso = isoFromDateValue(v, options.meses);

            if (iso) set({ competencia: iso });
          }}
          initialMode="mes"
          modes={["mes"]}
        />
        <MultiChipFilter
          label="Gerência"
          values={filters.gerencia}
          options={options.gerencias}
          onChange={(v) => set({ gerencia: v })}
        />
        <MultiChipFilter
          label="Coordenação"
          values={filters.coordenacao}
          options={options.coordenacoes}
          onChange={(v) => set({ coordenacao: v })}
        />
        <MultiChipFilter
          label="Supervisão"
          values={filters.supervisao}
          options={options.supervisoes}
          onChange={(v) => set({ supervisao: v })}
        />
        <MultiChipFilter
          label="Cidade"
          values={filters.cidade}
          options={options.cidades}
          onChange={(v) => set({ cidade: v })}
          align="end"
          maxVisible={100}
        />
        <ChipFilter
          label="Tipo cidade"
          value={filters.tipoCidade || ALL}
          options={[ALL, ...options.tiposCidade]}
          defaultValue={ALL}
          onChange={(v) => pick("tipoCidade", v)}
        />
        <ChipFilter
          label="Tecnologia"
          value={filters.tecnologia || ALL}
          options={[ALL, ...options.tecnologias]}
          defaultValue={ALL}
          onChange={(v) => pick("tecnologia", v)}
          align="end"
        />
        {dirtyCount > 0 && <FilterClearButton count={dirtyCount} onClear={onReset} />}
      </div>
    </div>
  );
}
