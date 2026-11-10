import { notFound } from "next/navigation";
import { requireAdmin } from "../../guard";
import {
  readIndicador,
  readIndicadores,
  readPaginasCatalogo,
  readPaginasDoIndicador,
} from "@/lib/data/indicators/read";
import { readSourceSchema } from "@/lib/data/indicators/source-columns";
import { IndicadorDetailScreen } from "@/components/admin/IndicadorDetailScreen";

export const dynamic = "force-dynamic";

export default async function IndicadorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();

  const { id } = await params;
  const [indicador, sourceSchema, paginas, catalogo, todos] = await Promise.all([
    readIndicador(id),
    readSourceSchema(),
    readPaginasDoIndicador(id),
    readPaginasCatalogo(),
    readIndicadores(),
  ]);

  if (!indicador) notFound();

  const relacionaveis = todos.flatMap((g) =>
    g.servicos.map((s) => ({ value: s.id, label: `${s.id} · ${s.indicadorServico}` })),
  );

  return (
    <IndicadorDetailScreen
      indicador={indicador}
      sourceColumns={sourceSchema.columns}
      sourceDateColumns={sourceSchema.dateColumns}
      paginas={paginas}
      catalogo={catalogo}
      relacionaveis={relacionaveis}
    />
  );
}
