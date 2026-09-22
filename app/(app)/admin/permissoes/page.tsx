import { requireAdmin } from "../guard";
import { readAdminData } from "@/lib/data/admin/read";
import { PermissoesMatrix } from "@/components/admin/PermissoesMatrix";

export const dynamic = "force-dynamic";

export default async function PermissoesPage() {
  await requireAdmin();

  const { niveis, paginas, capacidades, perms } = await readAdminData([
    "niveis",
    "paginas",
    "capacidades",
    "perms",
  ]);

  return <PermissoesMatrix niveis={niveis} paginas={paginas} capacidades={capacidades} perms={perms} />;
}
