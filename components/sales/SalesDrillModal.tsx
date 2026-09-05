"use client";

import type { CSSProperties } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { TimeSeriesChart } from "@/components/ui/time-series-chart";
import { statusColor } from "@/lib/ui/status";
import { formatMonth } from "@/lib/format";
import type { SalesIndicatorVM } from "@/lib/data/sales/indicators";
import { formatSalesValue, fullSalesValue } from "./sales-format";

/**
 * Raio-X do indicador for Vendas · Canais (SCREENS §5 pattern). Opens from any
 * available KPI card: header + stat cards (Atual · Meta · Atingimento · Média
 * 12m) over a 12-month Real×Meta chart. Follows the cities `DrillModal` shell
 * (restyled with `--s-*`), but the sales VM has no related indicators, so the
 * related grid is omitted. Phase 3 unifies the two into one Raio-X.
 */
export function SalesDrillModal({
  indicator,
  competencia,
  onClose,
}: {
  indicator: SalesIndicatorVM | null;
  competencia: string;
  onClose: () => void;
}) {
  return (
    <DialogPrimitive.Root open={!!indicator} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgba(15,15,26,.45)",
            backdropFilter: "blur(3px)",
            animation: "bdFade .2s ease both",
          }}
        />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          style={{
            position: "fixed",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 81,
            width: "calc(100vw - 32px)",
            maxWidth: 720,
            maxHeight: "calc(100% - 48px)",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            padding: 18,
            background: "var(--s-card)",
            border: "1px solid var(--s-border)",
            borderRadius: "var(--r-modal)",
            boxShadow: "var(--s-sh-2)",
            animation: "bdModalIn .18s ease both",
          }}
        >
          {indicator && <DrillBody vm={indicator} competencia={competencia} />}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function DrillBody({ vm, competencia }: { vm: SalesIndicatorVM; competencia: string }) {
  const inverse = vm.polarity === "down";
  const values = vm.series.map((s) => s.valor);
  const media = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const fmt = (n: number) => formatSalesValue(vm.unit, n, vm.decimals);
  const full = (n: number) => fullSalesValue(vm.unit, n, vm.decimals) || undefined;

  const stats: { label: string; value: string; full?: string; color?: string; hint?: string }[] = [
    { label: "Atual", value: fmt(vm.value), full: full(vm.value), hint: formatMonth(competencia) },
  ];

  if (vm.meta !== null) {
    stats.push({ label: "Meta", value: fmt(vm.meta), full: full(vm.meta) });
    stats.push({
      label: "Atingimento",
      value: vm.attainment === null ? "—" : `${Math.round(vm.attainment)}%`,
      color: statusColor(vm.attainment, inverse),
    });
  }

  stats.push({ label: "Média 12m", value: fmt(media), full: full(media) });

  const data = vm.series.map((p) => ({ label: formatMonth(p.mes), value: p.valor, meta: p.target ?? null }));

  return (
    <>
      <DialogPrimitive.Title asChild>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: ".11em",
                textTransform: "uppercase",
                color: "var(--s-brand)",
              }}
            >
              Raio-X do indicador
            </div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                fontSize: 22,
                letterSpacing: "-.02em",
                color: "var(--s-t1)",
                marginTop: 2,
              }}
            >
              {vm.label}
            </div>
            <div style={{ fontSize: 12, color: "var(--s-t3)", marginTop: 3 }}>{vm.description}</div>
          </div>
          <DialogPrimitive.Close aria-label="Fechar" style={closeBtnStyle}>
            <X size={15} />
          </DialogPrimitive.Close>
        </div>
      </DialogPrimitive.Title>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
        {stats.map((s) => (
          <div
            key={s.label}
            style={{
              border: "1px solid var(--s-border)",
              borderRadius: 12,
              background: "var(--s-sunken)",
              padding: "11px 12px",
              display: "flex",
              flexDirection: "column",
              gap: 3,
            }}
          >
            <span style={eyebrowStyle}>{s.label}</span>
            <span
              title={s.full || undefined}
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                fontSize: 20,
                letterSpacing: "-.02em",
                color: s.color ?? "var(--s-t1)",
              }}
            >
              {s.value}
            </span>
            {s.hint && <span style={{ fontSize: 11, color: "var(--s-t3)" }}>{s.hint}</span>}
          </div>
        ))}
      </div>

      <div>
        <div style={{ fontSize: 12, color: "var(--s-t3)", marginBottom: 6 }}>
          Evolução mensal (Real{vm.meta !== null ? " × Meta" : ""}) no escopo filtrado.
        </div>
        <TimeSeriesChart data={data} formatValue={fmt} height={230} selectableRange unit={vm.unit} />
      </div>
    </>
  );
}

const eyebrowStyle: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 700,
  letterSpacing: ".09em",
  textTransform: "uppercase",
  color: "var(--s-t3)",
};

const closeBtnStyle: CSSProperties = {
  flex: "none",
  display: "grid",
  placeItems: "center",
  width: 34,
  height: 34,
  borderRadius: 999,
  border: "1px solid var(--s-border)",
  background: "var(--s-sunken)",
  color: "var(--s-t2)",
  cursor: "pointer",
};
