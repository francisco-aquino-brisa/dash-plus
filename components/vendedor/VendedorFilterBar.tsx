"use client";

import { VendedorSearch } from "./VendedorSearch";
import { CompetenciaPicker } from "./CompetenciaPicker";
import { VisibilityFilter, type Visibility } from "./VisibilityFilter";
import type { VendedorFilterOptions, VendedorFilters } from "@/lib/data/vendedor/types";

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
}: {
  filters: VendedorFilters;
  options: VendedorFilterOptions;
  vis: Visibility;
  onNavigate: (next: VendedorFilters) => void;
  onVisChange: (v: Visibility) => void;
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
        <VendedorSearch
          options={options.vendedores}
          value={filters.matricula}
          onSelect={(m) => onNavigate({ ...filters, matricula: m })}
        />
        <CompetenciaPicker
          value={filters.competencia}
          available={options.competencias}
          onChange={(ym) => onNavigate({ ...filters, competencia: ym })}
        />
        <div style={{ marginLeft: "auto" }}>
          <VisibilityFilter value={vis} onChange={onVisChange} />
        </div>
      </div>
    </div>
  );
}
