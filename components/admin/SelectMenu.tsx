"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { Check, ChevronDown } from "lucide-react";

export interface StringOption {
  value: string;
  label: string;
}

/**
 * String-keyed select in the system pattern (mirrors AdminSelect, which is
 * number-keyed): a button that opens a list with a check on the current value —
 * never a native `<select>`. Adds a search box past 7 options (accent-insensitive).
 */
export function SelectMenu({
  label,
  value,
  options,
  onChange,
  placeholder = "Selecionar…",
  disabled = false,
}: {
  label?: string;
  value: string;
  options: StringOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((o) => o.value === value) ?? null;
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
      {label && (
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
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
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
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
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
            {filtered.map((o) => {
              const isSel = o.value === value;
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
                background: isSel ? "var(--s-brand-weak)" : "transparent",
                color: isSel ? "var(--s-brand)" : "var(--s-t1)",
                font: "inherit",
                fontSize: 13,
                fontWeight: isSel ? 800 : 600,
                cursor: "pointer",
              };

              return (
                <button
                  key={o.value}
                  type="button"
                  className="bd-menuitem"
                  style={style}
                  onClick={() => {
                    onChange(o.value);
                    close();
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {o.label}
                  </span>
                  <Check
                    size={15}
                    style={{ flex: "none", opacity: isSel ? 1 : 0, color: "var(--s-brand)" }}
                  />
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--s-t3)" }}>Nada encontrado.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
