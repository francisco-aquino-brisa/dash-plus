import { Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// Instant fallback while the server aggregates the productivity view-model.
function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-gradient-card p-5 shadow-elegant">
      <Skeleton className="h-3.5 w-28" />
      <Skeleton className="mt-3 h-8 w-24" />
      <Skeleton className="mt-3 h-3 w-32" />
    </div>
  );
}

export default function ProdutividadeLoading() {
  return (
    <div className="min-h-screen pb-12">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-6 py-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold leading-tight">
              Produtividade <span className="text-gradient">Comercial</span>
            </h1>
            <p className="text-xs text-muted-foreground">Carregando dados…</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-6 px-6 py-6">
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="h-[360px] w-full rounded-2xl" />
      </main>
    </div>
  );
}
