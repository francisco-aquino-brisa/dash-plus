import { LogIn, Mail } from "lucide-react";
import { getForwardedEmail } from "@/lib/auth/identity";
import { BootstrapButton } from "@/components/auth/BootstrapButton";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Entrar · Brisa Dash",
};

/**
 * Re-entry screen shown after "Sair" clears the session (ADR 0005). There is no
 * password: the platform forwards the identity, so the email is shown locked and
 * a single "Entrar" re-mints the session via /bootstrap, which lands the user on
 * the first screen their nível holds. Standalone (no shell) — this is the
 * logged-out state, allowed through the middleware.
 */
export default function EntrarPage() {
  const email = getForwardedEmail() ?? "";

  return (
    <div className="grid min-h-screen place-items-center bg-page px-4">
      <div className="w-full max-w-sm rounded-panel border border-border bg-card p-8 text-center shadow-[var(--s-sh)]">
        <span className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-pill bg-brand-weak text-brand">
          <LogIn className="h-5 w-5" />
        </span>

        <div className="mb-1 text-[11px] font-bold tracking-[0.14em] text-t3 uppercase">Brisa Dash</div>
        <h1 className="font-display text-xl font-extrabold text-t1">Você saiu da sessão</h1>
        <p className="mt-2 text-sm text-t3">
          Sua identidade continua reconhecida pela plataforma. Entre novamente para retomar o acesso.
        </p>

        <div className="mt-6 text-left">
          <label className="mb-1.5 block text-[10.5px] font-bold tracking-wider text-t3 uppercase">
            E-mail
          </label>
          <div className="relative">
            <Mail className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-t3" />
            <input
              value={email}
              readOnly
              aria-label="E-mail"
              className="h-11 w-full cursor-not-allowed rounded-[10px] border border-border bg-sunken pr-3 pl-9 text-sm font-semibold text-t2 outline-none"
            />
          </div>
          <p className="mt-1.5 text-[11px] text-t3">Este e-mail é fixo — vem da sua conta na plataforma.</p>
        </div>

        <BootstrapButton
          icon={<LogIn className="h-4 w-4" />}
          label="Entrar"
          pendingLabel="Entrando…"
          className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-[11px] text-sm font-extrabold text-white no-underline"
          style={{ background: "var(--s-brand)" }}
        />
      </div>
    </div>
  );
}
