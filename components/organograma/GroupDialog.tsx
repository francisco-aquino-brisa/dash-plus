"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { OrgPessoaLeaf } from "@/lib/data/organograma/types";

/**
 * The list behind a "+N pessoas" group card. No server round-trip — the
 * people are already in the client's copy of the tree, so this is a client-
 * side filter, not a search.
 */
export function GroupDialog({
  label,
  pessoas,
  onClose,
}: {
  label: string | null;
  pessoas: OrgPessoaLeaf[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();

    if (!term) return pessoas;

    return pessoas.filter(
      (p) => p.nome.toLowerCase().includes(term) || (p.cargo ?? "").toLowerCase().includes(term),
    );
  }, [pessoas, query]);

  return (
    <Dialog open={label != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar por nome ou cargo…"
            className="pl-8"
          />
        </div>
        <div className="-mx-1 max-h-[52vh] overflow-y-auto px-1">
          {filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Nada encontrado.</p>
          )}
          {filtered.map((p) => (
            <div
              key={p.cpf}
              className="flex items-center justify-between gap-3 border-t border-border py-2 first:border-t-0"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{p.nome}</div>
                {p.cargo && <div className="truncate text-xs text-muted-foreground">{p.cargo}</div>}
              </div>
              {p.situacao && p.situacao !== "ATIVO" && (
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  {p.situacao}
                </span>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
