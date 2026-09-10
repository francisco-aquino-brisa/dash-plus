import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { UnderConstruction } from "@/components/hc-zerado/UnderConstruction";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getSession();

  if (!session) redirect("/bootstrap?next=/hc-zerado/justificar");

  return (
    <UnderConstruction
      title="Justificar HC"
      description="Registro e avaliação das justificativas de ociosidade, com as regras globais de auditoria."
    />
  );
}
