import type { CalcSpec } from "./spec";

/** Σnumerador / Σdenominador of one month (`den` is null for non-ratio formas). */
export interface MonthPartial {
  num: number;
  den: number | null;
}

export function prevYm(ym: string): string {
  const [y, m] = ym.split("-").map(Number);

  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** The indicator's value for `ym`, or null when it cannot be computed (no denominator). */
export function specValue(
  spec: CalcSpec,
  at: (ym: string) => MonthPartial | undefined,
  ym: string,
): number | null {
  if (spec.forma === "simples") return at(ym)?.num ?? null;

  if (spec.forma === "variacao_mensal") return (at(ym)?.num ?? 0) - (at(prevYm(ym))?.num ?? 0);

  const denMonth = spec.denominador?.periodo === "mes_anterior" ? prevYm(ym) : ym;
  const numv = at(ym)?.num ?? 0;
  const denv = at(denMonth)?.den ?? null;

  return denv ? numv / denv : null;
}
