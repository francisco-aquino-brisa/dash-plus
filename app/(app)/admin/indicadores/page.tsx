import { requireAdmin } from "../guard";
import { readIndicadores } from "@/lib/data/indicators/read";
import { IndicadoresScreen } from "@/components/admin/IndicadoresScreen";

export const dynamic = "force-dynamic";

export default async function IndicadoresPage() {
  await requireAdmin();

  const indicadores = await readIndicadores();

  return <IndicadoresScreen indicadores={indicadores} />;
}
