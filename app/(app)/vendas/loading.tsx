import { ShoppingCart } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// Instant fallback while the server aggregates the sales view-model from
// Databricks (App Router streams this immediately, so navigation feels instant).
function SalesKpiSkeleton() {
  return (
    <div className="bg-gradient-card shadow-elegant rounded-xl border border-border p-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-5 w-12 rounded-md" />
      </div>
      <Skeleton className="mt-4 h-8 w-24" />
      <Skeleton className="mt-2 h-3.5 w-32" />
      <Skeleton className="mt-3 h-1.5 w-full rounded-full" />
    </div>
  );
}

function KpiSectionSkeleton({ title }: { title: string }) {
  return (
    <section className="shadow-elegant rounded-2xl border border-border bg-card/40 p-5 backdrop-blur">
      <Skeleton className="mb-1 h-5 w-64" />
      <Skeleton className="mb-4 h-3.5 w-40" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <SalesKpiSkeleton key={`${title}-${i}`} />
        ))}
      </div>
    </section>
  );
}

export default function VendasLoading() {
  return (
    <div className="min-h-screen pb-12">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="bg-gradient-primary shadow-glow grid h-10 w-10 place-items-center rounded-xl text-primary-foreground">
              <ShoppingCart className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl leading-tight font-bold">
                Vendas · <span className="text-gradient">Canais</span>
              </h1>
              <p className="text-xs text-muted-foreground">Carregando dados…</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-6 px-6 py-6">
        <Skeleton className="h-24 w-full rounded-xl" />
        <KpiSectionSkeleton title="bl" />
        <KpiSectionSkeleton title="g5" />
        <section className="shadow-elegant rounded-2xl border border-border bg-card/40 p-5 backdrop-blur">
          <Skeleton className="mb-1 h-5 w-72" />
          <Skeleton className="mb-4 h-3.5 w-80" />
          <Skeleton className="h-[300px] w-full rounded-lg" />
        </section>
      </main>
    </div>
  );
}
