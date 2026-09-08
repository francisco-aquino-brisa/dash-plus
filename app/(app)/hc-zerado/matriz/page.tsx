import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { EmConstrucao } from "@/components/hc-zerado/EmConstrucao";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getSession();

  if (!session) redirect("/bootstrap?next=/hc-zerado/matriz");

  return (
    <EmConstrucao
      titulo="Matriz Gerencial"
      descricao="Ociosidade comercial por regional, com a lista de zerados na data de referência."
    />
  );
}
