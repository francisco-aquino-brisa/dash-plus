import { Skeleton } from "@/components/ui/skeleton";

// Instant fallback so navigating into an indicator is immediate — the server
// reads the catalog + source columns while this mirrors the detail layout.
function ServicoSkeleton() {
  return (
    <div
      style={{
        border: "1px solid var(--s-border)",
        borderRadius: "var(--r-card)",
        background: "var(--s-card)",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <Skeleton className="h-5 w-64" />
      <div style={{ display: "flex", gap: 20 }}>
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-20" />
      </div>
      <Skeleton className="h-16 w-full rounded-xl" />
    </div>
  );
}

export default function IndicadorDetailLoading() {
  return (
    <div style={{ padding: "clamp(18px, 4vw, 34px)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-5 w-40" />
        </div>
        <ServicoSkeleton />
        <ServicoSkeleton />
      </div>
    </div>
  );
}
