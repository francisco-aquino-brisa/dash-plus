// Shared helpers for the data adapters (cities / sales / produtividade). Pure
// functions with no I/O, so the same logic runs on both the mock and the
// Databricks paths. Domain-specific helpers stay in their own adapter files.

import type { KpiBlock } from "./sales/types";

/** Coerce an unknown DB/JSON value to a finite number (non-finite → 0). */
export function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Percentage change of `cur` vs `prev`, rounded to 1 decimal (prev 0 → 0). */
export function pct(cur: number, prev: number): number {
  return prev === 0 ? 0 : +(((cur - prev) / Math.abs(prev)) * 100).toFixed(1);
}

/** `part` as a percentage of `whole`, rounded to 1 decimal (whole 0 → 0). */
export function ratio(part: number, whole: number): number {
  return whole === 0 ? 0 : +((part / whole) * 100).toFixed(1);
}

/** A KPI card whose real source is blocked/unavailable (renders disabled). */
export function blocked(label: string): KpiBlock {
  return { label, value: 0, meta: 0, delta: 0, available: false };
}

/** Funnel column triplet [criado, efetivado, instalado] per service scope. */
export const FUNNEL_COLS: Record<string, [string, string, string]> = {
  INTERNET: ["criado_ftth", "efetivado_ftth", "instalado_ftth"],
  FWA: ["criado_fwa", "efetivado_fwa", "instalado_fwa"],
  BL: ["criado_bl", "efetivado_bl", "instalado_bl"],
};
