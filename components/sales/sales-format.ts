// Presentation helpers for the Vendas · Canais indicator cards / drill:
// the icon per indicator id and the unit-aware value formatter. Mirrors the
// cities `indicator-format`, but over the sales unit set ("qtd" | "percent" |
// "currency"). Kept in one place so the KPI grid and the drill agree.

import {
  Activity,
  ArrowLeftRight,
  CheckCircle2,
  DollarSign,
  Flame,
  Layers,
  Percent,
  Radio,
  Rocket,
  ShoppingCart,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { formatBRL, formatNumber, formatPct } from "@/lib/format";
import type { SalesUnit } from "@/lib/data/sales/indicators";

/** Icon per indicator id (shared meaning across blocks); falls back by unit. */
const ICON_BY_ID: Record<string, LucideIcon> = {
  VE01: ShoppingCart,
  VE02: CheckCircle2,
  VE03: Rocket,
  VE05: Percent,
  VE06: Percent,
  VE04: Radio,
  VE27: Layers,
  VE28: Smartphone,
  VE29: Smartphone,
  VE51: Radio,
  VE32: ArrowLeftRight,
  VE33: ArrowLeftRight,
  VE34: Percent,
  VE35: Percent,
  VE47: ShoppingCart,
  VE48: CheckCircle2,
  VE49: Rocket,
  RE01: DollarSign,
  RE02: DollarSign,
  RE03: DollarSign,
  RE04: DollarSign,
  RE05: DollarSign,
  RE03f: DollarSign,
  CA08: Flame,
  CA09: Flame,
  CA10: Flame,
};

export function iconForSales(id: string, unit: SalesUnit): LucideIcon {
  return ICON_BY_ID[id] ?? (unit === "currency" ? DollarSign : unit === "percent" ? Percent : Activity);
}

/** Format a raw sales value for display (pt-BR), honouring its unit. Mirrors the
 *  cities `formatIndicatorValue` so the two screens read identically. */
export function formatSalesValue(unit: SalesUnit, v: number, decimals = 1): string {
  if (unit === "currency") return formatBRL(v, Math.max(decimals, 2));

  if (unit === "percent") return formatPct(v, decimals);

  return formatNumber(v);
}

/**
 * The exact (un-abbreviated) string for a value's hover tooltip. Only currency
 * differs from its display form (compact → full R$); returns "" otherwise, so
 * callers set a `title` only when it adds information.
 */
export function fullSalesValue(unit: SalesUnit, v: number, decimals = 1): string {
  return unit === "currency" ? formatBRL(v, Math.max(decimals, 2)) : "";
}
