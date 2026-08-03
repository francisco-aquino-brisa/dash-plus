"use client";

import { Lock } from "lucide-react";

/**
 * A "sem acesso" section for Produtividade (PDU e TAM de Vendedores). Both are
 * kept from the legacy screen (SCREENS §3 doesn't surface them) but have no
 * accessible source yet — PDU's `vw_hc_zerado_vendedor` is absent and TAM needs a
 * per-vendedor meta — so they render locked with the reason, never a fake 0.
 * Local to this screen on purpose (the Vendedor migration runs in parallel and
 * has its own locked block — no shared primitive to avoid a merge collision).
 */
export function ProdLockedBlock({
  title,
  subtitle,
  reason,
}: {
  title: string;
  subtitle: string;
  reason: string;
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
          {title}
        </h2>
        <div style={{ fontSize: 11.5, color: "var(--s-t3)", marginTop: 2 }}>{subtitle}</div>
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
        <div style={{ fontSize: 12, color: "var(--s-t3)", maxWidth: 440, lineHeight: 1.5 }}>{reason}</div>
      </div>
    </section>
  );
}
