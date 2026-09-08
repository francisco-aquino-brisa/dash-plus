import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { EmConstrucao } from "@/components/hc-zerado/EmConstrucao";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getSession();

  if (!session) redirect("/bootstrap?next=/hc-zerado/produtividade");

  return (
    <EmConstrucao
      titulo="Análise de Produtividade"
      descricao="Produtividade mensal e média de zerados por vendedor, gerência, coordenação e cidade. Próxima tela da migração."
    />
  );
}
