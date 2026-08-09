import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

/**
 * Server-side admin guard for the /admin pages. The middleware already blocks
 * non-admins by the `isAdmin` cookie claim; this is defense in depth for direct
 * server rendering. Non-admins go to the dashboards, unauthenticated to bootstrap.
 */
export async function requireAdmin() {
  const session = await getSession();

  if (!session) redirect("/bootstrap?next=/admin");

  if (!session.isAdmin) redirect("/dashboard");

  return session;
}
