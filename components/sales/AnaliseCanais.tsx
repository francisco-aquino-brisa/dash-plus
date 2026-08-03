"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Segmented } from "@/components/ui/segmented";
import { formatNumber } from "@/lib/format";
import type { CanalDelta, SalesView } from "@/lib/data/sales/types";

/**
 * Análise por Canal / Nicho (legacy block, kept — the new_ui §2 doesn't surface
 * it, but the migration keeps parity with the old screen). A segmented switches
 * the dimension; two DataTables (Banda Larga + 5G) show média/dia and the
 * variation vs the previous month/week, anchored on the latest attributed month
 * (see databricks.ts). Restyled with the Fase 1 primitives + `--s-*` tokens.
 */
type Dim = "canal" | "nicho";

const DIMS: { value: Dim; label: string }[] = [
  { value: "canal", label: "Canal" },
  { value: "nicho", label: "Nicho" },
];

function Delta({ v }: { v: number }) {
  const up = v > 0.05;
  const down = v < -0.05;
  const good = up; // more sales momentum is good on both dimensions
  const Icon = up ? ArrowUp : down ? ArrowDown : Minus;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 3,
        fontVariantNumeric: "tabular-nums",
        fontWeight: 800,
        color: up || down ? (good ? "var(--s-ok)" : "var(--s-bad)") : "var(--s-t3)",
      }}
    >
      <Icon size={11} strokeWidth={3} />
      {Math.abs(v).toFixed(1).replace(".", ",")}%
    </span>
  );
}

function CanalTable({ rows, dimLabel }: { rows: CanalDelta[]; dimLabel: string }) {
  const columns: Column<CanalDelta>[] = [
    {
      key: "dim",
      header: dimLabel,
      render: (r) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={{ fontWeight: 700, color: "var(--s-t1)" }}>{r.canal}</span>
          <span style={{ fontSize: 11, color: "var(--s-t3)" }}>{r.gerente}</span>
        </div>
      ),
    },
    { key: "media", header: "Média/dia", numeric: true, render: (r) => formatNumber(r.mediaDia) },
    { key: "mes", header: "vs mês", numeric: true, render: (r) => <Delta v={r.vsMesAnterior} /> },
    { key: "sem", header: "vs semana", numeric: true, render: (r) => <Delta v={r.vsSemanaAnterior} /> },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r, i) => `${r.canal}-${i}`}
      minWidth={360}
      maxHeight={360}
      empty={{ title: "Sem movimento no período", hint: "Ajuste os filtros para ver canais." }}
    />
  );
}

export function AnaliseCanais({ canais }: { canais: SalesView["canais"] }) {
  const [dim, setDim] = useState<Dim>("canal");
  const data = canais[dim];
  const dimLabel = dim === "canal" ? "Canal" : "Nicho";

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
      <header
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
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
            Análise por {dimLabel}
          </h2>
          <div style={{ fontSize: 11.5, color: "var(--s-t3)", marginTop: 2 }}>
            Média por dia útil e variação vs mês/semana anterior
          </div>
        </div>
        <Segmented options={DIMS} value={dim} onChange={setDim} size="sm" ariaLabel="Dimensão da análise" />
      </header>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <TableCard title="Banda Larga">
          <CanalTable rows={data.bl} dimLabel={dimLabel} />
        </TableCard>
        <TableCard title="5G">
          <CanalTable rows={data.g5} dimLabel={dimLabel} />
        </TableCard>
      </div>
    </section>
  );
}

function TableCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid var(--s-border)",
        borderRadius: 14,
        background: "var(--s-card)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "10px 12px",
          borderBottom: "1px solid var(--s-border)",
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: 13,
          color: "var(--s-t1)",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}
