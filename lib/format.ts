// UI formatting helpers. The dashboard UI is rendered in pt-BR (see CONTEXT.md).

export function formatMonth(iso: string) {
  const [y, m] = iso.split("-");
  const names = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${names[parseInt(m, 10) - 1]}/${y.slice(2)}`;
}

export function formatNumber(n: number, opts?: { compact?: boolean; signed?: boolean }) {
  const sign = opts?.signed && n > 0 ? "+" : "";
  if (opts?.compact) {
    return (
      sign +
      new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n)
    );
  }
  return sign + new Intl.NumberFormat("pt-BR").format(Math.round(n));
}

export function formatPct(n: number, digits = 1) {
  return `${n.toFixed(digits)}%`;
}
