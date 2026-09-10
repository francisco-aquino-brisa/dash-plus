import { addDaysUtc, isoUtc, parseIsoUtc, safeIsoDate, todayUtc } from "../_shared";
import type { ProdFilters } from "./types";

export interface ResolvedProdPeriod {
  from: string; // yyyy-MM-dd
  to: string;
  prevFrom: string;
  prevTo: string;
  label: string;
}

const MES_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function fmtBr(s: string): string {
  const [y, m, d] = s.split("-");

  return `${d} ${MES_ABBR[parseInt(m, 10) - 1]} ${y}`;
}

/** Default range: last 30 days (matches the prototype's default). */
export function defaultProdRange(today = todayUtc()): { from: string; to: string } {
  return { from: isoUtc(addDaysUtc(today, -29)), to: isoUtc(today) };
}

/** Resolve from/to (+ preceding equal-length window for deltas) and a label. */
export function resolveProdPeriod(f: ProdFilters): ResolvedProdPeriod {
  const def = defaultProdRange();
  // Launder request-supplied dates: they are inlined into SQL date literals, so
  // anything that is not a strict yyyy-MM-dd calendar date falls back to default.
  const from = safeIsoDate(f.from) ?? def.from;
  const to = safeIsoDate(f.to) ?? def.to;
  const lengthMs = Math.max(0, +parseIsoUtc(to) - +parseIsoUtc(from));
  const prevTo = addDaysUtc(parseIsoUtc(from), -1);
  const prevFrom = new Date(+prevTo - lengthMs);

  return {
    from,
    to,
    prevFrom: isoUtc(prevFrom),
    prevTo: isoUtc(prevTo),
    label: `${fmtBr(from)} – ${fmtBr(to)}`,
  };
}
