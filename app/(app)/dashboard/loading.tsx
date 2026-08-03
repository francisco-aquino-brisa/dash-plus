// Instant fallback while the server builds the cities view-model (App Router
// streams this on navigation). Token-styled to match the migrated screen.

const block = (style: React.CSSProperties): React.CSSProperties => ({
  background: "var(--s-sunken)",
  borderRadius: 10,
  animation: "bdFade .6s ease both",
  ...style,
});

function KpiSkeleton() {
  return (
    <div
      style={{
        border: "1px solid var(--s-border)",
        borderRadius: 14,
        background: "var(--s-card)",
        padding: 13,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", gap: 9 }}>
        <div style={block({ width: 28, height: 28, borderRadius: 9 })} />
        <div style={block({ flex: 1, height: 14, marginTop: 3 })} />
      </div>
      <div style={block({ width: 120, height: 24 })} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        <div style={block({ height: 22 })} />
        <div style={block({ height: 22 })} />
        <div style={block({ height: 22 })} />
      </div>
      <div style={block({ height: 4, borderRadius: 99 })} />
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "16px 16px 40px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "2px 2px 0" }}>
        <div style={block({ width: 180, height: 10 })} />
        <div style={block({ width: 320, height: 30, borderRadius: 12 })} />
        <div style={block({ width: 420, height: 14 })} />
      </div>
      <div style={block({ height: 60, borderRadius: "var(--r-panel)" })} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={block({ height: 78, borderRadius: 14 })} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(228px, 1fr))", gap: 10 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <KpiSkeleton key={i} />
        ))}
      </div>
      <div style={block({ height: 260, borderRadius: "var(--r-panel)" })} />
    </div>
  );
}
