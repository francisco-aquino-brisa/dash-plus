import { BlockSkeleton, HcLoadingShell, TableSkeleton, TilesSkeleton } from "@/components/hc-zerado/skeleton";

export default function DesempenhoHcLoading() {
  return (
    <HcLoadingShell title="Desempenho HC">
      <BlockSkeleton>
        <TilesSkeleton count={6} />
      </BlockSkeleton>
      <BlockSkeleton>
        <TilesSkeleton count={4} />
      </BlockSkeleton>
      <BlockSkeleton height={320} />
      <BlockSkeleton>
        <TableSkeleton lines={6} />
      </BlockSkeleton>
    </HcLoadingShell>
  );
}
