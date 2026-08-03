"use client";

import { DataTable, type Column } from "@/components/ui/data-table";
import { formatNumber } from "@/lib/format";
import type { VendedorRow } from "@/lib/data/produtividade/types";

/**
 * Ranking de Vendedores (SCREENS §3): top 15 by vendas efetivadas in the period,
 * grouped by coordenação (externas) or nicho (canais). Built on the Fase 1
 * DataTable (sticky header + maxHeight). The row click-through to the Vendedor
 * dashboard is deferred until that screen's URL contract settles (it's being
 * rebuilt in parallel) — see new-ui-plan §3.
 */
type RankRow = VendedorRow & { pos: number };

function convColor(v: number): string {
  return v >= 80 ? "var(--s-ok)" : v >= 50 ? "var(--s-warn)" : "var(--s-bad)";
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 7px",
        borderRadius: 999,
        border: "1px solid var(--s-border)",
        background: "var(--s-sunken)",
        fontSize: 10,
        fontWeight: 700,
        color: "var(--s-t3)",
      }}
    >
      {children}
    </span>
  );
}

function ValueWithPct({ value, pct }: { value: number; pct: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
      <span style={{ color: "var(--s-t1)" }}>{formatNumber(value)}</span>
      <span style={{ fontSize: 10.5, fontWeight: 800, color: convColor(pct) }}>{pct.toFixed(0)}%</span>
    </div>
  );
}

export function RankingVendedores({ rows, grupoLabel }: { rows: VendedorRow[]; grupoLabel: string }) {
  const ranked: RankRow[] = rows.map((r, i) => ({ ...r, pos: i + 1 }));

  const columns: Column<RankRow>[] = [
    {
      key: "pos",
      header: "#",
      render: (r) => (
        <span
          style={{
            display: "grid",
            placeItems: "center",
            width: 24,
            height: 24,
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 800,
            fontVariantNumeric: "tabular-nums",
            background: r.pos <= 3 ? "var(--s-brand-weak)" : "var(--s-sunken)",
            color: r.pos <= 3 ? "var(--s-brand)" : "var(--s-t3)",
          }}
        >
          {r.pos}
        </span>
      ),
    },
    {
      key: "nome",
      header: "Vendedor",
      render: (r) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontWeight: 700, color: "var(--s-t1)" }}>{r.nome}</span>
          <span style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            <Tag>{r.grupo}</Tag>
            <Tag>{r.cidade}</Tag>
          </span>
        </div>
      ),
    },
    { key: "criado", header: "Criadas", numeric: true, render: (r) => formatNumber(r.criado) },
    {
      key: "efetivado",
      header: "Efetivadas",
      numeric: true,
      render: (r) => <ValueWithPct value={r.efetivado} pct={r.efetVsCriado} />,
    },
    {
      key: "instalado",
      header: "Instaladas",
      numeric: true,
      render: (r) => <ValueWithPct value={r.instalado} pct={r.instVsEfet} />,
    },
    { key: "ativ5g", header: "Ativ. 5G", numeric: true, render: (r) => formatNumber(r.ativ5g) },
  ];

  return (
    <section
      style={{
        border: "1px solid var(--s-border)",
        borderRadius: "var(--r-panel)",
        background: "var(--s-card)",
        padding: 15,
        boxShadow: "var(--s-sh)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: 17,
            letterSpacing: "-.02em",
          }}
        >
          Ranking de Vendedores
        </h2>
        <div style={{ fontSize: 11.5, color: "var(--s-t3)", marginTop: 2 }}>
          Top 15 por vendas efetivadas no período · {grupoLabel}
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={ranked}
        rowKey={(r) => `${r.pos}-${r.nome}`}
        minWidth={620}
        maxHeight={520}
        empty={{
          title: "Nenhum vendedor com resultado",
          hint: "Ajuste os filtros para ver o ranking do período.",
        }}
      />
    </section>
  );
}
