import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { EmConstrucao } from "@/components/hc-zerado/EmConstrucao";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getSession();

  if (!session) redirect("/bootstrap?next=/hc-zerado/auditar");

  return (
    <EmConstrucao
      titulo="Auditar Justificativas"
      descricao="Relatório de leitura das justificativas recebidas, com filtro por status e categoria."
    />
  );
}
