// Date helpers for the filter bars: ISO <-> Date conversion (local, no TZ drift)
// and a pt-BR range label. Kept separate from lib/format.ts so date-fns stays
// scoped to the client components that already pull it in.

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/** Date → "yyyy-MM-dd" in local time (no UTC shift). */
export function toIso(d?: Date): string | undefined {
  if (!d) return undefined;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "yyyy-MM-dd" → Date in local time. Invalid/empty input → undefined. */
export function fromIso(s?: string): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

/** pt-BR range label, e.g. "03 jun – 18 jun 2026". Assumes `from` is set. */
export function formatDateRange(from: Date, to?: Date): string {
  const start = format(from, "dd MMM", { locale: ptBR });
  const end = to ? format(to, "dd MMM yyyy", { locale: ptBR }) : "…";
  return `${start} – ${end}`;
}
