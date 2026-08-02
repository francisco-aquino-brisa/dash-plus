"use client";

import type { CSSProperties } from "react";
import { ChevronDown, ChevronUp, Lock, Minus, type LucideIcon } from "lucide-react";
import { Sparkline } from "@/components/ui/sparkline";
import { isTrendGood, statusColor } from "@/lib/ui/status";

/**
 * KPI card (DESIGN_SYSTEM §4.3).
 *
 * The most-repeated card in the product: icon + label + trend pill, big value
 * with a sparkline, a three-column META / PROJEÇÃO / ATING. footer, and an
 * attainment bar. The whole card is a button → opens the indicator's Raio-X
 * (wired per-screen in Phase 2). Values arrive pre-formatted (pt-BR) so the
 * card never re-formats; it only colours.
 */
export interface KpiStat {
  label: string;
  value: string;
  /** Colour this cell by attainment (the "Ating." column). */
  status?: boolean;
}

export interface KpiCardProps {
  icon: LucideIcon;
  label: string;
  /** Pre-formatted display value, e.g. "1.508.872" or "R$ 26,29". */
  value: string;
  /** Period-over-period change in %, e.g. -1.2. Omit to hide the pill. */
  trend?: number | null;
  /** Attainment %, e.g. 40. `null`/undefined → neutral, no meta. */
  atingimento?: number | null;
  /** Indicator where lower is better (churn, base fechada, …). */
  inverse?: boolean;
  /** Exactly three footer stats (Meta / Projeção / Ating.). */
  stats: KpiStat[];
  /** 12 raw points for the sparkline. */
  sparkline: number[];
  onClick?: () => void;
}

export function KpiCard({
  icon: Icon,
  label,
  value,
  trend,
  atingimento,
  inverse = false,
  stats,
  sparkline,
  onClick,
}: KpiCardProps) {
  const ac = statusColor(atingimento, inverse);
  const good = trend != null && isTrendGood(trend, inverse);
  const trendIcon = trend == null || trend === 0 ? Minus : trend > 0 ? ChevronUp : ChevronDown;
  const TrendIcon = trendIcon;
  const barW = atingimento == null ? 8 : Math.max(4, Math.min(100, atingimento));

  return (
    <button
      type="button"
      onClick={onClick}
      className="bd-kpi"
      style={{
        textAlign: "left",
        font: "inherit",
        cursor: onClick ? "pointer" : "default",
        position: "relative",
        overflow: "hidden",
        border: "1px solid var(--s-border)",
        borderRadius: 14,
        background: "var(--s-card)",
        padding: "13px 13px 11px",
        boxShadow: "var(--s-sh)",
        display: "flex",
        flexDirection: "column",
        gap: 9,
        transition: ".18s",
      }}
    >
      {/* Header: icon · label · trend pill */}
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
            textWrap: "pretty",
          }}
        >
          {label}
        </span>
        {trend != null && (
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
            {Math.abs(trend).toFixed(1).replace(".", ",")}%
          </span>
        )}
      </div>

      {/* Value + sparkline */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
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
          {value}
        </span>
        <Sparkline
          values={sparkline}
          line={good ? "var(--s-ok)" : "var(--s-brand)"}
          fill={good ? "var(--s-ok-bg)" : "var(--s-brand-weak)"}
        />
      </div>

      {/* Footer stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 6,
          paddingTop: 9,
          borderTop: "1px solid var(--s-border)",
        }}
      >
        {stats.map((s, i) => (
          <span key={i} style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
            <span
              style={{
                fontSize: 8.5,
                fontWeight: 700,
                letterSpacing: ".09em",
                textTransform: "uppercase",
                color: "var(--s-t3)",
              }}
            >
              {s.label}
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: s.status ? ac : "var(--s-t1)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {s.value}
            </span>
          </span>
        ))}
      </div>

      {/* Attainment bar */}
      <div style={{ height: 4, borderRadius: 99, background: "var(--s-sunken)", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            borderRadius: 99,
            width: `${barW}%`,
            background: atingimento == null ? "var(--s-border-2)" : ac,
            transformOrigin: "left",
            animation: "bdGrow .5s ease both",
          }}
        />
      </div>
    </button>
  );
}

/**
 * Dashed "no access" placeholder (DESIGN_SYSTEM §4.3 / plan rule "Sem acesso ≠
 * zero"). Rendered in place of a KPI card when the source is missing — never a
 * fabricated 0.
 */
export function LockedKpiCard({
  label,
  reason = "Aguardando liberação do time de dados.",
  icon: Icon = Lock,
}: {
  label: string;
  reason?: string;
  icon?: LucideIcon;
}) {
  const rowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 9 };

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
      <div style={rowStyle}>
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
          <Icon size={14} />
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--s-t3)", lineHeight: 1.25 }}>{label}</span>
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--s-t2)" }}>Sem acesso aos dados</div>
      <div style={{ fontSize: 11, color: "var(--s-t3)", lineHeight: 1.4 }}>{reason}</div>
    </div>
  );
}
