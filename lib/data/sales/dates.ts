import { safeIsoDate } from "../_shared";
import type { SalesFilters } from "./types";

export interface ResolvedPeriod {
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

/** Resolve a SalesFilters period (preset or custom) into date windows + the
 *  immediately-preceding equal-length window (for deltas). */
export function resolvePeriod(f: SalesFilters): ResolvedPeriod {
  const today = new Date();
  let from: Date;
  let to: Date = today;
  let label: string;

  switch (f.period) {
    case "mes_anterior": {
      const firstThis = new Date(today.getFullYear(), today.getMonth(), 1);

      to = addDays(firstThis, -1);
      from = new Date(to.getFullYear(), to.getMonth(), 1);
      label = "Mês anterior";
      break;
    }

    case "7d":
      from = addDays(today, -6);
      label = "Últimos 7 dias";
      break;
    case "30d":
      from = addDays(today, -29);
      label = "Últimos 30 dias";
      break;
    case "90d":
      from = addDays(today, -89);
      label = "Últimos 90 dias";
      break;
    case "ano":
      from = new Date(today.getFullYear(), 0, 1);
      label = "Ano";
      break;

    case "custom": {
      // Launder request-supplied dates before they reach the SQL date literals;
      // anything not a strict yyyy-MM-dd calendar date falls back to default.
      const cf = safeIsoDate(f.from);
      const ct = safeIsoDate(f.to);

      from = cf ? new Date(cf) : new Date(today.getFullYear(), today.getMonth(), 1);
      to = ct ? new Date(ct) : today;
      label = "Período personalizado";
      break;
    }

    case "mes_atual":
    default:
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      label = "Mês atual";
      break;
  }

  const lengthMs = Math.max(0, +to - +from);
  const prevTo = addDays(from, -1);
  const prevFrom = new Date(+prevTo - lengthMs);

  return { from: iso(from), to: iso(to), prevFrom: iso(prevFrom), prevTo: iso(prevTo), label };
}
