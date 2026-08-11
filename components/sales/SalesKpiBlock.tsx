"use client";

import { KpiBlock as GenericKpiBlock, type KpiBlockItem } from "@/components/ui/kpi-block";
import type { SalesIndicatorVM } from "@/lib/data/sales/indicators";
import { formatSalesValue, fullSalesValue, iconForSales } from "./sales-format";

/**
 * Vendas · Canais KPI block (SCREENS §2) — a thin adapter over the generic
 * `components/ui/kpi-block`, mirroring the cities wrapper. Maps each
 * `SalesIndicatorVM` to the shared `KpiBlockItem` (icon + pre-formatted value +
 * Meta / Média 12m / Ating. footer + sparkline), wiring the card click to the
 * drill. Indicators without a channel-grained source fall through to the dashed
 * LockedKpiCard, never a fake 0.
 */
function average(values: number[]): number {
  if (values.length === 0) return 0;

  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function SalesKpiBlock({
  title,
  subtitle,
  vms,
  selection,
  onSelectionChange,
  onCardClick,
}: {
  title: string;
  subtitle: string;
  vms: SalesIndicatorVM[];
  selection: string[];
  onSelectionChange: (next: string[]) => void;
  onCardClick: (vm: SalesIndicatorVM) => void;
}) {
  const items: KpiBlockItem[] = vms.map((vm) => {
    const inverse = vm.polarity === "down";
    const media = average(vm.series.map((s) => s.valor));

    return {
      id: vm.id,
      label: vm.label,
      available: vm.available,
      attainment: vm.attainment,
      inverse,
      card: vm.available
        ? {
            icon: iconForSales(vm.id, vm.unit),
            label: vm.label,
            value: formatSalesValue(vm.unit, vm.value, vm.decimals),
            valueFull: fullSalesValue(vm.unit, vm.value, vm.decimals),
            trend: vm.delta,
            atingimento: vm.attainment,
            inverse,
            stats: [
              {
                label: "Meta",
                value: vm.meta !== null ? formatSalesValue(vm.unit, vm.meta, vm.decimals) : "—",
                full: vm.meta !== null ? fullSalesValue(vm.unit, vm.meta, vm.decimals) : undefined,
              },
              {
                label: "Média 12m",
                value: formatSalesValue(vm.unit, media, vm.decimals),
                full: fullSalesValue(vm.unit, media, vm.decimals),
              },
              {
                label: "Ating.",
                value: vm.attainment !== null ? `${Math.round(vm.attainment)}%` : "—",
                status: true,
              },
            ],
            sparkline: vm.series.map((s) => s.valor),
            description: vm.description,
            onClick: () => onCardClick(vm),
          }
        : undefined,
    };
  });

  return (
    <GenericKpiBlock
      title={title}
      subtitle={subtitle}
      items={items}
      selection={selection}
      onSelectionChange={onSelectionChange}
    />
  );
}
