"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { Check, ChevronDown } from "lucide-react";

export interface SelectOption {
  id: number;
  label: string;
  hint?: string;
}

/**
 * Reference-field select (DESIGN_SYSTEM §5): a button that opens a list with a
 * check on the current value — never a grid of chips. Auto-adds a search box past
 * 7 options (accent-insensitive), matching the filter chip rule (§4.1). Value is
 * the option id, or null for "none".
 */
export function AdminSelect({
  label,
  value,
  options,
  onChange,
  placeholder = "Selecionar…",
  noneLabel,
}: {
  label: string;
  value: number | null;
  options: SelectOption[];
  onChange: (id: number | null) => void;
  placeholder?: string;
  /** When set, a "none" row is offered that clears the value to null. */
  noneLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((o) => o.id === value) ?? null;
  const searchable = options.length > 7;

  const filtered = useMemo(() => {
    if (!query.trim()) return options;

    const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const q = norm(query);

    return options.filter((o) => norm(o.label).includes(q));
  }, [options, query]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  return (
    <div style={{ position: "relative" }}>
      <span
        style={{
          display: "block",
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: ".06em",
          textTransform: "uppercase",
          color: "var(--s-t3)",
          marginBottom: 6,
        }}
      >
        {label}
      </span>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          height: 40,
          padding: "0 12px",
          borderRadius: 10,
          border: "1px solid var(--s-border)",
          background: "var(--s-sunken)",
          color: selected ? "var(--s-t1)" : "var(--s-t3)",
          font: "inherit",
          fontSize: 13.5,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        <span
          style={{
            flex: 1,
            minWidth: 0,
            textAlign: "left",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={15} style={{ flex: "none", color: "var(--s-t3)" }} />
      </button>

      {open && (
        <>
          <div onClick={close} style={{ position: "fixed", inset: 0, zIndex: 90 }} />
          <div
            style={{
              position: "absolute",
              zIndex: 91,
              top: "calc(100% + 6px)",
              left: 0,
              right: 0,
              maxHeight: 260,
              overflowY: "auto",
              padding: 6,
              background: "var(--s-card)",
              border: "1px solid var(--s-border)",
              borderRadius: 12,
              boxShadow: "var(--s-sh-2)",
              animation: "bdIn .13s ease both",
            }}
          >
            {searchable && (
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar…"
                style={{
                  width: "100%",
                  height: 34,
                  padding: "0 10px",
                  marginBottom: 6,
                  borderRadius: 8,
                  border: "1px solid var(--s-border)",
                  background: "var(--s-sunken)",
                  color: "var(--s-t1)",
                  font: "inherit",
                  fontSize: 12.5,
                  outline: "none",
                }}
              />
            )}
            {noneLabel && (
              <Row
                selected={value === null}
                onClick={() => {
                  onChange(null);
                  close();
                }}
              >
                <span style={{ color: "var(--s-t3)" }}>{noneLabel}</span>
              </Row>
            )}
            {filtered.map((o) => (
              <Row
                key={o.id}
                selected={o.id === value}
                onClick={() => {
                  onChange(o.id);
                  close();
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {o.label}
                  </span>
                  {o.hint && (
                    <span style={{ display: "block", fontSize: 10.5, color: "var(--s-t3)" }}>{o.hint}</span>
                  )}
                </span>
              </Row>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--s-t3)" }}>Nada encontrado.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Row({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const style: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    textAlign: "left",
    minHeight: 36,
    padding: "0 10px",
    border: 0,
    borderRadius: 9,
    background: selected ? "var(--s-brand-weak)" : "transparent",
    color: selected ? "var(--s-brand)" : "var(--s-t1)",
    font: "inherit",
    fontSize: 13,
    fontWeight: selected ? 800 : 600,
    cursor: "pointer",
  };

  return (
    <button type="button" onClick={onClick} className="bd-menuitem" style={style}>
      {children}
      <Check size={15} style={{ flex: "none", opacity: selected ? 1 : 0, color: "var(--s-brand)" }} />
    </button>
  );
}
