"use client";

import { VendedorSearch } from "./VendedorSearch";
import { VisibilityFilter, type Visibility } from "./VisibilityFilter";
import { DateFilter } from "@/components/ui/date-filter";
import { formatMonth } from "@/lib/format";
import type { VendedorFilterOptions, VendedorFilters } from "@/lib/data/vendedor/types";

/** Map a DateFilter month value (`Ago/26`) back to the vendedor competência
 *  (`yyyy-MM`). Months without data map to null → the caller no-ops. */
function ymFromDateValue(value: string, competencias: string[]): string | null {
  const byLabel = new Map(competencias.map((ym) => [formatMonth(ym), ym]));

  return byLabel.get(value) ?? null;
}

/**
 * Dashboard Vendedor filter bar (DESIGN_SYSTEM "Estrutura comum"). A sticky card
 * holding the legacy controls (kept per the user's decision): Vendedor (search)
 * · Competência (date picker) · Exibir (VisibilityFilter). State lives in the URL
 * for Vendedor/Competência (the page recomputes the VM per filter); the section
 * visibility is client-only.
 */
export function VendedorFilterBar({
  filters,
  options,
  vis,
  onNavigate,
  onVisChange,
  lockedToSelf = false,
}: {
  filters: VendedorFilters;
  options: VendedorFilterOptions;
  vis: Visibility;
  onNavigate: (next: VendedorFilters) => void;
  onVisChange: (v: Visibility) => void;
  /** A "vendedor" user is locked to their own data — hide the vendedor selector. */
  lockedToSelf?: boolean;
}) {
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
        {!lockedToSelf && (
          <VendedorSearch
            options={options.vendedores}
            value={filters.matricula}
            onSelect={(m) => onNavigate({ ...filters, matricula: m })}
          />
        )}
        <DateFilter
          label="Competência"
          value={formatMonth(filters.competencia)}
          defaultValue={formatMonth(options.competencias[0] ?? filters.competencia)}
          onChange={(v) => {
            const ym = ymFromDateValue(v, options.competencias);

            if (ym) onNavigate({ ...filters, competencia: ym });
          }}
          initialMode="mes"
          modes={["mes"]}
        />
        <div style={{ marginLeft: "auto" }}>
          <VisibilityFilter value={vis} onChange={onVisChange} />
        </div>
      </div>
    </div>
  );
}
