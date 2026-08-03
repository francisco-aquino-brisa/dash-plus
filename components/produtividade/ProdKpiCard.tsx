"use client";

import {
  ChevronDown,
  ChevronUp,
  DollarSign,
  Flame,
  Lock,
  Minus,
  Radio,
  Rocket,
  ShoppingCart,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { isTrendGood } from "@/lib/ui/status";
import { formatNumber, formatPct } from "@/lib/format";
import type { KpiBlock } from "@/lib/data/produtividade/types";

/**
 * Simple funnel card for Produtividade (SCREENS §3). Unlike the cities/sales
 * KpiCard, these indicators have no meta and no 12-month series — só value +
 * trend + a helper line — so this card omits the sparkline / Meta·Projeção·Ating.
 * footer / attainment bar (decision 2026-08-02). Blocked indicators (no source)
 * render the dashed "sem acesso" variant, never a fake 0.
 */
const ICON_BY_LABEL: { test: RegExp; icon: LucideIcon }[] = [
  { test: /criadas/i, icon: ShoppingCart },
  { test: /efetivadas/i, icon: CheckCircle2 },
  { test: /instaladas/i, icon: Rocket },
  { test: /5g/i, icon: Radio },
  { test: /ticket/i, icon: DollarSign },
  { test: /churn/i, icon: Flame },
];

function iconFor(label: string): LucideIcon {
  return ICON_BY_LABEL.find((m) => m.test.test(label))?.icon ?? ShoppingCart;
}

function formatValue(k: KpiBlock): string {
  if (k.unit === "currency") return `R$ ${k.value.toFixed(2).replace(".", ",")}`;

  if (k.unit === "percent") return formatPct(k.value, 1);

  return formatNumber(k.value);
}

export function ProdKpiCard({ kpi }: { kpi: KpiBlock }) {
  const Icon = iconFor(kpi.label);

  if (!kpi.available) {
    return (
      <div
        style={{
          border: "1px dashed var(--s-border-2)",
          borderRadius: 14,
          background: "transparent",
          padding: 13,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span
            style={{
              flex: "none",
              display: "grid",
              placeItems: "center",
              width: 28,
              height: 28,
              borderRadius: 9,
              background: "var(--s-sunken)",
              color: "var(--s-t3)",
            }}
          >
            <Lock size={14} />
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--s-t3)", lineHeight: 1.25 }}>
            {kpi.label}
          </span>
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--s-t2)" }}>Sem acesso aos dados</div>
        <div style={{ fontSize: 11, color: "var(--s-t3)", lineHeight: 1.4 }}>
          Aguardando liberação do time de dados.
        </div>
      </div>
    );
  }

  const inverse = /churn/i.test(kpi.label);
  const good = isTrendGood(kpi.delta, inverse);
  const TrendIcon = kpi.delta === 0 ? Minus : kpi.delta > 0 ? ChevronUp : ChevronDown;

  return (
    <div
      style={{
        border: "1px solid var(--s-border)",
        borderRadius: 14,
        background: "var(--s-card)",
        padding: "13px 13px 12px",
        boxShadow: "var(--s-sh)",
        display: "flex",
        flexDirection: "column",
        gap: 9,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
        <span
          style={{
            flex: "none",
            display: "grid",
            placeItems: "center",
            width: 28,
            height: 28,
            borderRadius: 9,
            background: "var(--s-brand-weak)",
            color: "var(--s-brand)",
          }}
        >
          <Icon size={15} />
        </span>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 12,
            fontWeight: 700,
            color: "var(--s-t2)",
            lineHeight: 1.25,
          }}
        >
          {kpi.label}
        </span>
        <span
          style={{
            flex: "none",
            display: "flex",
            alignItems: "center",
            gap: 3,
            padding: "3px 7px",
            borderRadius: 999,
            background: good ? "var(--s-ok-bg)" : "var(--s-bad-bg)",
            color: good ? "var(--s-ok)" : "var(--s-bad)",
            fontSize: 10.5,
            fontWeight: 800,
          }}
        >
          <TrendIcon size={10} strokeWidth={3} />
          {Math.abs(kpi.delta).toFixed(1).replace(".", ",")}%
        </span>
      </div>

      <span
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: 26,
          lineHeight: 1,
          letterSpacing: "-.03em",
          color: "var(--s-t1)",
        }}
      >
        {formatValue(kpi)}
      </span>

      {kpi.helper && (
        <span style={{ fontSize: 11.5, color: "var(--s-t3)", lineHeight: 1.35 }}>{kpi.helper}</span>
      )}
    </div>
  );
}
