// Monthly competência resolution for the Dashboard Vendedor screen. PDU and Dias
// Zerados are inherently monthly, so the screen filters by a single month.

import { todayUtc } from "../_shared";

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export interface ResolvedCompetencia {
  ym: string; // yyyy-MM
  ano: number;
  mes: number; // 1..12
  from: string; // yyyy-MM-01
  to: string; // last day of month, or today when it is the current month
  label: string; // "Junho 2026"
  isCurrentMonth: boolean;
  hojeDia: number | null; // day-of-month when isCurrentMonth, else null
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Newest competência we assume data exists for = current month (in Brazil). */
export function defaultCompetencia(today = todayUtc()): string {
  return `${today.getUTCFullYear()}-${pad(today.getUTCMonth() + 1)}`;
}

export function resolveCompetencia(ym: string, today = todayUtc()): ResolvedCompetencia {
  const safe = /^\d{4}-\d{2}$/.test(ym) ? ym : defaultCompetencia(today);
  const [y, m] = safe.split("-").map((s) => parseInt(s, 10));
  const from = `${y}-${pad(m)}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const isCurrentMonth = y === today.getUTCFullYear() && m === today.getUTCMonth() + 1;
  const toDay = isCurrentMonth ? today.getUTCDate() : lastDay;

  return {
    ym: safe,
    ano: y,
    mes: m,
    from,
    to: `${y}-${pad(m)}-${pad(toDay)}`,
    label: `${MESES[m - 1]} ${y}`,
    isCurrentMonth,
    hojeDia: isCurrentMonth ? today.getUTCDate() : null,
  };
}

/** Last N competências (yyyy-MM), newest first — for the period picker fallback. */
export function lastCompetencias(n: number, today = todayUtc()): string[] {
  const out: string[] = [];

  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));

    out.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`);
  }

  return out;
}
