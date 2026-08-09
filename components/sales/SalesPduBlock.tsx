"use client";

import { Lock } from "lucide-react";

/**
 * PDU · Produtividade por Dia Útil (SCREENS §2.4) — Vendas · Canais.
 *
 * Currently **locked**: the original source `vw_hc_zerado_vendedor` does not
 * exist in the warehouse. A verified substitute (`vw_producao_hc_zero_venda`)
 * exists, but the official denominator (`dias_trabalhado` vs `dias_uteis_
 * acumulado`) and the meta source are still pending confirmation with the data
 * team — so the block renders "sem acesso" rather than a fabricated/unconfirmed
 * number (plan rule "Sem acesso ≠ zero"). When unlocked it becomes a 12-month
 * line chart per technology (realizado-only). See docs/data-map.md.
 */
export function SalesPduBlock() {
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
      <div>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: 17,
            letterSpacing: "-.02em",
          }}
        >
          PDU · Produtividade por Dia Útil
        </h2>
        <div style={{ fontSize: 11.5, color: "var(--s-t3)", marginTop: 2 }}>
          Produção realizada ÷ dia útil, por tecnologia
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          padding: "34px 16px",
          textAlign: "center",
          border: "1px dashed var(--s-border-2)",
          borderRadius: 14,
        }}
      >
        <span
          style={{
            display: "grid",
            placeItems: "center",
            width: 40,
            height: 40,
            borderRadius: 12,
            background: "var(--s-sunken)",
            color: "var(--s-t3)",
          }}
        >
          <Lock size={20} />
        </span>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--s-t1)" }}>Sem acesso aos dados</div>
        <div style={{ fontSize: 12, color: "var(--s-t3)", maxWidth: 420, lineHeight: 1.5 }}>
          Fórmula (denominador) e meta da PDU em confirmação com o time de dados. Assim que definidas, este
          bloco passa a exibir a produtividade por dia útil de cada tecnologia.
        </div>
      </div>
    </section>
  );
}
