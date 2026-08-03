"use client";

import { useState } from "react";
import { ChipFilter } from "@/components/ui/chip-filter";
import { TimeSeriesChart } from "@/components/ui/time-series-chart";
import { formatNumber } from "@/lib/format";
import type { FreeIndicator } from "@/lib/data/sales/types";

/**
 * Seleção Livre de Indicadores (legacy block, kept — the new_ui §2 doesn't
 * surface it, but the migration keeps parity with the old screen). Pick any
 * accessible indicator and chart its 12-month series (`desempenho_hc`). Restyled
 * over the Fase 1 `TimeSeriesChart` + `ChipFilter`. Indicators without a source
 * are omitted here (they already show as LockedKpiCards in the blocks above).
 */
export function SelecaoLivre({
  indicators,
  series,
}: {
  indicators: FreeIndicator[];
  series: Record<string, { mes: string; valor: number }[]>;
}) {
  const available = indicators.filter((i) => i.available && series[i.nome]?.length);
  const names = available.map((i) => i.nome);
  const [selected, setSelected] = useState(names[0] ?? "");
  const active = names.includes(selected) ? selected : (names[0] ?? "");
  // `mes` já vem formatado ("Mai/26") do adapter e do mock — não reformatar.
  const data = (series[active] ?? []).map((p) => ({ label: p.mes, value: p.valor }));

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
            Seleção Livre de Indicadores
          </h2>
          <div style={{ fontSize: 11.5, color: "var(--s-t3)", marginTop: 2 }}>
            Escolha um indicador para ver a série de 12 meses
          </div>
        </div>
        {names.length > 0 && (
          <ChipFilter
            label="Indicador"
            value={active}
            options={names}
            defaultValue={names[0]}
            onChange={setSelected}
            align="end"
          />
        )}
      </header>

      {names.length === 0 ? (
        <p style={{ padding: "10px 2px", fontSize: 12.5, color: "var(--s-t3)" }}>
          Nenhum indicador disponível para o escopo atual.
        </p>
      ) : (
        <TimeSeriesChart data={data} formatValue={(n) => formatNumber(n)} height={280} selectableRange />
      )}
    </section>
  );
}
