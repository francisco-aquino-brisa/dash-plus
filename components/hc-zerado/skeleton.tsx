// Instant fallbacks while the server aggregates a HC view-model (the App Router
// streams these on navigation, so the route changes immediately instead of
// waiting for Databricks). Token-styled to match the real screens' shape.

import { card } from "./ui";

export const bar = (style: React.CSSProperties): React.CSSProperties => ({
  background: "var(--s-sunken)",
  borderRadius: 10,
  animation: "bdFade .6s ease both",
  ...style,
});

/** A block card with its dot + title bar, matching `Block` in the real screen. */
export function BlockSkeleton({ children, height }: { children?: React.ReactNode; height?: number }) {
  return (
    <section style={card}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 14px",
          borderBottom: "1px solid var(--s-border)",
        }}
      >
        <span
          style={{ flex: "none", width: 7, height: 7, borderRadius: 999, background: "var(--s-border-2)" }}
        />
        <div style={bar({ width: 240, height: 13 })} />
      </div>
      <div style={{ padding: 14 }}>{children ?? <div style={bar({ height: height ?? 120 })} />}</div>
    </section>
  );
}

export function TilesSkeleton({ count }: { count: number }) {
  return (
    <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{ ...card, boxShadow: "none", background: "var(--s-sunken)", padding: "12px 14px" }}
        >
          <div style={bar({ width: 80, height: 9, background: "var(--s-border-2)" })} />
          <div style={bar({ width: 96, height: 26, marginTop: 8, background: "var(--s-border-2)" })} />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ lines }: { lines: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={bar({ height: 11, width: "100%", background: "var(--s-border-2)" })} />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} style={{ display: "flex", gap: 10 }}>
          <div style={bar({ height: 14, flex: 2 })} />
          <div style={bar({ height: 14, flex: 1 })} />
          <div style={bar({ height: 14, flex: 1 })} />
          <div style={bar({ height: 14, flex: 1 })} />
          <div style={bar({ height: 14, flex: 1 })} />
        </div>
      ))}
    </div>
  );
}

/** The page chrome every HC screen shares: title, subtitle and the chip row. */
export function HcLoadingShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "16px 16px 40px" }}>
      <div style={{ padding: "2px 2px 0" }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: ".11em",
            textTransform: "uppercase",
            color: "var(--s-brand)",
          }}
        >
          Brisanet · HC &amp; Zero Vendas
        </div>
        <h1
          style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-.025em", lineHeight: 1.05, marginTop: 4 }}
        >
          {title}
        </h1>
        <p style={{ fontSize: 13, color: "var(--s-t3)", marginTop: 4 }}>Carregando dados…</p>
      </div>

      <div style={{ ...card, display: "flex", flexWrap: "wrap", gap: 8, padding: "10px 12px" }}>
        {[92, 104, 118, 108, 84, 96, 88, 92, 104].map((width, i) => (
          <div key={i} style={bar({ width, height: 40, borderRadius: 999 })} />
        ))}
      </div>

      {children}
    </div>
  );
}
