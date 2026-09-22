import Link from "next/link";
import { Compass, ArrowRight } from "lucide-react";

export const metadata = {
  title: "Página não encontrada · Brisa Dash",
};

/**
 * Distinct from /sem-acesso on purpose: "no such screen" vs "not yours" send the
 * user to different teams. The way back is `/`, which the middleware resolves to
 * whichever screen this particular user may open.
 */
export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-page px-4">
      <div className="w-full max-w-md rounded-panel border border-border bg-card p-8 text-center shadow-[var(--s-sh)]">
        <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-pill bg-brand-weak text-brand">
          <Compass className="h-5 w-5" />
        </span>

        <div className="mb-1 text-[11px] font-bold tracking-[0.14em] text-t3 uppercase">Erro 404</div>
        <h1 className="font-display text-xl font-extrabold text-t1">Página não encontrada</h1>
        <p className="mt-2 text-t2">
          O endereço que você abriu não existe no Brisa Dash. Ele pode ter sido movido, ou o link estar
          incompleto.
        </p>

        <Link
          href="/"
          className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-[11px] text-sm font-extrabold text-white no-underline"
          style={{ background: "var(--s-brand)" }}
        >
          Ir para a página inicial
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
