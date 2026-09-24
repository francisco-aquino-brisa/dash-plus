import { requireAdmin } from "../guard";
import { readEstruturaCidades } from "@/lib/data/admin/estrutura-cidades";
import { EstruturaCidadesScreen } from "@/components/admin/EstruturaCidadesScreen";

export const dynamic = "force-dynamic";

export default async function CidadesPage() {
  await requireAdmin();

  const data = await readEstruturaCidades();

  return <EstruturaCidadesScreen {...data} />;
}
