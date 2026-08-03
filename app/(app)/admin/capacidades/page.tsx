import { requireAdmin } from "../guard";
import { readAdminData } from "@/lib/data/admin/read";
import { CapacidadesScreen } from "@/components/admin/CapacidadesScreen";

export const dynamic = "force-dynamic";

export default async function CapacidadesPage() {
  await requireAdmin();

  const { capacidades, paginas } = await readAdminData();

  return <CapacidadesScreen capacidades={capacidades} paginas={paginas} />;
}
