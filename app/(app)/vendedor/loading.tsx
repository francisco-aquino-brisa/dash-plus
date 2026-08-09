import { Skeleton } from "@/components/ui/skeleton";

// Instant fallback while the server aggregates the vendedor view-model.
export default function VendedorLoading() {
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
          Raio-X individual
        </div>
        <h1
          style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-.025em", lineHeight: 1.05, marginTop: 4 }}
        >
          Dashboard Vendedor
        </h1>
        <p style={{ fontSize: 13, color: "var(--s-t3)", marginTop: 4 }}>Carregando dados…</p>
      </div>

      <Skeleton className="h-14 w-full" style={{ borderRadius: "var(--r-panel)" }} />
      <Skeleton className="h-9 w-56" style={{ borderRadius: 999 }} />
      <Skeleton className="h-28 w-full" style={{ borderRadius: "var(--r-panel)" }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(215px, 1fr))", gap: 10 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-64 w-full" style={{ borderRadius: 14 }} />
        ))}
      </div>
      <Skeleton className="h-32 w-full" style={{ borderRadius: "var(--r-panel)" }} />
    </div>
  );
}
