import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/AppShell";

// Shared shell (collapsible sidebar + mobile tab bar) for all authenticated screens.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) redirect("/bootstrap?next=/dashboard");

  return (
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
  );
}
