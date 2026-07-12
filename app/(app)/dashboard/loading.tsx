import { Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// Instant fallback while the server builds the cities view-model (App Router
// streams this immediately on navigation, so the page switch feels instant).
function KpiCardSkeleton() {
  return (
    <div className="bg-gradient-card shadow-elegant rounded-xl border border-border p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-5 w-12 rounded-md" />
      </div>
      <Skeleton className="mt-4 h-8 w-28" />
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/60 pt-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
      <Skeleton className="mt-3 h-1.5 w-full rounded-full" />
    </div>
  );
}

function SectionSkeleton({ height = "h-48" }: { height?: string }) {
  return (
    <section className="shadow-elegant rounded-2xl border border-border bg-card/40 p-5 backdrop-blur">
      <Skeleton className="mb-1 h-5 w-56" />
      <Skeleton className="mb-4 h-3.5 w-72" />
      <Skeleton className={`w-full ${height} rounded-lg`} />
    </section>
  );
}

export default function DashboardLoading() {
  return (
    <div className="min-h-screen pb-12">
      <header className="sticky top-10 z-40 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="bg-gradient-primary shadow-glow grid h-10 w-10 place-items-center rounded-xl text-primary-foreground">
              <Activity className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl leading-tight font-bold">
                Performance <span className="text-gradient">Cidades</span>
              </h1>
              <p className="text-xs text-muted-foreground">Carregando dados…</p>
            </div>
          </div>
          <Skeleton className="h-7 w-48 rounded-md" />
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-6 px-6 py-6">
        <Skeleton className="h-14 w-full rounded-xl" />

        <section>
          <Skeleton className="mb-3 h-5 w-40" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <KpiCardSkeleton key={i} />
            ))}
          </div>
        </section>

        <SectionSkeleton height="h-40" />
        <SectionSkeleton height="h-64" />
        <div className="grid gap-6 lg:grid-cols-2">
          <SectionSkeleton />
          <SectionSkeleton />
        </div>
      </main>
    </div>
  );
}
