"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search, UserRound } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { VendedorOption } from "@/lib/data/vendedor/types";

/** Searchable vendedor picker (client-side filter by nome/matrícula). */
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

  const selected = useMemo(
    () => options.find((o) => String(o.matricula) === value),
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 60);
    return options
      .filter((o) => o.nome.toLowerCase().includes(q) || String(o.matricula).includes(q))
      .slice(0, 60);
  }, [options, query]);

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
          className="flex w-full items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2.5 text-left text-sm shadow-elegant backdrop-blur transition-colors hover:border-primary/40 sm:w-80"
          aria-label="Selecionar vendedor"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
            <UserRound className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Vendedor</span>
            <span className="block truncate font-medium text-foreground">
              {selected ? selected.nome : "Buscar vendedor…"}
            </span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
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
