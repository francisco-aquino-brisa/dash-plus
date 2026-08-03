import { requireAdmin } from "../guard";
import { readAdminData } from "@/lib/data/admin/read";
import { CargosScreen } from "@/components/admin/CargosScreen";

export const dynamic = "force-dynamic";

export default async function CargosPage() {
  await requireAdmin();

  const { cargos } = await readAdminData();

  return <CargosScreen cargos={cargos} />;
}
