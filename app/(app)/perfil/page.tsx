import { redirect } from "next/navigation";
import Link from "next/link";
import { LogOut, Mail, ShieldCheck, UserRound } from "lucide-react";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Perfil · Brisa Dash",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "?";

  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Simple profile screen (opened from the sidebar "Ver perfil"). Read-only view of
 * the session identity — there is nothing to edit here (identity comes from the
 * platform, ADR 0005). */
export default async function PerfilPage() {
  const session = await getSession();

  if (!session) redirect("/bootstrap?next=/perfil");

  return (
    <div style={{ padding: "clamp(18px, 4vw, 34px)", animation: "bdIn .3s ease both" }}>
      <div style={{ maxWidth: 620, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <div className="text-[10.5px] font-extrabold tracking-[0.14em] text-brand uppercase">Conta</div>
          <h1
            className="font-display text-t1"
            style={{
              margin: "6px 0 0",
              fontSize: "clamp(24px, 4vw, 30px)",
              fontWeight: 800,
              letterSpacing: "-.02em",
            }}
          >
            Perfil
          </h1>
          <p className="mt-1.5 text-sm text-t3">Seus dados de acesso ao Brisa Dash.</p>
        </div>

        <div className="rounded-panel border border-border bg-card" style={{ padding: 20 }}>
          {/* Identity header */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span
              className="bg-brand-weak text-brand"
              style={{
                flex: "none",
                display: "grid",
                placeItems: "center",
                width: 56,
                height: 56,
                borderRadius: 999,
                fontSize: 19,
                fontWeight: 800,
              }}
            >
              {initials(session.nome)}
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="text-t1" style={{ fontSize: 17, fontWeight: 800 }}>
                {session.nome}
              </div>
              <div className="text-t3" style={{ fontSize: 13, marginTop: 2 }}>
                {session.nivel}
              </div>
            </div>
          </div>

          {/* Detail rows */}
          <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 2 }}>
            <Row icon={<Mail className="h-4 w-4" />} label="E-mail" value={session.email} />
            <Row icon={<ShieldCheck className="h-4 w-4" />} label="Nível de acesso" value={session.nivel} />
            <Row
              icon={<UserRound className="h-4 w-4" />}
              label="Tipo de conta"
              value={session.isAdmin ? "Administrador" : "Usuário"}
            />
          </div>
        </div>

        <div className="rounded-panel border border-border bg-card" style={{ padding: 20 }}>
          <div className="text-t1" style={{ fontSize: 14, fontWeight: 800 }}>
            Sessão
          </div>
          <p className="mt-1 text-[13px] text-t3">
            Sair encerra sua sessão neste dispositivo. Você pode entrar novamente com o mesmo e-mail.
          </p>
          <Link
            href="/logout"
            className="mt-4 inline-flex items-center gap-2 rounded-[11px] border text-[13px] font-bold no-underline"
            style={{
              height: 40,
              padding: "0 16px",
              borderColor: "var(--s-bad)",
              color: "var(--s-bad)",
              background: "var(--s-bad-bg)",
            }}
          >
            <LogOut className="h-4 w-4" />
            Sair da conta
          </Link>
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "11px 0",
        borderTop: "1px solid var(--s-border)",
      }}
    >
      <span className="text-t3" style={{ flex: "none" }}>
        {icon}
      </span>
      <span className="text-t3" style={{ flex: "none", width: 130, fontSize: 12, fontWeight: 700 }}>
        {label}
      </span>
      <span
        className="text-t1"
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 13.5,
          fontWeight: 600,
          textAlign: "right",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </span>
    </div>
  );
}
