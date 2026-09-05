// Presentation helpers for the Dashboard Vendedor screen: the icon + colour per
// service bucket and the catalog value formatter. Mirrors the sales/cities
// `*-format` helpers so the four screens read identically. Colours follow the
// prototype (SCREENS §4): FTTH brand · FWA ok · 5G blue · Banda warn.

import { Globe, Radio, Wifi, Zap, type LucideIcon } from "lucide-react";
import { formatBRL, formatNumber, formatPct } from "@/lib/format";
import type { IndicadorFormato, ServicoKey } from "@/lib/data/vendedor/types";

export interface ServicoStyle {
  icon: LucideIcon;
  /** Icon tile background (a `--s-*-bg` token). */
  bg: string;
  /** Icon colour (a `--s-*` token). */
  fg: string;
}

export const SERVICO_STYLE: Record<ServicoKey, ServicoStyle> = {
  FTTH: { icon: Wifi, bg: "var(--s-brand-weak)", fg: "var(--s-brand)" },
  FWA: { icon: Radio, bg: "var(--s-ok-bg)", fg: "var(--s-ok)" },
  "5G": { icon: Zap, bg: "var(--s-blue-bg)", fg: "var(--s-blue)" },
  Banda: { icon: Globe, bg: "var(--s-warn-bg)", fg: "var(--s-warn)" },
};

/**
 * Format an indicator value per its catalog `formato` (qtd / R$ / %). The metas
 * catalog stores "%" indicators as a fraction (0.15 → 15%), matching the legacy
 * screen — so a percent value is scaled by 100 before formatting.
 */
export function formatIndicadorValue(v: number, formato: IndicadorFormato): string {
  if (formato === "R$") return formatBRL(v);

  if (formato === "%") return formatPct(v * 100, 0);

  return formatNumber(v);
}

/**
 * The exact (un-abbreviated) string for a value's hover tooltip. Only currency
 * differs from its display form (compact → full R$); returns "" otherwise.
 */
export function fullIndicadorValue(v: number, formato: IndicadorFormato): string {
  return formato === "R$" ? formatBRL(v) : "";
}

/** Two uppercase initials for the identity-card avatar. */
export function initials(nome: string): string {
  const parts = nome.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "—";

  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";

  return (first + last).toUpperCase() || "—";
}
