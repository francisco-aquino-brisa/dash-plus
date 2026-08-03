"use client";

import { Building, Globe, Lock, MapPin, Trophy, Users2, type LucideIcon } from "lucide-react";
import { formatNumber } from "@/lib/format";
import type { RankingEscopo, RankingView } from "@/lib/data/vendedor/types";

const ICONS: Record<RankingEscopo["escopo"], LucideIcon> = {
  cidade: MapPin,
  coordenacao: Users2,
  gerencia: Building,
  geral: Globe,
};

/**
 * Rankings (legacy block, kept per the migration rule "manter blocos do legado"):
 * the vendor's position by mix (BL + 5G) within cidade / coordenação / gerência /
 * geral. Restyled with `--s-*` tokens; degrades to a dashed note when unavailable.
 */
export function RankingsBlock({ ranking }: { ranking: RankingView }) {
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
      <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            display: "grid",
            placeItems: "center",
            width: 30,
            height: 30,
            borderRadius: 9,
            background: "var(--s-brand-weak)",
            color: "var(--s-brand)",
          }}
        >
          <Trophy size={16} />
        </span>
        <div>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: 17,
              letterSpacing: "-.02em",
            }}
          >
            Rankings
          </h2>
          <div style={{ fontSize: 11.5, color: "var(--s-t3)", marginTop: 2 }}>
            {ranking.metrica || "Posição do vendedor"}
          </div>
        </div>
      </header>

      {!ranking.available || ranking.escopos.length === 0 ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            border: "1px dashed var(--s-border-2)",
            borderRadius: 12,
            padding: "14px 12px",
            fontSize: 12.5,
            color: "var(--s-t3)",
          }}
        >
          <Lock size={15} /> Ranking indisponível para este vendedor no período.
        </div>
      ) : (
        <div
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}
        >
          {ranking.escopos.map((e) => {
            const Icon = ICONS[e.escopo];

            return (
              <div
                key={e.escopo}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  border: "1px solid var(--s-border)",
                  borderRadius: 12,
                  background: "var(--s-sunken)",
                  padding: "11px 12px",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0, color: "var(--s-t2)" }}
                >
                  <Icon size={16} style={{ flex: "none" }} />
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        letterSpacing: ".05em",
                        textTransform: "uppercase",
                      }}
                    >
                      {e.label}
                    </div>
                    <div
                      title={e.contexto}
                      style={{
                        fontSize: 11,
                        color: "var(--s-t3)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {e.contexto}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right", flex: "none" }}>
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 19,
                      fontWeight: 800,
                      color: "var(--s-t1)",
                    }}
                  >
                    {e.posicao != null ? `${e.posicao}º` : "—"}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--s-t3)" }}>de {formatNumber(e.total)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
