"use client";

import { Check, Lock, SlidersHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface PickerOption {
  id: string;
  label: string;
  available: boolean;
}

/**
 * Per-block indicator selector: a "Indicadores (n)" button that opens a popover
 * with the full catalog as toggles. Blocked indicators stay selectable (they
 * render as "sem acesso") but are visually flagged.
 */
export function IndicatorPicker({
  options,
  selected,
  onChange,
}: {
  options: PickerOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const selectedSet = new Set(selected);
  const toggle = (id: string) => {
    const next = new Set(selectedSet);

    if (next.has(id)) next.delete(id);
    else next.add(id);

    // Preserve catalog order for stable card layout.
    onChange(options.filter((o) => next.has(o.id)).map((o) => o.id));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md border border-border bg-secondary/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Indicadores ({selected.length})
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-[360px] w-72 overflow-y-auto p-1.5">
        <div className="px-2 py-1.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
          Selecione os indicadores
        </div>
        {options.map((o) => {
          const on = selectedSet.has(o.id);

          return (
            <button
              key={o.id}
              type="button"
              onClick={() => toggle(o.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-secondary/60",
                on ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "grid h-4 w-4 shrink-0 place-items-center rounded border",
                  on ? "border-primary bg-primary text-primary-foreground" : "border-border",
                )}
              >
                {on && <Check className="h-3 w-3" />}
              </span>
              <span className="flex-1">{o.label}</span>
              {!o.available && <Lock className="h-3 w-3 shrink-0 text-muted-foreground/60" />}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
