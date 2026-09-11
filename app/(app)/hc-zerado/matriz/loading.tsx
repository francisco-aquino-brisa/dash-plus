import { BlockSkeleton, HcLoadingShell } from "@/components/hc-zerado/skeleton";

export default function MatrizHcLoading() {
  return (
    <HcLoadingShell title="Matriz Gerencial">
      <BlockSkeleton height={520} />
    </HcLoadingShell>
  );
}
