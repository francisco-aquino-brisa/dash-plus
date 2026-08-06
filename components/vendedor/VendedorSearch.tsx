"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Search, UserRound } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { searchVendedores } from "@/app/(app)/vendedor/actions";
import type { VendedorOption } from "@/lib/data/vendedor/types";

/**
 * Searchable vendedor picker — the screen's primary filter. Backed by a
 * **server-side search** (max 100) scoped to the competência: the first 100 load
 * up front and typing re-queries, so all ~12k vendedores are reachable without
 * ever shipping the full list. Token-styled pill matching the filter bar.
 */
export function VendedorSearch({
  value,
  selectedLabel,
  competencia,
  onSelect,
}: {
  /** Selected matrícula (as string) — "" when none. */
  value: string;
  /** Name of the selected vendedor (shown on the pill; may be outside the slice). */
  selectedLabel: string;
  /** Competência (yyyy-MM) the search is scoped to. */
  competencia: string;
  onSelect: (matricula: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VendedorOption[]>([]);
  const [loading, setLoading] = useState(false);
  // Only the latest request may commit its results (guards out-of-order responses).
  const reqId = useRef(0);

  const runSearch = useCallback(
    async (q: string) => {
      const id = ++reqId.current;

      setLoading(true);

      try {
        const rows = await searchVendedores(q, competencia);

        if (id === reqId.current) setResults(rows);
      } catch {
        if (id === reqId.current) setResults([]);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [competencia],
  );

  // Preload the first 100 up front; re-search (debounced) as the user types or
  // the competência changes.
  useEffect(() => {
    const t = setTimeout(() => runSearch(query), query ? 250 : 0);

    return () => clearTimeout(t);
  }, [query, runSearch]);

  const dirty = !!value;

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);

        if (o) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Selecionar vendedor"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            width: "100%",
            maxWidth: 340,
            minHeight: 40,
            padding: "0 12px",
            border: `1px solid ${dirty ? "var(--s-brand)" : "var(--s-border)"}`,
            borderRadius: 999,
            background: dirty ? "var(--s-brand-weak)" : "var(--s-card)",
            color: "var(--s-t1)",
            font: "inherit",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <span
            style={{
              flex: "none",
              display: "grid",
              placeItems: "center",
              width: 22,
              height: 22,
              borderRadius: 7,
              background: dirty ? "var(--s-brand)" : "var(--s-sunken)",
              color: dirty ? "#fff" : "var(--s-t3)",
            }}
          >
            <UserRound size={13} />
          </span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span
              style={{
                display: "block",
                fontSize: 8.5,
                fontWeight: 700,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: dirty ? "var(--s-brand)" : "var(--s-t3)",
              }}
            >
              Vendedor
            </span>
            <span
              style={{
                display: "block",
                fontSize: 12.5,
                fontWeight: 700,
                color: dirty ? "var(--s-brand)" : "var(--s-t1)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {dirty ? selectedLabel || `Matrícula ${value}` : "Buscar vendedor…"}
            </span>
          </span>
          <ChevronsUpDown size={14} style={{ flex: "none", color: "var(--s-t3)" }} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[calc(100vw-2rem)] sm:w-80"
        align="start"
        sideOffset={6}
        style={{
          padding: 6,
          background: "var(--s-card)",
          border: "1px solid var(--s-border)",
          borderRadius: 12,
          boxShadow: "var(--s-sh-2)",
          color: "var(--s-t1)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            margin: "2px 2px 6px",
            padding: "0 10px",
            height: 36,
            border: "1px solid var(--s-border)",
            borderRadius: 9,
            background: "var(--s-sunken)",
          }}
        >
          <Search size={13} strokeWidth={2.2} style={{ color: "var(--s-t3)", flex: "none" }} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nome ou matrícula…"
            style={{
              flex: 1,
              minWidth: 0,
              border: 0,
              background: "none",
              outline: "none",
              font: "inherit",
              fontSize: 12.5,
              color: "var(--s-t1)",
            }}
          />
          {loading && (
            <Loader2
              size={13}
              style={{ color: "var(--s-t3)", flex: "none", animation: "bdSpin .8s linear infinite" }}
            />
          )}
        </div>
        <div style={{ overflowY: "auto", maxHeight: 264 }}>
          {!loading && results.length === 0 && (
            <div style={{ padding: "18px 8px", textAlign: "center", fontSize: 12, color: "var(--s-t3)" }}>
              Nenhum vendedor encontrado.
            </div>
          )}
          {results.map((o) => {
            const active = String(o.matricula) === value;

            return (
              <button
                key={o.matricula}
                type="button"
                className="bd-menuitem"
                onClick={() => {
                  onSelect(String(o.matricula));
                  setOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  width: "100%",
                  textAlign: "left",
                  minHeight: 44,
                  padding: "0 10px",
                  border: 0,
                  borderRadius: 8,
                  background: active ? "var(--s-brand-weak)" : "transparent",
                  color: active ? "var(--s-brand)" : "var(--s-t1)",
                  font: "inherit",
                  cursor: "pointer",
                }}
              >
                <Check
                  size={14}
                  strokeWidth={2.6}
                  style={{ flex: "none", opacity: active ? 1 : 0, color: "var(--s-brand)" }}
                />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: 13,
                      fontWeight: active ? 800 : 600,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {o.nome}
                  </span>
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
                    Matrícula {o.matricula} · {o.cidade}
                  </span>
                </span>
              </button>
            );
          })}
          {results.length >= 100 && (
            <div style={{ padding: "8px 10px 4px", fontSize: 10.5, fontWeight: 600, color: "var(--s-t3)" }}>
              Mostrando os 100 primeiros — refine a busca para ver mais.
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
