import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { UnderConstruction } from "@/components/hc-zerado/UnderConstruction";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getSession();

  if (!session) redirect("/bootstrap?next=/hc-zerado/produtividade");

  return (
    <UnderConstruction
      title="Análise de Produtividade"
      description="Produtividade mensal e média de zerados por vendedor, gerência, coordenação e cidade. Próxima tela da migração."
    />
  );
}
