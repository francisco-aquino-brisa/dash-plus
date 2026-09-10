// Instant fallback while the server aggregates the HC view-model (App Router
// streams this on navigation, so the route changes immediately instead of
// waiting for Databricks). Token-styled to match the real screen's shape.

const bloco = (style: React.CSSProperties): React.CSSProperties => ({
  background: "var(--s-sunken)",
  borderRadius: 10,
  animation: "bdFade .6s ease both",
  ...style,
});

const cartao: React.CSSProperties = {
  border: "1px solid var(--s-border)",
  borderRadius: 14,
  background: "var(--s-card)",
  boxShadow: "var(--s-sh)",
};

/** A block card with its dot + title bar, matching `Bloco` in the real screen. */
function BlocoSkeleton({ children, altura }: { children?: React.ReactNode; altura?: number }) {
  return (
    <section style={cartao}>
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
        <div style={bloco({ width: 240, height: 13 })} />
      </div>
      <div style={{ padding: 14 }}>{children ?? <div style={bloco({ height: altura ?? 120 })} />}</div>
    </section>
  );
}

function TilesSkeleton({ quantos }: { quantos: number }) {
  return (
    <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
      {Array.from({ length: quantos }).map((_, i) => (
        <div
          key={i}
          style={{ ...cartao, boxShadow: "none", background: "var(--s-sunken)", padding: "12px 14px" }}
        >
          <div style={bloco({ width: 80, height: 9, background: "var(--s-border-2)" })} />
          <div style={bloco({ width: 96, height: 26, marginTop: 8, background: "var(--s-border-2)" })} />
        </div>
      ))}
    </div>
  );
}

function TabelaSkeleton({ lines }: { lines: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={bloco({ height: 11, width: "100%", background: "var(--s-border-2)" })} />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} style={{ display: "flex", gap: 10 }}>
          <div style={bloco({ height: 14, flex: 2 })} />
          <div style={bloco({ height: 14, flex: 1 })} />
          <div style={bloco({ height: 14, flex: 1 })} />
          <div style={bloco({ height: 14, flex: 1 })} />
          <div style={bloco({ height: 14, flex: 1 })} />
        </div>
      ))}
    </div>
  );
}

export default function DesempenhoHcLoading() {
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
          Desempenho HC
        </h1>
        <p style={{ fontSize: 13, color: "var(--s-t3)", marginTop: 4 }}>Carregando dados…</p>
      </div>

      {/* Filter chip row */}
      <div style={{ ...cartao, display: "flex", flexWrap: "wrap", gap: 8, padding: "10px 12px" }}>
        {[92, 104, 118, 108, 84, 96, 88, 92, 104].map((largura, i) => (
          <div key={i} style={bloco({ width: largura, height: 40, borderRadius: 999 })} />
        ))}
      </div>

      <BlocoSkeleton>
        <TilesSkeleton quantos={6} />
      </BlocoSkeleton>
      <BlocoSkeleton>
        <TilesSkeleton quantos={4} />
      </BlocoSkeleton>
      <BlocoSkeleton altura={320} />
      <BlocoSkeleton>
        <TabelaSkeleton lines={6} />
      </BlocoSkeleton>
    </div>
  );
}
