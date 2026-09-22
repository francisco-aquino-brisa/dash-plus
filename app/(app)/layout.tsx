import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolvePageAccess } from "@/lib/auth/permissions";
import { AppShell } from "@/components/layout/AppShell";
import { PermissionsProvider } from "@/lib/auth/client";

// Shared shell for all authenticated screens, and the single page gate (ADR
// 0007): every screen renders through here, so none can forget to check.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = headers().get("x-pathname") ?? "";
  const access = await resolvePageAccess(pathname);

  if (!access) redirect(`/bootstrap?next=${encodeURIComponent(pathname || "/")}`);

  // `fallback` is /sem-acesso when they reach no page, so this cannot loop.
  if (!access.allowed) redirect(access.fallback);

  const { session } = access;

  return (
    <PermissionsProvider caps={session.caps} rotas={session.rotas} isAdmin={session.isAdmin}>
      <AppShell
        user={{
          nome: session.nome,
          email: session.email,
          nivel: session.nivel,
          isAdmin: session.isAdmin,
        }}
      >
        {children}
      </AppShell>
    </PermissionsProvider>
  );
}
