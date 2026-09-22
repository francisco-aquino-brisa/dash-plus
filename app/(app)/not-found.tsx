import Link from "next/link";
import { SearchX, ArrowLeft } from "lucide-react";

/**
 * `notFound()` from inside a screen the user legitimately opened. Renders inside
 * the shell, unlike the global app/not-found.tsx, so they carry on from here.
 */
export default function AppNotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-4">
      <div className="w-full max-w-md rounded-panel border border-border bg-card p-8 text-center shadow-[var(--s-sh)]">
        <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-pill bg-brand-weak text-brand">
          <SearchX className="h-5 w-5" />
        </span>

        <div className="mb-1 text-[11px] font-bold tracking-[0.14em] text-t3 uppercase">Erro 404</div>
        <h1 className="font-display text-xl font-extrabold text-t1">Registro não encontrado</h1>
        <p className="mt-2 text-t2">
          O item que você tentou abrir não existe ou foi removido. Use o menu para seguir de onde parou.
        </p>

        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-[11px] border border-border bg-sunken px-4 text-sm font-bold text-t2 no-underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
