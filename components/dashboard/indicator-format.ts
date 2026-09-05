// Shared presentation helpers for the Cities indicator cards / drill modal:
// the icon per id_indicador and the unit-aware value formatter. Kept in one
// place so the KPI grid, the Raio-X modal and the related-metric tiles agree.

import {
  Activity,
  ArrowLeftRight,
  ArrowUpRight,
  Ban,
  CheckCircle2,
  DollarSign,
  Flame,
  Layers,
  Percent,
  Radio,
  RefreshCw,
  Rocket,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  UserMinus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { formatBRL, formatNumber, formatPct } from "@/lib/format";
import type { IndicatorUnit } from "@/lib/data/cities/indicators";

/** Icon per id_indicador (shared meaning across blocks); falls back by unit. */
const ICON_BY_ID: Record<string, LucideIcon> = {
  BA01: Users,
  BA02: ArrowUpRight,
  BA03: TrendingDown,
  BA04: TrendingUp,
  BA10: Ban,
  BA11: UserMinus,
  BA12: UserMinus,
  BA13: RefreshCw,
  CA01: Flame,
  CA02: Flame,
  CA03: Flame,
  CA04: Flame,
  CA09: Flame,
  CA10: Flame,
  CA12: Flame,
  VE01: ShoppingCart,
  VE02: CheckCircle2,
  VE03: Rocket,
  VE04: Radio,
  VE05: Percent,
  VE06: Percent,
  VE27: Layers,
  VE32: ArrowLeftRight,
  VE33: ArrowLeftRight,
  VE34: Percent,
  VE35: Percent,
  VE51: Radio,
};

export function iconForIndicator(id: string, unit: IndicatorUnit): LucideIcon {
  return ICON_BY_ID[id] ?? (unit === "currency" ? DollarSign : unit === "percent" ? Percent : Activity);
}

/** Format a raw indicator value for display (pt-BR), honouring its unit. */
export function formatIndicatorValue(unit: IndicatorUnit, v: number, decimals = 1): string {
  if (unit === "currency") return formatBRL(v, Math.max(decimals, 2));

  if (unit === "percent") return formatPct(v, decimals);

  return formatNumber(v);
}

/**
 * The exact (un-abbreviated) string for a value's hover tooltip. Only currency
 * differs from its display form (compact → full R$); returns "" otherwise.
 */
export function fullIndicatorValue(unit: IndicatorUnit, v: number, decimals = 1): string {
  return unit === "currency" ? formatBRL(v, Math.max(decimals, 2)) : "";
}
