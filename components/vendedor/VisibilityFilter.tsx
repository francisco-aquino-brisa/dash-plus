"use client";

import { Check, SlidersHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface Visibility {
  FTTH: boolean;
  FWA: boolean;
  "5G": boolean;
  Banda: boolean;
  diasZerados: boolean;
  rankings: boolean;
  mix: boolean;
}

const GROUPS: { title: string; keys: (keyof Visibility)[]; labels: Record<string, string> }[] = [
  {
    title: "Serviços",
    keys: ["FTTH", "FWA", "5G", "Banda"],
    labels: { FTTH: "FTTH", FWA: "FWA", "5G": "5G", Banda: "Banda" },
  },
  {
    title: "Seções",
    keys: ["diasZerados", "rankings", "mix"],
    labels: { diasZerados: "Dias Zerados", rankings: "Rankings", mix: "Mix de Vendas" },
  },
];

export function VisibilityFilter({
  value,
  onChange,
}: {
  value: Visibility;
  onChange: (v: Visibility) => void;
}) {
  const toggle = (k: keyof Visibility) => onChange({ ...value, [k]: !value[k] });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="shadow-elegant grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-card/60 text-muted-foreground backdrop-blur transition-colors hover:border-primary/40 hover:text-foreground"
          aria-label="Filtrar visualização"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56" align="end">
        <p className="mb-2 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
          Exibir na tela
        </p>
        <div className="space-y-3">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <div className="mb-1 text-[10px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
                {g.title}
              </div>
              <div className="space-y-1">
                {g.keys.map((k) => (
                  <button
                    key={k}
                    onClick={() => toggle(k)}
                    className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm transition-colors hover:bg-secondary"
                  >
                    <span
                      className={cn(
                        "grid h-4 w-4 shrink-0 place-items-center rounded border",
                        value[k]
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card",
                      )}
                    >
                      {value[k] && <Check className="h-3 w-3" />}
                    </span>
                    <span className={cn(value[k] ? "text-foreground" : "text-muted-foreground")}>
                      {g.labels[k]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
