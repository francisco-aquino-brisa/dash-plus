// Indicator status colour — the single source of truth for "am I on target?".
//
// This is DESIGN_SYSTEM §4.1's mandated `statusColor(atingimento, inverse)`:
// it must exist exactly once in the codebase. KPI cards, trend pills, progress
// bars and ranking rows all colour through here so the semantics never drift.
//
// `inverse` marks indicators where LOWER is better (churn, base fechada,
// desativados): there, over-achieving the target is bad, not good.

/** Returns a `--s-*` CSS var for a given attainment %. `null` → neutral (no meta). */
export function statusColor(atingimento: number | null | undefined, inverse = false): string {
  if (atingimento == null) return "var(--s-t2)"; // sem meta → neutro

  if (inverse) {
    if (atingimento <= 100) return "var(--s-ok)";

    if (atingimento <= 115) return "var(--s-warn)";

    return "var(--s-bad)";
  }

  if (atingimento >= 100) return "var(--s-ok)";

  if (atingimento >= 70) return "var(--s-warn)";

  return "var(--s-bad)";
}

/**
 * Whether a period-over-period change reads as "good".
 *
 * A positive change is good on a normal indicator and bad on an inverse one;
 * the trend pill colours by this, never by the raw sign (DESIGN_SYSTEM §4.1).
 * Mirrors the prototype's `good = tr > 0 ? !inv : !!inv` (flat counts as inverse).
 */
export function isTrendGood(trend: number, inverse = false): boolean {
  return trend > 0 ? !inverse : !!inverse;
}
