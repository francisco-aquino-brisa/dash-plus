// Presentation primitives shared by the HC Zerado screens: the section wrapper,
// the frozen-column matrix styles and the hover card. Kept apart so Tela 1 and
// Tela 2 stay visually identical without either importing the other.

import { Search } from "lucide-react";
import type { JustificativaStatus } from "@/lib/data/hc-zerado/types";

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

/**
 * Colours for a justification's verdict, shared by Telas 4 and 5 so a day card
 * and its audit card never disagree. "Em Análise" is a warning, not a neutral:
 * a justification nobody has judged is an open item, and the screens exist to
 * close them.
 *
 * Two labels because the origin uses two: on a day card the badge sits next to
 * the date and reads `Análise`, while the audit card and the tab rail spell out
 * whose turn it is (`Pendente gestor`).
 */
export const STATUS_TONE: Record<
  JustificativaStatus,
  { fg: string; bg: string; label: string; short: string }
> = {
  "Em Análise": { fg: "var(--s-warn)", bg: "var(--s-warn-bg)", label: "Pendente gestor", short: "Análise" },
  Aprovado: { fg: "var(--s-ok)", bg: "var(--s-ok-bg)", label: "Aprovado", short: "Aprovado" },
  Rejeitado: { fg: "var(--s-bad)", bg: "var(--s-bad-bg)", label: "Rejeitado", short: "Rejeitado" },
};

/** A day with no justification at all — the state before any of the three above. */
export const SEM_JUSTIFICATIVA = {
  fg: "var(--s-bad)",
  bg: "var(--s-bad-bg)",
  label: "Pendente colab.",
  short: "Pendente",
};

/**
 * Service colours, taken from Tela 1's Totalizadores so one serviço reads the
 * same everywhere in the module. The origin used its own teal/amber/indigo; we
 * keep our palette — the point is that the chips are not all grey, not that they
 * match another app's hues.
 */
export const SERVICO_TONE: Record<string, { fg: string; bg: string }> = {
  INTERNET: { fg: "var(--s-brand)", bg: "var(--s-brand-weak)" },
  FWA: { fg: "var(--s-blue)", bg: "var(--s-blue-bg)" },
  "5G": { fg: "var(--s-ok)", bg: "var(--s-ok-bg)" },
  RENOVACAO: { fg: "var(--s-warn)", bg: "var(--s-warn-bg)" },
  RENOVAÇÃO: { fg: "var(--s-warn)", bg: "var(--s-warn-bg)" },
};

const NEUTRO = { fg: "var(--s-t3)", bg: "var(--s-sunken)" };

export function servicoTone(servico: string): { fg: string; bg: string } {
  return SERVICO_TONE[servico.toUpperCase()] ?? NEUTRO;
}

const WEEKDAYS_SHORT = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];

/**
 * `TER, 01/09` — the origin's day-card heading. The weekday is read with
 * `getUTC*` from a UTC-midnight date: a calendar day must not shift with the
 * reader's zone (CLAUDE.md, "Dates").
 */
export function diaLabel(iso: string): string {
  const weekday = WEEKDAYS_SHORT[new Date(`${iso}T00:00:00Z`).getUTCDay()];

  return `${weekday}, ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** Up to two initials, for the avatar discs both screens draw. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "?";

  return (parts[0][0] + (parts.length > 1 ? parts[1][0] : "")).toUpperCase();
}

/** The module's search box: a pill with a magnifier, filtering the list beside it. */
export function SearchInput({
  value,
  onChange,
  placeholder,
  label = "Buscar",
  width = 150,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label?: string;
  width?: number;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        height: 34,
        padding: "0 12px",
        border: "1px solid var(--s-border)",
        borderRadius: 999,
        background: "var(--s-sunken)",
      }}
    >
      <Search size={13} strokeWidth={2.2} style={{ color: "var(--s-t3)", flex: "none" }} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        style={{
          border: 0,
          background: "none",
          outline: "none",
          font: "inherit",
          fontSize: 12.5,
          color: "var(--s-t1)",
          width,
        }}
      />
    </label>
  );
}
