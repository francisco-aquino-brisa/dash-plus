import type { CalcSpec } from "./spec";

/** Σnumerador / Σdenominador of one month (`den` is null for non-ratio formas). */
export interface MonthPartial {
  num: number;
  den: number | null;
  /** Row counts of a Média measure; the measure's value is sum ÷ count. */
  numCnt?: number;
  denCnt?: number;
}

function mean(sum: number | null | undefined, cnt: number | undefined): number | null {
  if (sum == null) return null;

  if (cnt === undefined) return sum;

  return cnt ? sum / cnt : null;
}

export function prevYm(ym: string): string {
  const [y, m] = ym.split("-").map(Number);

  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** Numerator and denominator values of `ym`, Média already divided. */
export function specParts(
  spec: CalcSpec,
  at: (ym: string) => MonthPartial | undefined,
  ym: string,
): { numerador: number | null; denominador: number | null } {
  const denMonth = spec.denominador?.periodo === "mes_anterior" ? prevYm(ym) : ym;
  const n = at(ym);
  const d = at(denMonth);

  return { numerador: mean(n?.num ?? 0, n?.numCnt), denominador: mean(d?.den, d?.denCnt) };
}

/** The indicator's value for `ym`, or null when it cannot be computed (no denominator). */
export function specValue(
  spec: CalcSpec,
  at: (ym: string) => MonthPartial | undefined,
  ym: string,
): number | null {
  const value = (m: string) => {
    const p = at(m);

    return p ? mean(p.num, p.numCnt) : null;
  };

  if (spec.forma === "simples") return value(ym);

  if (spec.forma === "variacao_mensal") return (value(ym) ?? 0) - (value(prevYm(ym)) ?? 0);

  const { numerador, denominador } = specParts(spec, at, ym);

  return denominador ? (numerador ?? 0) / denominador : null;
}
