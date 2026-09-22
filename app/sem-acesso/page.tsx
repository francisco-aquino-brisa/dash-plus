import Link from "next/link";
import { AlertTriangle, Lock, LogOut, RefreshCw } from "lucide-react";
import { BootstrapButton } from "@/components/auth/BootstrapButton";
import { getForwardedEmail } from "@/lib/auth/identity";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sem acesso · Brisa Dash",
};

type Estado = "nao-cadastrado" | "sem-permissao" | "falha";

const COPY: Record<Estado, { titulo: string; texto: string }> = {
  "nao-cadastrado": {
    titulo: "Sem acesso a este painel",
    texto:
      "Seu usuário ainda não tem acesso liberado ao Brisa Dash. Procure o time de dados para ser incluído.",
  },
  "sem-permissao": {
    titulo: "Nenhuma tela liberada",
    texto:
      "Seu usuário está ativo, mas o nível de acesso dele ainda não tem permissão para nenhuma tela. Procure o time de dados para liberar.",
  },
  falha: {
    titulo: "Não foi possível validar seu acesso",
    texto:
      "A consulta que verifica suas permissões falhou. Isso costuma ser temporário — tente novamente. Se persistir, procure o time de dados.",
  },
};

export default async function SemAcessoPage({
  searchParams,
}: {
  searchParams: { motivo?: string; erro?: string };
}) {
  const estado: Estado =
    searchParams.erro === "lookup" || searchParams.erro === "sessao"
      ? "falha"
      : searchParams.motivo === "permissao"
        ? "sem-permissao"
        : "nao-cadastrado";

  const falha = estado === "falha";
  const session = await getSession();
  const email = session?.email ?? getForwardedEmail();
  const { titulo, texto } = COPY[estado];

  return (
    <div className="grid min-h-screen place-items-center bg-page px-4">
      <div className="w-full max-w-md rounded-panel border border-border bg-card p-8 text-center shadow-[var(--s-sh)]">
        <span
          className={`mx-auto mb-4 grid h-12 w-12 place-items-center rounded-pill ${
            falha ? "bg-sunken text-t2" : "bg-brand-weak text-brand"
          }`}
        >
          {falha ? <AlertTriangle className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
        </span>

        <h1 className="font-display text-xl font-extrabold text-t1">{titulo}</h1>
        <p className="mt-2 text-t2">{texto}</p>

        {email && (
          <div className="mt-5 rounded-[10px] border border-border bg-sunken px-3 py-2.5 text-left">
            <div className="text-[10.5px] font-bold tracking-wider text-t3 uppercase">Conectado como</div>
            <div className="mt-0.5 truncate text-sm font-semibold text-t2">{email}</div>
          </div>
        )}

        <div className="mt-6 grid gap-2">
          {falha && (
            <BootstrapButton
              icon={<RefreshCw className="h-4 w-4" />}
              label="Tentar novamente"
              pendingLabel="Verificando…"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-[11px] text-sm font-extrabold text-white no-underline"
              style={{ background: "var(--s-brand)" }}
            />
          )}

          <Link
            href="/logout"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-[11px] border border-border bg-card text-sm font-bold text-t2 no-underline"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Link>
        </div>
      </div>
    </div>
  );
}
