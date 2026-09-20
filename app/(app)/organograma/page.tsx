import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getOrgChartForCpf } from "@/lib/data/organograma/repository";
import { OrgChartScreen } from "@/components/organograma/OrgChartScreen";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Organograma · Brisa Dash",
};

/** Personal org-chart view (opened from the sidebar "Organograma"). Shows the
 * signed-in person's own position: immediate managers going up, everything
 * below going down — never another user's branch (see docs/hierarquia-*). */
export default async function OrganogramaPage() {
  const session = await getSession();

  if (!session) redirect("/bootstrap?next=/organograma");

  const initial = await getOrgChartForCpf(session.cpf);

  return <OrgChartScreen initial={initial} canSearch={session.isAdmin} />;
}
