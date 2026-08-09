import { Lock } from "lucide-react";

export const metadata = {
  title: "Sem acesso · Brisa Dash",
};

/**
 * Shown when the forwarded email has no active row in `tb_usuarios`
 * (ADR 0005). There is no login to retry — access is granted by the data team.
 */
export default function SemAcessoPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-page px-4">
      <div className="w-full max-w-md rounded-panel border border-border bg-card p-8 text-center shadow-[var(--s-sh)]">
        <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-pill bg-brand-weak text-brand">
          <Lock className="h-5 w-5" />
        </span>
        <h1 className="font-display text-xl font-extrabold text-t1">Sem acesso a este painel</h1>
        <p className="mt-2 text-t2">
          Seu usuário ainda não tem acesso liberado ao Brisa Dash. Procure o time de dados para ser incluído.
        </p>
      </div>
    </div>
  );
}
