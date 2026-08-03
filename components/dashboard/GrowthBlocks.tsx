"use client";

import { Globe, Radio, Wifi, Zap, type LucideIcon } from "lucide-react";
import { statusColor } from "@/lib/ui/status";
import { formatNumber, formatPct } from "@/lib/format";
import type { GrowthByTech } from "@/lib/data/cities/compute";

/**
 * Crescimento de Base (SCREENS §1.4). A meta/resultado/atingimento headline over
 * four per-technology blocks (FTTH · FWA · Banda Larga · 5G), each with base de
 * clientes, cidades ativas/negativas and takeup (only where Home Passed exists).
 */
const TECH_ICON: Record<string, LucideIcon> = {
  FTTH: Wifi,
  FWA: Radio,
  "Banda Larga": Globe,
  "5G": Zap,
};

export function GrowthBlocks({
  growth,
  summary,
}: {
  growth: GrowthByTech[];
  summary: { meta: number; resultado: number; atingimento: number };
}) {
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
        gap: 13,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
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
            Bloco 1 · Crescimento de Base
          </h3>
          <div style={{ fontSize: 11.5, color: "var(--s-t3)", marginTop: 2 }}>
            Base atual − base do mês anterior, por tecnologia
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 11.5, fontWeight: 700, color: "var(--s-t3)" }}>
          <span>
            Meta <span style={{ color: "var(--s-t1)" }}>{formatNumber(summary.meta)}</span>
          </span>
          <span>
            Resultado{" "}
            <span style={{ color: summary.resultado >= 0 ? "var(--s-ok)" : "var(--s-bad)" }}>
              {formatNumber(summary.resultado, { signed: true })}
            </span>
          </span>
          <span>
            Ating.{" "}
            <span style={{ color: statusColor(summary.atingimento) }}>
              {formatPct(summary.atingimento, 0)}
            </span>
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 }}>
        {growth.map((t) => {
          const Icon = TECH_ICON[t.tecnologia] ?? Globe;
          const cells: { label: string; value: string; color: string }[] = [
            { label: "Base clientes", value: formatNumber(t.baseClientes), color: "var(--s-t1)" },
            { label: "Cidades ativas", value: formatNumber(t.cidadesAtivas), color: "var(--s-ok)" },
            { label: "Negativas", value: formatNumber(t.cidadesNeg), color: "var(--s-bad)" },
          ];

          if (t.takeup !== undefined) {
            cells.push({ label: "Takeup", value: formatPct(t.takeup), color: "var(--s-t1)" });
          }

          return (
            <div
              key={t.tecnologia}
              style={{
                border: "1px solid var(--s-border)",
                borderRadius: 13,
                background: "var(--s-sunken)",
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 800,
                    fontSize: 14,
                    color: "var(--s-t1)",
                  }}
                >
                  {t.tecnologia}
                </span>
                <span
                  style={{
                    display: "grid",
                    placeItems: "center",
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    background: "var(--s-card)",
                    color: "var(--s-brand)",
                  }}
                >
                  <Icon size={14} />
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                {cells.map((c) => (
                  <span
                    key={c.label}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                      border: "1px solid var(--s-border)",
                      borderRadius: 10,
                      background: "var(--s-card)",
                      padding: "8px 9px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        letterSpacing: ".07em",
                        textTransform: "uppercase",
                        color: "var(--s-t3)",
                      }}
                    >
                      {c.label}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 800,
                        fontSize: 15,
                        letterSpacing: "-.02em",
                        color: c.color,
                      }}
                    >
                      {c.value}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
