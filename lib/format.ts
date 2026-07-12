// UI formatting helpers. The dashboard UI is rendered in pt-BR (see CONTEXT.md).

export function formatMonth(iso: string) {
  const [y, m] = iso.split("-");
  const names = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  return `${names[parseInt(m, 10) - 1]}/${y.slice(2)}`;
}

export function formatNumber(n: number, opts?: { signed?: boolean }) {
  // Dashboard-wide rule: never abbreviate numbers (e.g. 42 mil → 42.000).
  const sign = opts?.signed && n > 0 ? "+" : "";

  return sign + new Intl.NumberFormat("pt-BR").format(Math.round(n));
}

export function formatChartLabel(n: number) {
  if (Number.isInteger(n)) return new Intl.NumberFormat("pt-BR").format(n);

  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(n);
}

export function formatPct(n: number, digits = 1) {
  return `${n.toFixed(digits)}%`;
}
