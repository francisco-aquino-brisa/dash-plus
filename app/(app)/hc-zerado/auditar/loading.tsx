import { BlockSkeleton, HcLoadingShell } from "@/components/hc-zerado/skeleton";

export default function AuditarHcLoading() {
  return (
    <HcLoadingShell title="Auditar Justificativas">
      <BlockSkeleton height={460} />
    </HcLoadingShell>
  );
}
