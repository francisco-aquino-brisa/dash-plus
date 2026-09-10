import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { UnderConstruction } from "@/components/hc-zerado/UnderConstruction";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getSession();

  if (!session) redirect("/bootstrap?next=/hc-zerado/auditar");

  return (
    <UnderConstruction
      title="Auditar Justificativas"
      description="Relatório de leitura das justificativas recebidas, com filtro por status e categoria."
    />
  );
}
