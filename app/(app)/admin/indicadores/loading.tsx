import { Skeleton } from "@/components/ui/skeleton";

// Instant fallback while the server reads the indicator catalog.
export default function IndicadoresLoading() {
  return (
    <div style={{ padding: "clamp(18px, 4vw, 34px)" }}>
      <div style={{ maxWidth: 1600, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-11 w-full rounded-xl" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
