"use client";

import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

const ALL = "__all__";

/**
 * Labeled dropdown for a dimension filter. An empty value ("") renders as
 * "Todos" and selecting "Todos" clears the filter. Backed by a searchable
 * Combobox so long lists (e.g. cidades) can be typed into. `triggerClassName`
 * lets a caller tune the trigger (e.g. min-width) without re-styling the whole
 * control.
 */
export function FilterSelect({
  label,
  value,
  options,
  onChange,
  triggerClassName,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  triggerClassName?: string;
}) {
  const comboOptions: ComboboxOption[] = [
    { value: ALL, label: "Todos" },
    ...options.map((o) => ({ value: o, label: o })),
  ];

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
        {label}
      </label>
      <Combobox
        value={value || ALL}
        onChange={(v) => onChange(v === ALL ? "" : v)}
        options={comboOptions}
        aria-label={label}
        searchPlaceholder={`Buscar ${label.toLowerCase()}…`}
        triggerClassName={cn("min-w-[130px] bg-secondary/60", triggerClassName)}
      />
    </div>
  );
}
