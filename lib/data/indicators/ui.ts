import type { ChipTone } from "@/lib/data/admin/derive";

/**
 * Presentation helpers for the indicator catalog (client-safe): the colour tone
 * for each category and each serviço, so the list and detail screens share one
 * palette instead of a wall of grey.
 */

const NEUTRAL: ChipTone = { fg: "var(--s-t2)", bg: "var(--s-sunken)" };
const BLUE: ChipTone = { fg: "var(--s-blue)", bg: "var(--s-blue-bg)" };
const OK: ChipTone = { fg: "var(--s-ok)", bg: "var(--s-ok-bg)" };
const BAD: ChipTone = { fg: "var(--s-bad)", bg: "var(--s-bad-bg)" };
const WARN: ChipTone = { fg: "var(--s-warn)", bg: "var(--s-warn-bg)" };
const BRAND: ChipTone = { fg: "var(--s-brand)", bg: "var(--s-brand-weak)" };

/** Category order (list sections) + label + tone. */
export const CATEGORY_META: { key: string; label: string; tone: ChipTone }[] = [
  { key: "venda", label: "Venda", tone: OK },
  { key: "base", label: "Base", tone: BLUE },
  { key: "cancelamento", label: "Cancelamento", tone: BAD },
  { key: "receita", label: "Receita", tone: WARN },
];

export function categoryLabel(key: string): string {
  return CATEGORY_META.find((c) => c.key === key)?.label ?? key;
}

export function categoryTone(key: string): ChipTone {
  return CATEGORY_META.find((c) => c.key === key)?.tone ?? NEUTRAL;
}

/** Format a computed indicator value for display, per the spec's `formato`. */
export function formatValor(value: number | null | undefined, formato: string): string {
  if (value == null || Number.isNaN(value)) return "—";

  switch (formato) {
    case "percentual":
      return `${(value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
    case "moeda":
      return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    case "decimal":
      return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
    default:
      return Math.round(value).toLocaleString("pt-BR");
  }
}

/** Tone for a serviço chip (FTTH/FWA/5G/Banda Larga). */
export function servicoTone(servico: string): ChipTone {
  const s = servico.trim().toLowerCase();

  if (s === "ftth") return BLUE;

  if (s === "fwa") return OK;

  if (s === "5g") return BRAND;

  if (s.includes("banda")) return WARN;

  return NEUTRAL;
}
