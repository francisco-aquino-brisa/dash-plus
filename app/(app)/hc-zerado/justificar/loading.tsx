import { BlockSkeleton, HcLoadingShell, TilesSkeleton } from "@/components/hc-zerado/skeleton";

export default function JustificarHcLoading() {
  return (
    <HcLoadingShell title="Justificar HC">
      <TilesSkeleton count={7} />
      <BlockSkeleton height={420} />
    </HcLoadingShell>
  );
}
