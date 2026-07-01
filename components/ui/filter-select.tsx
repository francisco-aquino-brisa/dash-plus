"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const ALL = "__all__";

/**
 * Labeled dropdown for a dimension filter. An empty value ("") renders as
 * "Todos" and selecting "Todos" clears the filter. `triggerClassName` lets a
 * caller tune the trigger (e.g. min-width) without re-styling the whole control.
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
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</label>
      <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? "" : v)}>
        <SelectTrigger className={cn("h-9 min-w-[130px] bg-secondary/60 text-sm", triggerClassName)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos</SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
