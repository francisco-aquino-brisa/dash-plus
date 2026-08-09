"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Segmented } from "@/components/ui/segmented";
import { statusColor } from "@/lib/ui/status";
import { formatNumber } from "@/lib/format";
import type { NegativeRow, NegativesByLevel, QuartileLevel } from "@/lib/data/cities/compute";

/**
 * Negativações (SCREENS §1.6). Cities (or gerências/coordenações) below the
 * growth or active-base meta, with a level segmented, an accent-insensitive
 * city search and a status badge (Ambas · Crescimento · Base ativa).
 */
const LEVELS: { value: QuartileLevel; label: string }[] = [
  { value: "gerencia", label: "Gerência" },
  { value: "coordenacao", label: "Coordenação" },
  { value: "cidade", label: "Cidade" },
];

const LEVEL_LABEL: Record<QuartileLevel, string> = {
  gerencia: "Gerência",
  coordenacao: "Coordenação",
  cidade: "Cidade",
};

const STATUS_LABEL: Record<NegativeRow["status"], string> = {
  Ambas: "Ambas",
  "Negativa Crescimento": "Crescimento",
  "Negativa Base Ativa": "Base ativa",
};

function norm(s: string): string {
  // Accent- and case-insensitive (NFD + strip combining diacritics), mirroring
  // the chip-filter search.
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function StatusBadge({ status }: { status: NegativeRow["status"] }) {
  const bad = status === "Ambas";

  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 8px",
        borderRadius: 999,
        background: bad ? "var(--s-bad-bg)" : "var(--s-warn-bg)",
        color: bad ? "var(--s-bad)" : "var(--s-warn)",
        fontSize: 10,
        fontWeight: 800,
      }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function NegativesTable({ negatives }: { negatives: NegativesByLevel }) {
  const [level, setLevel] = useState<QuartileLevel>("cidade");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const all = negatives[level];
    const q = norm(query.trim());

    return q ? all.filter((r) => norm(r.nome).includes(q)) : all;
  }, [negatives, level, query]);

  const columns: Column<NegativeRow>[] = [
    { key: "nome", header: LEVEL_LABEL[level], render: (r) => r.nome },
    { key: "ger", header: "Gerência", render: (r) => r.gerencia || "—" },
    { key: "coord", header: "Coord.", render: (r) => r.coordenacao || "—" },
    { key: "tec", header: "Tec", render: (r) => r.tecnologia },
    { key: "meta", header: "Meta", numeric: true, render: (r) => formatNumber(r.metaCrescimento) },
    { key: "res", header: "Result.", numeric: true, render: (r) => formatNumber(r.resultadoCrescimento) },
    {
      key: "atin",
      header: "Ating.",
      numeric: true,
      render: (r) => (
        <span style={{ fontWeight: 800, color: statusColor(r.atingCresc) }}>{Math.round(r.atingCresc)}%</span>
      ),
    },
    { key: "metaBa", header: "Meta BA", numeric: true, render: (r) => formatNumber(r.metaBaseAtiva) },
    { key: "resBa", header: "Result. BA", numeric: true, render: (r) => formatNumber(r.resultadoBaseAtiva) },
    {
      key: "atinBa",
      header: "Ating. BA",
      numeric: true,
      render: (r) => (
        <span style={{ fontWeight: 800, color: statusColor(r.atingBaseAtiva) }}>
          {Math.round(r.atingBaseAtiva)}%
        </span>
      ),
    },
    { key: "status", header: "Status", align: "right", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <section
      style={{
        border: "1px solid var(--s-border)",
        borderRadius: "var(--r-panel)",
        background: "var(--s-card)",
        boxShadow: "var(--s-sh)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          padding: "15px 15px 12px",
        }}
      >
        <div>
          <h3
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: 15,
              letterSpacing: "-.02em",
            }}
          >
            Negativações
          </h3>
          <div style={{ fontSize: 11.5, color: "var(--s-t3)", marginTop: 2 }}>
            {formatNumber(negatives.cidade.length)} cidades abaixo da meta de crescimento ou base ativa
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Segmented
            options={LEVELS}
            value={level}
            onChange={setLevel}
            size="sm"
            ariaLabel="Nível da tabela"
          />
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              height: 34,
              padding: "0 12px",
              border: "1px solid var(--s-border)",
              borderRadius: 999,
              background: "var(--s-sunken)",
            }}
          >
            <Search size={13} strokeWidth={2.2} style={{ color: "var(--s-t3)", flex: "none" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar cidade..."
              style={{
                border: 0,
                background: "none",
                outline: "none",
                font: "inherit",
                fontSize: 12.5,
                color: "var(--s-t1)",
                width: 130,
              }}
            />
          </label>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r, i) => `${r.nome}-${r.tecnologia}-${i}`}
        minWidth={880}
        maxHeight={440}
        empty={{ title: "Nenhuma negativação", hint: "Nenhuma entidade abaixo da meta neste recorte." }}
      />
    </section>
  );
}
