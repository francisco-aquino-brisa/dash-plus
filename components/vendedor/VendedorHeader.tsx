"use client";

import type { CSSProperties } from "react";
import type { VendedorProfile } from "@/lib/data/vendedor/types";
import { initials } from "./vendedor-format";

/**
 * Identity card (SCREENS §4.2). A `--bn-gradient-orange` header (the one screen
 * surface allowed to use the brand gradient per DESIGN_SYSTEM §1) with avatar
 * initials, nome, "Matrícula · cargo" and ATIVO / tipo-cidade badges, over an
 * auto-fit grid of profile fields separated by hairline dividers. Follows the
 * legacy field set (data = current app), restyled to the new tokens.
 */
export function VendedorHeader({ profile }: { profile: VendedorProfile }) {
  const ativo = profile.situacao.toUpperCase() === "ATIVO";
  const fields: { label: string; value: string }[] = [
    { label: "Cidade", value: profile.cidade },
    { label: "Canal", value: profile.canal },
    { label: "Gerente", value: profile.gerente },
    { label: "Supervisão", value: profile.supervisao },
    { label: "Coordenação", value: profile.coordenacao },
    { label: "Gerência", value: profile.gerencia },
    { label: "Nicho", value: profile.nicho },
    { label: "Tempo de empresa", value: profile.tempoEmpresa },
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
      {/* Gradient header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          padding: 15,
          background: "var(--bn-gradient-orange)",
        }}
      >
        <div
          style={{
            flex: "none",
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "rgba(255,255,255,.22)",
            display: "grid",
            placeItems: "center",
            color: "#fff",
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: 15,
          }}
        >
          {initials(profile.nome)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: 17,
              lineHeight: 1.2,
              letterSpacing: "-.02em",
              color: "#fff",
              textWrap: "pretty",
            }}
          >
            {profile.nome}
          </div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "rgba(255,255,255,.85)", marginTop: 3 }}>
            Matrícula {profile.matricula} · {profile.nivel}
          </div>
        </div>
        <div style={{ flex: "none", display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Badge strong={ativo}>{profile.situacao}</Badge>
          {profile.tipoCidade !== "—" && <Badge>{profile.tipoCidade}</Badge>}
        </div>
      </div>

      {/* Field grid (hairline dividers via 1px gap over --s-border) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 1,
          background: "var(--s-border)",
        }}
      >
        {fields.map((f) => (
          <div key={f.label} style={{ background: "var(--s-card)", padding: "11px 14px" }}>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: "var(--s-t3)",
              }}
            >
              {f.label}
            </div>
            <div
              title={f.value}
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: "var(--s-t1)",
                marginTop: 3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {f.value}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Badge({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  const style: CSSProperties = {
    padding: "3px 8px",
    borderRadius: 999,
    background: strong ? "rgba(255,255,255,.24)" : "rgba(255,255,255,.16)",
    color: "#fff",
    fontSize: 10,
    fontWeight: 800,
    whiteSpace: "nowrap",
  };

  return <span style={style}>{children}</span>;
}
