import { addDaysUtc, isoUtc, parseIsoUtc, safeIsoDate, startOfMonthUtc, todayUtc } from "../_shared";
import type { SalesFilters } from "./types";

export interface ResolvedPeriod {
  from: string; // yyyy-MM-dd
  to: string;
  prevFrom: string;
  prevTo: string;
  label: string;
}

/** Resolve a SalesFilters period (preset or custom) into date windows + the
 *  immediately-preceding equal-length window (for deltas). */
export function resolvePeriod(f: SalesFilters): ResolvedPeriod {
  const today = todayUtc();
  let from: Date;
  let to: Date = today;
  let label: string;

  switch (f.period) {
    case "mes_anterior": {
      to = addDaysUtc(startOfMonthUtc(today), -1);
      from = startOfMonthUtc(to);
      label = "Mês anterior";
      break;
    }

    case "7d":
      from = addDaysUtc(today, -6);
      label = "Últimos 7 dias";
      break;
    case "30d":
      from = addDaysUtc(today, -29);
      label = "Últimos 30 dias";
      break;
    case "90d":
      from = addDaysUtc(today, -89);
      label = "Últimos 90 dias";
      break;
    case "ano":
      from = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
      label = "Ano";
      break;

    case "custom": {
      // Launder request-supplied dates before they reach the SQL date literals;
      // anything not a strict yyyy-MM-dd calendar date falls back to default.
      const cf = safeIsoDate(f.from);
      const ct = safeIsoDate(f.to);

      from = cf ? parseIsoUtc(cf) : startOfMonthUtc(today);
      to = ct ? parseIsoUtc(ct) : today;
      label = "Período personalizado";
      break;
    }

    case "mes_atual":
    default:
      from = startOfMonthUtc(today);
      label = "Mês atual";
      break;
  }

  const lengthMs = Math.max(0, +to - +from);
  const prevTo = addDaysUtc(from, -1);
  const prevFrom = new Date(+prevTo - lengthMs);

  return { from: isoUtc(from), to: isoUtc(to), prevFrom: isoUtc(prevFrom), prevTo: isoUtc(prevTo), label };
}
