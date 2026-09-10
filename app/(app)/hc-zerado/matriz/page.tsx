import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { UnderConstruction } from "@/components/hc-zerado/UnderConstruction";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getSession();

  if (!session) redirect("/bootstrap?next=/hc-zerado/matriz");

  return (
    <UnderConstruction
      title="Matriz Gerencial"
      description="Ociosidade comercial por regional, com a lista de zerados na data de referência."
    />
  );
}
