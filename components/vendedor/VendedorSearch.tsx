"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search, UserRound } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { VendedorOption } from "@/lib/data/vendedor/types";

/** Searchable vendedor picker (client-side filter by nome/matrícula). The
 *  primary filter of the screen — a token-styled pill matching the filter bar. */
export function VendedorSearch({
  options,
  value,
  onSelect,
}: {
  options: VendedorOption[];
  value: string;
  onSelect: (matricula: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(() => options.find((o) => String(o.matricula) === value), [options, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return options.slice(0, 60);

    return options
      .filter((o) => o.nome.toLowerCase().includes(q) || String(o.matricula).includes(q))
      .slice(0, 60);
  }, [options, query]);

  const dirty = !!selected;

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
              {selected ? selected.nome : "Buscar vendedor…"}
            </span>
          </span>
          <ChevronsUpDown size={14} style={{ flex: "none", color: "var(--s-t3)" }} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-2rem)] p-0 sm:w-80" align="start">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nome ou matrícula…"
            className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Nenhum vendedor encontrado.</p>
          )}
          {filtered.map((o) => {
            const isSel = String(o.matricula) === value;

            return (
              <button
                key={o.matricula}
                type="button"
                onClick={() => {
                  onSelect(String(o.matricula));
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-secondary",
                  isSel && "bg-primary/10",
                )}
              >
                <Check className={cn("h-4 w-4 shrink-0", isSel ? "text-primary" : "text-transparent")} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">{o.nome}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    Matrícula {o.matricula} · {o.cidade}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
