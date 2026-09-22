import { requireAdmin } from "../guard";
import { readSupervisaoCidades } from "@/lib/data/admin/supervisao-cidades";
import { SupervisaoCidadesScreen } from "@/components/admin/SupervisaoCidadesScreen";

export const dynamic = "force-dynamic";

export default async function CidadesPage() {
  await requireAdmin();

  const { supervisoes, cidades, orfaos } = await readSupervisaoCidades();

  return <SupervisaoCidadesScreen supervisoes={supervisoes} cidades={cidades} orfaos={orfaos} />;
}
