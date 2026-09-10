// Period helpers for the HC Zerado module.
//
// The original app let the user pick any De/Até and then pulled the whole view;
// here the range is capped so one aggregation stays bounded (ADR 0006).

import { todayIso } from "../_shared";

/** Longest range the screens accept, in days (inclusive of both ends). */
export const MAX_RANGE_DAYS = 31;

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseIso(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

/** Default range: the first of the current month through today (in Brazil). */
export function defaultHcRange(): { from: string; to: string } {
  const to = todayIso();
  const from = `${to.slice(0, 7)}-01`;

  return { from, to };
}

/** Whole days between two ISO dates, inclusive. */
export function daysBetween(from: string, to: string): number {
  const ms = parseIso(to).getTime() - parseIso(from).getTime();

  return Math.floor(ms / 86_400_000) + 1;
}

/**
 * Clamp a range to `MAX_RANGE_DAYS`, keeping the end date and pulling the start
 * forward — the screens always answer "what happened up to `to`".
 */
export function clampRange(from: string, to: string): { from: string; to: string; clamped: boolean } {
  if (parseIso(from) > parseIso(to)) return { from: to, to, clamped: true };

  if (daysBetween(from, to) <= MAX_RANGE_DAYS) return { from, to, clamped: false };

  const start = parseIso(to);

  start.setUTCDate(start.getUTCDate() - (MAX_RANGE_DAYS - 1));

  return { from: toIso(start), to, clamped: true };
}

/** Every calendar day in the range, ascending. */
export function dateRangeList(from: string, to: string): string[] {
  const out: string[] = [];
  const end = parseIso(to);
  const cur = parseIso(from);

  while (cur <= end) {
    out.push(toIso(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  return out;
}

/** The original's axis label: `01 - qua`. */
export function dayLabel(iso: string): string {
  return `${iso.slice(8, 10)} - ${WEEKDAYS[parseIso(iso).getUTCDay()]}`;
}

export function isWeekend(iso: string): boolean {
  const d = parseIso(iso).getUTCDay();

  return d === 0 || d === 6;
}

/** The previous calendar day (the D-1 the regional comparison uses). */
export function previousDay(iso: string): string {
  const d = parseIso(iso);

  d.setUTCDate(d.getUTCDate() - 1);

  return toIso(d);
}

const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** The label the shared DateFilter chip shows for the current range. */
export function periodLabel(from: string, to: string): string {
  const [ay, am, ad] = from.split("-");
  const [by, bm, bd] = to.split("-");

  if (from === to) return `${ad}/${am}/${ay}`;

  if (ad === "01" && am === bm && ay === by && to === lastDayOfMonth(to))
    return `${MONTHS_SHORT[Number(am) - 1]}/${ay.slice(2)}`;

  return `${ad}/${am} – ${bd}/${bm}/${by}`;
}

function lastDayOfMonth(iso: string): string {
  const d = parseIso(iso);
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));

  return toIso(end);
}

/**
 * Read a range back from the label the shared DateFilter emits — it hands over a
 * formatted string (`Jul/26`, `14/07/2026`, `27/06 – 26/07/2026`), not ISO.
 */
export function parsePeriodLabel(value: string): { from: string; to: string } | null {
  const month = value.match(/^([A-Za-z]{3})\/(\d{2})$/);

  if (month) {
    const idx = MONTHS_SHORT.findIndex((m) => m.toLowerCase() === month[1].toLowerCase());

    if (idx < 0) return null;

    const year = 2000 + Number(month[2]);
    const start = `${year}-${String(idx + 1).padStart(2, "0")}-01`;

    return { from: start, to: lastDayOfMonth(start) };
  }

  const day = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (day) {
    const iso = `${day[3]}-${day[2]}-${day[1]}`;

    return { from: iso, to: iso };
  }

  const range = value.match(/^(\d{2})\/(\d{2})\s*[–-]\s*(\d{2})\/(\d{2})\/(\d{4})$/);

  if (range) {
    const [, ad, am, bd, bm, by] = range;
    // The start carries no year: it belongs to the previous one when its month
    // is later than the end's.
    const startYear = Number(am) > Number(bm) ? Number(by) - 1 : Number(by);

    return { from: `${startYear}-${am}-${ad}`, to: `${by}-${bm}-${bd}` };
  }

  return null;
}
