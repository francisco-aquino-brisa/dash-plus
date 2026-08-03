import { requireAdmin } from "../guard";
import { readAdminData } from "@/lib/data/admin/read";
import { UsuariosScreen } from "@/components/admin/UsuariosScreen";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  await requireAdmin();

  const { usuarios, niveis, cargos } = await readAdminData();

  return <UsuariosScreen usuarios={usuarios} niveis={niveis} cargos={cargos} />;
}
