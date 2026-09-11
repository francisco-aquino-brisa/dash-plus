import { BlockSkeleton, HcLoadingShell, TableSkeleton } from "@/components/hc-zerado/skeleton";

export default function ProdutividadeHcLoading() {
  return (
    <HcLoadingShell title="Análise de Produtividade">
      <BlockSkeleton>
        <TableSkeleton lines={12} />
      </BlockSkeleton>
    </HcLoadingShell>
  );
}
