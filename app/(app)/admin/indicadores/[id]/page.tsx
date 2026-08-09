import { notFound } from "next/navigation";
import { requireAdmin } from "../../guard";
import { readIndicador } from "@/lib/data/indicators/read";
import { readSourceColumns } from "@/lib/data/indicators/source-columns";
import { IndicadorDetailScreen } from "@/components/admin/IndicadorDetailScreen";

export const dynamic = "force-dynamic";

export default async function IndicadorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();

  const { id } = await params;
  const [indicador, sourceColumns] = await Promise.all([readIndicador(id), readSourceColumns()]);

  if (!indicador) notFound();

  return <IndicadorDetailScreen indicador={indicador} sourceColumns={sourceColumns} />;
}
