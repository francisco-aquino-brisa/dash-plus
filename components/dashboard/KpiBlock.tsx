"use client";

import { KpiBlock as GenericKpiBlock, type KpiBlockItem } from "@/components/ui/kpi-block";
import type { IndicatorCardVM } from "@/lib/data/cities/indicator-blocks";
import { formatIndicatorValue, fullIndicatorValue, iconForIndicator } from "./indicator-format";

/**
 * Cities KPI block (SCREENS §1.2) — a thin adapter over the generic
 * `components/ui/kpi-block`. It maps each `IndicatorCardVM` to the shared
 * `KpiBlockItem` shape (icon + pre-formatted value + Meta/Projeção/Ating footer +
 * sparkline), wiring the card click to the Raio-X modal. Locked indicators fall
 * through to the dashed LockedKpiCard.
 */
export function KpiBlock({
  title,
  subtitle,
  vms,
  selection,
  onSelectionChange,
  onCardClick,
}: {
  title: string;
  subtitle: string;
  vms: IndicatorCardVM[];
  selection: string[];
  onSelectionChange: (next: string[]) => void;
  onCardClick: (vm: IndicatorCardVM) => void;
}) {
  const items: KpiBlockItem[] = vms.map((vm) => ({
    id: vm.id,
    label: vm.label,
    available: vm.available,
    attainment: vm.attainment,
    inverse: vm.polarity === "down",
    card: vm.available
      ? {
          icon: iconForIndicator(vm.id, vm.unit),
          label: vm.label,
          value: formatIndicatorValue(vm.unit, vm.value, vm.decimals),
          valueFull: fullIndicatorValue(vm.unit, vm.value, vm.decimals),
          trend: vm.delta,
          atingimento: vm.attainment,
          inverse: vm.polarity === "down",
          stats: vm.footer.map((f) => ({
            label: f.label,
            value: f.display,
            full: f.full,
            status: f.tone !== "default",
          })),
          sparkline: vm.series.map((s) => s.valor),
          description: vm.description,
          onClick: () => onCardClick(vm),
        }
      : undefined,
  }));

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
