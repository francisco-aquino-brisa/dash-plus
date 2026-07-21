"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export interface ComboboxOption {
  value: string;
  label: string;
  /** Not selectable (rendered muted). */
  disabled?: boolean;
  /** Muted trailing note, e.g. "sem acesso". */
  hint?: string;
}

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  triggerClassName?: string;
  contentClassName?: string;
  disabled?: boolean;
  "aria-label"?: string;
}

/** Diacritic- and case-insensitive so "mossoro" matches "Mossoró". */
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Searchable single-select. Drop-in for the shadcn `Select` when the option
 * list is long enough that typing to filter beats scrolling. The trigger mirrors
 * `SelectTrigger` so the two controls look identical side by side.
 */
export function Combobox({
  value,
  onChange,
  options,
  placeholder = "Selecionar…",
  searchPlaceholder = "Buscar…",
  emptyText = "Nada encontrado.",
  triggerClassName,
  contentClassName,
  disabled,
  "aria-label": ariaLabel,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        aria-label={ariaLabel}
        className={cn(
          "flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-sm ring-offset-background focus:ring-1 focus:ring-ring focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          triggerClassName,
        )}
      >
        <span className={cn("line-clamp-1 text-left", !selected && "text-muted-foreground")}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(
          "w-auto max-w-[min(32rem,90vw)] min-w-[max(220px,var(--radix-popover-trigger-width))] p-0",
          contentClassName,
        )}
      >
        <Command filter={(v, search) => (normalize(v).includes(normalize(search)) ? 1 : 0)}>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  // Include the value so numeric codes (e.g. months) are searchable too.
                  value={`${o.label} ${o.value}`}
                  disabled={o.disabled}
                  onSelect={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("h-4 w-4 shrink-0", o.value === value ? "opacity-100" : "opacity-0")}
                  />
                  <span className="min-w-0 break-words">{o.label}</span>
                  {o.hint ? (
                    <span className="ml-auto pl-2 text-xs text-muted-foreground">{o.hint}</span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
