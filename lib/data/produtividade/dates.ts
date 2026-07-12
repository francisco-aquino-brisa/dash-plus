import type { ProdFilters } from "./types";

export interface ResolvedProdPeriod {
  from: string; // yyyy-MM-dd
  to: string;
  prevFrom: string;
  prevTo: string;
  label: string;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);

  x.setDate(x.getDate() + n);

  return x;
}

const MES_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function fmtBr(s: string): string {
  const [y, m, d] = s.split("-");

  return `${d} ${MES_ABBR[parseInt(m, 10) - 1]} ${y}`;
}

/** Default range: last 30 days (matches the prototype's default). */
export function defaultProdRange(today = new Date()): { from: string; to: string } {
  return { from: iso(addDays(today, -29)), to: iso(today) };
}

/** Resolve from/to (+ preceding equal-length window for deltas) and a label. */
export function resolveProdPeriod(f: ProdFilters): ResolvedProdPeriod {
  const today = new Date();
  const def = defaultProdRange(today);
  const from = f.from || def.from;
  const to = f.to || def.to;
  const lengthMs = Math.max(0, +new Date(to) - +new Date(from));
  const prevTo = addDays(new Date(from), -1);
  const prevFrom = new Date(+prevTo - lengthMs);

  return { from, to, prevFrom: iso(prevFrom), prevTo: iso(prevTo), label: `${fmtBr(from)} – ${fmtBr(to)}` };
}
