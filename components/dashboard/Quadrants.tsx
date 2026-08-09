"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { statusColor } from "@/lib/ui/status";
import { formatNumber } from "@/lib/format";
import type { QuartileLevel, QuartilesByLevel } from "@/lib/data/cities/compute";

/**
 * Distribuição de Atingimento (Quartis) — SCREENS §1.3 design, legacy layout.
 *
 * A single panel: the four attainment quadrants on the left, and the drill
 * recorte on the right (inside the same card). The Gerência / Coordenação /
 * Cidade segmented drives both — the quadrants show how that level's entities
 * split across the bands, and the selected band lists its members on the right.
 */
// Band colours follow the legacy screen: green · blue (accent) · amber · red.
const QUAD = [
  { title: "Acima da meta", color: "var(--s-ok)" },
  { title: "Próximo da meta", color: "var(--s-blue)" },
  { title: "Abaixo da meta", color: "var(--s-warn)" },
  { title: "Negativa", color: "var(--s-bad)" },
];

const LEVELS: { value: QuartileLevel; label: string }[] = [
  { value: "gerencia", label: "Gerência" },
  { value: "coordenacao", label: "Coordenação" },
  { value: "cidade", label: "Cidade" },
];

const h3Style = { fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 15, letterSpacing: "-.02em" };
const subStyle = { fontSize: 11.5, color: "var(--s-t3)", marginTop: 2 };

export function Quadrants({ quartis }: { quartis: QuartilesByLevel }) {
  const [level, setLevel] = useState<QuartileLevel>("cidade");
  const [quad, setQuad] = useState(3); // default Q4 (negativa), mirroring the prototype
  const buckets = quartis[level];
  const total = buckets.reduce((a, b) => a + b.count, 0) || 1;
  const active = buckets[quad];

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
      <div>
        <h3 style={h3Style}>Distribuição de Atingimento (Quartis)</h3>
        <div style={subStyle}>Crescimento / meta de crescimento — por gerência, coordenação ou cidade</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
        {/* Quadrants */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {buckets.map((b, i) => {
            const meta = QUAD[i];
            const on = i === quad;
            const share = Math.round((b.count / total) * 100);

            return (
              <button
                key={i}
                type="button"
                onClick={() => setQuad(i)}
                style={{
                  textAlign: "left",
                  border: `1px solid ${on ? meta.color : "var(--s-border)"}`,
                  borderRadius: 12,
                  background: on ? "var(--s-sunken)" : "var(--s-card)",
                  padding: "11px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 7,
                  cursor: "pointer",
                  font: "inherit",
                  transition: ".16s",
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <span style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: "var(--s-t1)" }}>
                      Q{i + 1} — {meta.title}
                    </span>
                    <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--s-t3)" }}>{b.range}</span>
                  </span>
                  <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 800,
                        fontSize: 19,
                        color: meta.color,
                      }}
                    >
                      {formatNumber(b.count)}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--s-t3)" }}>{share}%</span>
                  </span>
                </span>
                <span
                  style={{
                    display: "block",
                    height: 4,
                    borderRadius: 99,
                    background: "var(--s-sunken)",
                    overflow: "hidden",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      height: "100%",
                      borderRadius: 99,
                      width: `${share}%`,
                      background: meta.color,
                    }}
                  />
                </span>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--s-t3)" }}>
                  Real {formatNumber(b.real)} / Meta {formatNumber(b.meta)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Recorte (inside the same card, on the right) */}
        <div
          style={{
            border: "1px solid var(--s-border)",
            borderRadius: 14,
            background: "var(--s-sunken)",
            padding: 13,
            display: "flex",
            flexDirection: "column",
            gap: 11,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <h4 style={{ ...h3Style, fontSize: 14 }}>
              Recorte · Q{quad + 1} {QUAD[quad].title}
            </h4>
            <Segmented
              options={LEVELS}
              value={level}
              onChange={setLevel}
              size="sm"
              ariaLabel="Nível do recorte"
            />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 2px",
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: ".08em",
              textTransform: "uppercase",
              color: "var(--s-t3)",
            }}
          >
            <span>{LEVELS.find((l) => l.value === level)?.label}</span>
            <span>Real / Meta · Ating.</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", maxHeight: 300, overflowY: "auto" }}>
            {active.itens.length === 0 ? (
              <p style={{ padding: "16px 2px", fontSize: 12, color: "var(--s-t3)" }}>
                Sem entidades nesta faixa.
              </p>
            ) : (
              active.itens.map((r) => (
                <div
                  key={r.nome}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 2px",
                    borderBottom: "1px solid var(--s-border)",
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: "var(--s-t1)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.nome}
                  </span>
                  <span
                    style={{
                      flex: "none",
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: "var(--s-t3)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatNumber(r.real)} / {formatNumber(r.meta)}
                  </span>
                  <span
                    style={{
                      flex: "none",
                      minWidth: 52,
                      textAlign: "right",
                      fontSize: 12.5,
                      fontWeight: 800,
                      color: statusColor(r.atingimento),
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {Math.round(r.atingimento)}%
                  </span>
                </div>
              ))
            )}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              fontSize: 11,
              color: "var(--s-t2)",
              lineHeight: 1.45,
            }}
          >
            <Info size={14} style={{ flex: "none", color: "var(--s-t3)", marginTop: 1 }} />
            <span>Selecione um quadrante e o nível para descer por Gerência → Coordenação → Cidade.</span>
          </div>
        </div>
      </div>
    </section>
  );
}
