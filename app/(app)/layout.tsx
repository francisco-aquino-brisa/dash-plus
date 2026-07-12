import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/AppShell";

// Shared shell (collapsible sidebar + top bar) for all authenticated screens.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) redirect("/login");

  return <AppShell user={{ name: session.name }}>{children}</AppShell>;
}
