// Shared helpers for the data adapters (cities / sales / produtividade). Pure
// functions with no I/O, so the same logic runs on both the mock and the
// Databricks paths. Domain-specific helpers stay in their own adapter files.

import type { KpiBlock } from "./sales/types";

/**
 * "Hoje" is a Brisanet calendar day, not the server's. `toISOString()` is UTC —
 * from 21:00 in Brazil it already reports tomorrow — and the server runs on UTC
 * too, so the zone has to be named. Brazil has no DST since 2019 and every
 * state Brisanet operates in is UTC-3.
 */
const BUSINESS_TZ = "America/Sao_Paulo";

// `en-CA`'s short date format is already `yyyy-MM-dd`.
const isoFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's calendar date in Brazil, as `yyyy-MM-dd`. */
export function todayIso(): string {
  return isoFormatter.format(new Date());
}

/** Today in Brazil, as a Date pinned to UTC midnight (see `parseIsoUtc`). */
export function todayUtc(): Date {
  return parseIsoUtc(todayIso());
}

/**
 * A calendar date as a Date at UTC midnight. `new Date(y, m, d)` and `setDate`
 * shift with the runner's zone, so calendar arithmetic stays in UTC — pair this
 * with `isoUtc` and `addDaysUtc`.
 */
export function parseIsoUtc(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

/** Format a UTC-midnight Date back to `yyyy-MM-dd`. */
export function isoUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Shift a UTC-midnight Date by whole days, staying in UTC. */
export function addDaysUtc(d: Date, n: number): Date {
  const x = new Date(d);

  x.setUTCDate(x.getUTCDate() + n);

  return x;
}

/** First day of the month a UTC-midnight Date falls in. */
export function startOfMonthUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

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

/**
 * Validate a strict `yyyy-MM-dd` calendar date and return it unchanged, or null
 * for anything else. Request-supplied dates (`de`/`ate`/`from`/`to`) are inlined
 * into SQL date literals (`DATE'...'`), so they MUST be laundered through here
 * first — this is the guard against SQL injection via those params. Also rejects
 * non-calendar dates the regex alone would accept (e.g. `2020-02-31`).
 */
export function safeIsoDate(value: string | undefined | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const d = new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(d.getTime())) return null;

  return d.toISOString().slice(0, 10) === value ? value : null;
}

/** Funnel column triplet [criado, efetivado, instalado] per service scope. */
export const FUNNEL_COLS: Record<string, [string, string, string]> = {
  INTERNET: ["criado_ftth", "efetivado_ftth", "instalado_ftth"],
  FWA: ["criado_fwa", "efetivado_fwa", "instalado_fwa"],
  BL: ["criado_bl", "efetivado_bl", "instalado_bl"],
};
