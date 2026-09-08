import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { EmConstrucao } from "@/components/hc-zerado/EmConstrucao";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getSession();

  if (!session) redirect("/bootstrap?next=/hc-zerado/justificar");

  return (
    <EmConstrucao
      titulo="Justificar HC"
      descricao="Registro e avaliação das justificativas de ociosidade, com as regras globais de auditoria."
    />
  );
}
