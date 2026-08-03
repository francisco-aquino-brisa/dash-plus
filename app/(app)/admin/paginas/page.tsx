import { requireAdmin } from "../guard";
import { readAdminData } from "@/lib/data/admin/read";
import { PaginasScreen } from "@/components/admin/PaginasScreen";

export const dynamic = "force-dynamic";

export default async function PaginasPage() {
  await requireAdmin();

  const { paginas } = await readAdminData();

  return <PaginasScreen paginas={paginas} />;
}
