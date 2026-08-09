"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Check, ChevronDown, Loader2, Search } from "lucide-react";

export interface AsyncOption {
  /** Stable identity returned to the caller on select. */
  value: string;
  /** Primary line (e.g. the person's name). */
  label: string;
  /** Muted secondary line (e.g. the e-mail). */
  hint?: string;
}

/**
 * Reference-field select backed by a **server-side search** (DESIGN_SYSTEM §5),
 * for lists too large to ship to the client (e.g. the corporate hierarchy). The
 * caller provides `search(query)` — expected to return a bounded slice (max 100).
 * Typing debounces and re-queries; an empty query loads the first slice. Reusable
 * anywhere a "pick one from a big remote table" control is needed.
 */
export function AsyncSelect({
  label,
  value,
  onChange,
  search,
  placeholder = "Selecionar…",
  searchPlaceholder = "Digite para buscar…",
  emptyText = "Nada encontrado.",
  limit = 100,
  limitNote,
  autoFocus,
}: {
  label: string;
  value: AsyncOption | null;
  onChange: (option: AsyncOption | null) => void;
  search: (query: string) => Promise<AsyncOption[]>;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Slice size the search returns; drives the "showing first N" note. */
  limit?: number;
  /** Note shown when the result set is capped. Defaults to a pt-BR message. */
  limitNote?: string;
  autoFocus?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AsyncOption[]>([]);
  const [loading, setLoading] = useState(false);
  // Guards against out-of-order responses: only the latest request may commit.
  const reqId = useRef(0);

  const runSearch = useCallback(
    async (q: string) => {
      const id = ++reqId.current;

      setLoading(true);

      try {
        const rows = await search(q);

        if (id === reqId.current) setResults(rows);
      } catch {
        if (id === reqId.current) setResults([]);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [search],
  );

  // Load the first slice up front (empty query, immediate) and re-search as the
  // user types (debounced) — independent of the open state, so the 100 are ready
  // before the dropdown is even opened.
  useEffect(() => {
    const t = setTimeout(() => runSearch(query), query ? 250 : 0);

    return () => clearTimeout(t);
  }, [query, runSearch]);

  const close = () => setOpen(false);

  const capped = !loading && results.length >= limit;

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
          color: value ? "var(--s-t1)" : "var(--s-t3)",
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
          {value ? value.label : placeholder}
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
              maxHeight: 320,
              display: "flex",
              flexDirection: "column",
              padding: 6,
              background: "var(--s-card)",
              border: "1px solid var(--s-border)",
              borderRadius: 12,
              boxShadow: "var(--s-sh-2)",
              animation: "bdIn .13s ease both",
            }}
          >
            <div style={{ position: "relative", marginBottom: 6 }}>
              <Search
                size={14}
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--s-t3)",
                }}
              />
              <input
                autoFocus={autoFocus ?? true}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                style={{
                  width: "100%",
                  height: 34,
                  padding: "0 30px 0 30px",
                  borderRadius: 8,
                  border: "1px solid var(--s-border)",
                  background: "var(--s-sunken)",
                  color: "var(--s-t1)",
                  font: "inherit",
                  fontSize: 12.5,
                  outline: "none",
                }}
              />
              {loading && (
                <Loader2
                  size={14}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: 10,
                    color: "var(--s-t3)",
                    animation: "bdSpin .8s linear infinite",
                  }}
                />
              )}
            </div>

            <div style={{ overflowY: "auto", minHeight: 0 }}>
              {results.map((o) => (
                <Row
                  key={o.value}
                  selected={o.value === value?.value}
                  onClick={() => {
                    onChange(o);
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
                      <span
                        style={{
                          display: "block",
                          fontSize: 10.5,
                          color: "var(--s-t3)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {o.hint}
                      </span>
                    )}
                  </span>
                </Row>
              ))}

              {!loading && results.length === 0 && (
                <div style={{ padding: "12px", fontSize: 12, color: "var(--s-t3)" }}>{emptyText}</div>
              )}
            </div>

            {capped && (
              <div
                style={{
                  marginTop: 6,
                  paddingTop: 6,
                  borderTop: "1px solid var(--s-border)",
                  fontSize: 10.5,
                  color: "var(--s-t3)",
                }}
              >
                {limitNote ?? `Mostrando os ${limit} primeiros — refine a busca para ver mais.`}
              </div>
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
  children: ReactNode;
}) {
  const style: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    textAlign: "left",
    minHeight: 40,
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
