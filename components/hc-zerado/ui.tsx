// Presentation primitives shared by the HC Zerado screens: the section wrapper,
// the frozen-column matrix styles and the hover card. Kept apart so Tela 1 and
// Tela 2 stay visually identical without either importing the other.

export const card: React.CSSProperties = {
  border: "1px solid var(--s-border)",
  borderRadius: 14,
  background: "var(--s-card)",
  boxShadow: "var(--s-sh)",
};

export const blockTitle: React.CSSProperties = {
  fontSize: 13.5,
  fontWeight: 800,
  color: "var(--s-t1)",
  letterSpacing: "-.01em",
};

export const nf = new Intl.NumberFormat("pt-BR");

export function ptBr(iso: string): string {
  return iso.split("-").reverse().join("/");
}

/** Section wrapper: a dot, a title, an optional note and the block's controls. */
export function Block({
  title,
  note,
  actions,
  children,
}: {
  title: string;
  note?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section style={card}>
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 10,
          padding: "12px 14px",
          borderBottom: "1px solid var(--s-border)",
        }}
      >
        <span
          style={{ flex: "none", width: 7, height: 7, borderRadius: 999, background: "var(--s-brand)" }}
        />
        <h2 className="font-display" style={blockTitle}>
          {title}
        </h2>
        {note && <span style={{ fontSize: 11, color: "var(--s-t3)" }}>{note}</span>}
        <div style={{ marginLeft: "auto", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {actions}
        </div>
      </header>
      <div style={{ padding: 14 }}>{children}</div>
    </section>
  );
}

export const tooltipPanel: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  padding: "7px 10px",
  borderRadius: 10,
  background: "var(--s-t1)",
  boxShadow: "var(--s-sh-2)",
};

export const tooltipTitle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "var(--s-page)",
  opacity: 0.75,
};

export const tooltipLine: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "var(--s-page)",
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
};

/** Freezes a matrix column at `left`, at a width the header and body agree on. */
export function stickyCol(left: number, width: number): React.CSSProperties {
  return {
    position: "sticky",
    left,
    zIndex: 1,
    width,
    minWidth: width,
    maxWidth: width,
  };
}

export const matrizTh: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 2,
  background: "var(--s-card)",
  borderBottom: "1px solid var(--s-border)",
  // The matrix is read column by column, so it carries a full grid — the
  // horizontal rule alone leaves a wide row of numbers with nothing to track.
  borderRight: "1px solid var(--s-border)",
  padding: "7px 6px",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: ".06em",
  textTransform: "uppercase",
  color: "var(--s-t3)",
  textAlign: "center",
  whiteSpace: "nowrap",
};

export const matrizTd: React.CSSProperties = {
  padding: "5px 6px",
  borderBottom: "1px solid var(--s-border)",
  borderRight: "1px solid var(--s-border)",
  whiteSpace: "nowrap",
};

/**
 * Every subject gets these four service rows, empty ones included, so the grid
 * keeps a constant height per subject.
 */
export const SERVICO_ROWS = ["INTERNET", "FWA", "5G", "RENOVACAO"];

export const SERVICO_LABEL: Record<string, string> = {
  INTERNET: "FTTH",
  FWA: "FWA",
  "5G": "5G",
  RENOVACAO: "Renovação",
  RENOVAÇÃO: "Renovação",
};
