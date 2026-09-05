"use client";

import { useState, type CSSProperties } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowDown, ArrowUp, Minus, X } from "lucide-react";
import { TimeSeriesChart } from "@/components/ui/time-series-chart";
import { statusColor } from "@/lib/ui/status";
import { formatMonth } from "@/lib/format";
import type { IndicatorCardVM, RelatedIndicatorVM, SeriesPoint } from "@/lib/data/cities/indicator-blocks";
import type { IndicatorUnit } from "@/lib/data/cities/indicators";
import { formatIndicatorValue, fullIndicatorValue } from "./indicator-format";

/**
 * Raio-X do indicador (SCREENS §5). Opens from any KPI card: header + four stat
 * cards (Atual · Meta · Atingimento · Média 12m), a 12-month chart, and a grid
 * of related metrics that swap the chart on click.
 *
 * NOTE for Phase 3: this drill modal already exists on Performance Cidades —
 * the definitive cross-screen Raio-X should absorb/replace it, not rebuild it.
 */
function toSeries(points: SeriesPoint[], unit: IndicatorUnit, decimals: number) {
  return {
    data: points.map((p) => ({ label: formatMonth(p.mes), value: p.valor, meta: p.target ?? null })),
    format: (n: number) => formatIndicatorValue(unit, n, decimals),
  };
}

export function DrillModal({
  indicator,
  competencia,
  onClose,
}: {
  indicator: IndicatorCardVM | null;
  competencia: string;
  onClose: () => void;
}) {
  const [activeRelId, setActiveRelId] = useState<string | null>(null);
  const ind = indicator;

  return (
    <DialogPrimitive.Root open={!!ind} onOpenChange={(o) => !o && onClose()}>
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
          onCloseAutoFocus={() => setActiveRelId(null)}
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
          {ind && (
            <DrillBody
              ind={ind}
              competencia={competencia}
              activeRelId={activeRelId}
              onPickRel={setActiveRelId}
            />
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function DrillBody({
  ind,
  competencia,
  activeRelId,
  onPickRel,
}: {
  ind: IndicatorCardVM;
  competencia: string;
  activeRelId: string | null;
  onPickRel: (id: string | null) => void;
}) {
  const inverse = ind.polarity === "down";
  const activeRel = ind.related.find((r) => r.id === activeRelId) ?? null;
  const chart = activeRel
    ? toSeries(activeRel.series, activeRel.unit, activeRel.decimals)
    : toSeries(ind.series, ind.unit, ind.decimals);
  const chartLabel = activeRel ? activeRel.label : ind.label;

  const stats: { label: string; value: string; full?: string; color?: string; hint?: string }[] = [
    {
      label: "Atual",
      value: formatIndicatorValue(ind.unit, ind.value, ind.decimals),
      full: fullIndicatorValue(ind.unit, ind.value, ind.decimals) || undefined,
      hint: formatMonth(competencia),
    },
  ];

  if (ind.target !== null) {
    stats.push({
      label: "Meta",
      value: formatIndicatorValue(ind.targetUnit, ind.target, ind.decimals),
      full: fullIndicatorValue(ind.targetUnit, ind.target, ind.decimals) || undefined,
    });
    stats.push({
      label: "Atingimento",
      value: ind.attainment === null ? "—" : `${Math.round(ind.attainment)}%`,
      color: statusColor(ind.attainment, inverse),
    });
  }

  stats.push({
    label: "Média 12m",
    value: formatIndicatorValue(ind.unit, ind.average, ind.decimals),
    full: fullIndicatorValue(ind.unit, ind.average, ind.decimals) || undefined,
  });

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
              {ind.label}
            </div>
            <div style={{ fontSize: 12, color: "var(--s-t3)", marginTop: 3 }}>{ind.description}</div>
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
          Exibindo no gráfico: <span style={{ fontWeight: 700, color: "var(--s-t1)" }}>{chartLabel}</span>
        </div>
        <TimeSeriesChart
          data={chart.data}
          formatValue={chart.format}
          height={230}
          selectableRange
          unit={activeRel ? activeRel.unit : ind.unit}
        />
      </div>

      {ind.related.length > 0 && (
        <div>
          <h4
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: "-.02em",
              marginBottom: 8,
            }}
          >
            Indicadores relacionados
          </h4>
          <div
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))", gap: 10 }}
          >
            {ind.related.map((rel) => (
              <RelatedTile
                key={rel.id}
                rel={rel}
                active={rel.id === activeRelId}
                onClick={() => onPickRel(rel.id === activeRelId ? null : rel.id)}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function RelatedTile({
  rel,
  active,
  onClick,
}: {
  rel: RelatedIndicatorVM;
  active: boolean;
  onClick: () => void;
}) {
  const up = rel.delta > 0.5;
  const down = rel.delta < -0.5;
  const good = rel.polarity === "down" ? down : up;
  const TrendIcon = up ? ArrowUp : down ? ArrowDown : Minus;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        border: `1px solid ${active ? "var(--s-brand)" : "var(--s-border)"}`,
        borderRadius: 12,
        background: active ? "var(--s-brand-weak)" : "var(--s-card)",
        padding: "11px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        cursor: "pointer",
        font: "inherit",
        transition: ".16s",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: "var(--s-t2)", lineHeight: 1.25 }}>
          {rel.label}
        </span>
        <span
          style={{
            flex: "none",
            display: "flex",
            alignItems: "center",
            gap: 2,
            padding: "2px 6px",
            borderRadius: 999,
            background: good ? "var(--s-ok-bg)" : "var(--s-bad-bg)",
            color: good ? "var(--s-ok)" : "var(--s-bad)",
            fontSize: 10.5,
            fontWeight: 800,
          }}
        >
          <TrendIcon size={10} strokeWidth={3} />
          {Math.abs(rel.delta).toFixed(0)}%
        </span>
      </div>
      <span
        title={fullIndicatorValue(rel.unit, rel.value, rel.decimals) || undefined}
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: 22,
          letterSpacing: "-.02em",
          color: "var(--s-t1)",
        }}
      >
        {formatIndicatorValue(rel.unit, rel.value, rel.decimals)}
      </span>
    </button>
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
