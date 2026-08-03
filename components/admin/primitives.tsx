"use client";

import type { CSSProperties, ReactNode } from "react";
import { Pencil, Search, Trash2 } from "lucide-react";
import type { ChipTone } from "@/lib/data/admin/derive";

/** Small coloured pill used for níveis, status and página references. */
export function Chip({ tone, children }: { tone: ChipTone; children: ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 9px",
        borderRadius: "var(--r-pill)",
        background: tone.bg,
        color: tone.fg,
        fontSize: 11,
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

/** "Padrão" badge shown in place of actions for a locked (seeded) record. */
export function LockedBadge() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: "var(--r-pill)",
        border: "1px solid var(--s-border)",
        background: "var(--s-sunken)",
        color: "var(--s-t3)",
        fontSize: 10.5,
        fontWeight: 800,
        letterSpacing: ".02em",
      }}
    >
      Padrão
    </span>
  );
}

function iconBtn(danger = false): CSSProperties {
  return {
    display: "grid",
    placeItems: "center",
    width: 32,
    height: 32,
    borderRadius: 9,
    border: "1px solid var(--s-border)",
    background: "var(--s-card)",
    color: danger ? "var(--s-bad)" : "var(--s-t2)",
    cursor: "pointer",
    transition: ".16s",
  };
}

/** Edit + delete actions for a table row, or the "Padrão" badge when locked. */
export function RowActions({
  locked,
  onEdit,
  onDelete,
}: {
  locked?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  if (locked) return <LockedBadge />;

  return (
    <span style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end" }}>
      <button type="button" className="bd-ghost" aria-label="Editar" style={iconBtn()} onClick={onEdit}>
        <Pencil size={14} />
      </button>
      <button
        type="button"
        className="bd-ghost"
        aria-label="Excluir"
        style={iconBtn(true)}
        onClick={onDelete}
      >
        <Trash2 size={14} />
      </button>
    </span>
  );
}

// ── Buttons ───────────────────────────────────────────────────────────────────

const baseBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  height: 40,
  padding: "0 16px",
  borderRadius: 11,
  font: "inherit",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
  transition: ".16s",
  whiteSpace: "nowrap",
};

export function PrimaryButton({
  children,
  onClick,
  type = "button",
  disabled,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  style?: CSSProperties;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...baseBtn,
        border: "1px solid transparent",
        background: "var(--bn-gradient-orange)",
        color: "#fff",
        boxShadow: "0 6px 16px -8px rgba(229,48,1,.6)",
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  disabled,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="bd-ghost"
      style={{
        ...baseBtn,
        border: "1px solid var(--s-border)",
        background: "var(--s-card)",
        color: "var(--s-t2)",
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function DangerButton({
  children,
  onClick,
  disabled,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...baseBtn,
        border: "1px solid transparent",
        background: "var(--s-bad)",
        color: "#fff",
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// ── Form fields ───────────────────────────────────────────────────────────────

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: ".06em",
  textTransform: "uppercase",
  color: "var(--s-t3)",
  marginBottom: 6,
};

const controlStyle: CSSProperties = {
  width: "100%",
  height: 40,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid var(--s-border)",
  background: "var(--s-sunken)",
  color: "var(--s-t1)",
  font: "inherit",
  fontSize: 13.5,
  fontWeight: 600,
  outline: "none",
};

export function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
  mono,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: ReactNode;
  mono?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <label style={{ display: "block" }}>
      <span style={labelStyle}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        style={{
          ...controlStyle,
          fontFamily: mono ? "var(--font-mono, ui-monospace, monospace)" : undefined,
        }}
      />
      {hint && (
        <span style={{ display: "block", marginTop: 6, fontSize: 11.5, color: "var(--s-t3)" }}>{hint}</span>
      )}
    </label>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label style={{ display: "block" }}>
      <span style={labelStyle}>{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        style={{ ...controlStyle, height: "auto", padding: "10px 12px", resize: "vertical", lineHeight: 1.5 }}
      />
    </label>
  );
}

/** Search input used in the header of every list screen. */
export function SearchInput({
  value,
  onChange,
  placeholder = "Buscar…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
      <Search
        size={16}
        style={{
          position: "absolute",
          left: 14,
          top: "50%",
          transform: "translateY(-50%)",
          color: "var(--s-t3)",
        }}
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          height: 44,
          padding: "0 14px 0 38px",
          borderRadius: 12,
          border: "1px solid var(--s-border)",
          background: "var(--s-card)",
          color: "var(--s-t1)",
          font: "inherit",
          fontSize: 13.5,
          fontWeight: 600,
          outline: "none",
        }}
      />
    </div>
  );
}

/** The card container that wraps a screen's table/matrix. */
export function Panel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        border: "1px solid var(--s-border)",
        borderRadius: "var(--r-card)",
        background: "var(--s-card)",
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
