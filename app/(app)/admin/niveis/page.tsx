import { requireAdmin } from "../guard";
import { readAdminData } from "@/lib/data/admin/read";
import { NiveisScreen } from "@/components/admin/NiveisScreen";

export const dynamic = "force-dynamic";

export default async function NiveisPage() {
  await requireAdmin();

  const { niveis, capacidades } = await readAdminData();

  return <NiveisScreen niveis={niveis} totalCaps={capacidades.length} />;
}
