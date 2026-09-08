// Fallback for the module's screens that have no skeleton of their own, so
// switching between them changes route immediately instead of blocking on the
// server. The heavier screens ship a shaped skeleton next to their own page.

export default function HcZeradoLoading() {
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
          HC Zerado
        </h1>
        <p style={{ fontSize: 13, color: "var(--s-t3)", marginTop: 4 }}>Carregando dados…</p>
      </div>
      <div
        style={{
          border: "1px solid var(--s-border)",
          borderRadius: 14,
          background: "var(--s-card)",
          boxShadow: "var(--s-sh)",
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {[120, 92, 104, 76].map((largura, i) => (
          <div
            key={i}
            style={{
              background: "var(--s-sunken)",
              borderRadius: 10,
              height: 16,
              width: `${largura}px`,
              animation: "bdFade .6s ease both",
            }}
          />
        ))}
        <div
          style={{
            background: "var(--s-sunken)",
            borderRadius: 10,
            height: 200,
            animation: "bdFade .6s ease both",
          }}
        />
      </div>
    </div>
  );
}
