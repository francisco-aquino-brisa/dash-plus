import { UserRound } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// Instant fallback while the server aggregates the vendedor view-model.
export default function VendedorLoading() {
  return (
    <div className="min-h-screen pb-12">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-4 sm:px-6">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
            <UserRound className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold leading-tight">
              Dashboard <span className="text-gradient">Vendedor</span>
            </h1>
            <p className="text-xs text-muted-foreground">Carregando dados…</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-6 px-4 py-6 sm:px-6">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-2xl" />
      </main>
    </div>
  );
}
