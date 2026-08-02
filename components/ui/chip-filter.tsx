"use client";

import { forwardRef, useState, type CSSProperties } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Command as CommandPrimitive } from "cmdk";
import { Check, ChevronDown, RotateCcw, Search, X } from "lucide-react";
import { useIsMobile } from "@/lib/hooks/use-media-query";

/**
 * Chip-select filter (DESIGN_SYSTEM §4.1).
 *
 * A 40px chip (eyebrow + value + chevron) that opens the dimension's options:
 * an anchored popover on desktop, a bottom sheet on mobile — never a full-screen
 * modal on desktop. A search box appears automatically past 7 options and
 * matches accent-insensitively (NFD + strip diacritics). "Dirty" (value ≠
 * default) turns the chip brand-orange.
 *
 * Built on Radix Popover/Dialog + cmdk restyled with the `--s-*` tokens; state
 * lives in the parent (the screen's filter set), this is presentational.
 */
export interface ChipFilterProps {
  label: string;
  value: string;
  options: string[];
  /** Default value — the chip is "dirty" (orange) whenever `value` differs. */
  defaultValue: string;
  onChange: (value: string) => void;
  /** Right-align the popover for the last chips in a row (avoids overflow). */
  align?: "start" | "end";
}

const AUTO_SEARCH_THRESHOLD = 7;

/** Accent- and case-insensitive normalisation for search (prototype `norm`). */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function ChipFilter({
  label,
  value,
  options,
  defaultValue,
  onChange,
  align = "start",
}: ChipFilterProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const dirty = value !== defaultValue;

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  if (isMobile) {
    return (
      <>
        <FilterChipTrigger
          label={label}
          value={value}
          dirty={dirty}
          open={open}
          onClick={() => setOpen(true)}
        />
        <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 80,
                background: "rgba(15,15,26,.45)",
                backdropFilter: "blur(3px)",
                animation: "bdFade .2s ease both",
              }}
            />
            <DialogPrimitive.Content
              aria-label={label}
              style={{
                position: "fixed",
                insetInline: 0,
                bottom: 0,
                zIndex: 81,
                maxHeight: "88%",
                display: "flex",
                flexDirection: "column",
                background: "var(--s-card)",
                borderRadius: "22px 22px 0 0",
                boxShadow: "var(--s-sh-2)",
                animation: "bdSheet .24s cubic-bezier(.2,.9,.3,1) both",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "16px 16px 10px",
                }}
              >
                <div>
                  <div style={eyebrowStyle}>{label}</div>
                  <DialogPrimitive.Title
                    className="font-display"
                    style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-.02em", color: "var(--s-t1)" }}
                  >
                    {value}
                  </DialogPrimitive.Title>
                </div>
                <DialogPrimitive.Close aria-label="Fechar" style={closeBtnStyle}>
                  <X size={15} />
                </DialogPrimitive.Close>
              </div>
              <OptionList options={options} value={value} onPick={pick} padded />
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </>
    );
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <FilterChipTrigger label={label} value={value} dirty={dirty} open={open} />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align={align}
          sideOffset={6}
          style={{
            zIndex: 50,
            minWidth: 220,
            maxWidth: 280,
            maxHeight: 300,
            overflowY: "auto",
            padding: 6,
            background: "var(--s-card)",
            border: "1px solid var(--s-border)",
            borderRadius: 12,
            boxShadow: "var(--s-sh-2)",
            animation: "bdIn .14s ease both",
          }}
        >
          <OptionList options={options} value={value} onPick={pick} />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/**
 * The 40px chip trigger (eyebrow + value + chevron). forwardRef so Radix can
 * use it as `asChild`. Exported so the date filter can share the exact chrome.
 */
export const FilterChipTrigger = forwardRef<
  HTMLButtonElement,
  { label: string; value: string; dirty: boolean; open: boolean; onClick?: () => void }
>(function FilterChipTrigger({ label, value, dirty, open, onClick, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-expanded={open}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: 40,
        padding: "0 12px",
        border: `1px solid ${dirty ? "var(--s-brand)" : "var(--s-border)"}`,
        borderRadius: 10,
        background: dirty ? "var(--s-brand-weak)" : "var(--s-card)",
        cursor: "pointer",
        font: "inherit",
        textAlign: "left",
        transition: ".16s",
      }}
      {...rest}
    >
      <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
        <span style={eyebrowStyle}>{label}</span>
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 700,
            color: dirty ? "var(--s-brand)" : "var(--s-t1)",
            maxWidth: 120,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {value}
        </span>
      </span>
      <ChevronDown size={13} strokeWidth={2.2} style={{ color: "var(--s-t3)", flex: "none" }} />
    </button>
  );
});

/** Searchable option list shared by the popover and the sheet. */
function OptionList({
  options,
  value,
  onPick,
  padded = false,
}: {
  options: string[];
  value: string;
  onPick: (v: string) => void;
  padded?: boolean;
}) {
  const [query, setQuery] = useState("");
  const searchable = options.length > AUTO_SEARCH_THRESHOLD;
  const shownCount = query ? options.filter((o) => norm(o).includes(norm(query))).length : options.length;

  return (
    <CommandPrimitive
      loop
      filter={(val, search) => (norm(val).includes(norm(search)) ? 1 : 0)}
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        padding: padded ? "0 10px 14px" : 0,
      }}
    >
      {searchable && (
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
          <CommandPrimitive.Input
            value={query}
            onValueChange={setQuery}
            placeholder="Buscar..."
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
          <span style={{ flex: "none", fontSize: 10, fontWeight: 700, color: "var(--s-t3)" }}>
            {shownCount}/{options.length}
          </span>
        </div>
      )}
      <CommandPrimitive.List style={{ overflowY: "auto", maxHeight: 240 }}>
        <CommandPrimitive.Empty
          style={{ padding: "18px 8px", textAlign: "center", fontSize: 12, color: "var(--s-t3)" }}
        >
          Nada encontrado
        </CommandPrimitive.Empty>
        {options.map((o) => {
          const active = o === value;

          return (
            <CommandPrimitive.Item
              key={o}
              value={o}
              onSelect={() => onPick(o)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                width: "100%",
                minHeight: 36,
                padding: "0 10px",
                borderRadius: 8,
                background: active ? "var(--s-brand-weak)" : "transparent",
                color: active ? "var(--s-brand)" : "var(--s-t1)",
                fontSize: 13,
                fontWeight: active ? 800 : 600,
                cursor: "pointer",
              }}
            >
              <Check size={14} strokeWidth={2.6} style={{ flex: "none", opacity: active ? 1 : 0 }} />
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {o}
              </span>
            </CommandPrimitive.Item>
          );
        })}
      </CommandPrimitive.List>
    </CommandPrimitive>
  );
}

/**
 * "Limpar (n)" button for the filter bar (DESIGN_SYSTEM §4.1). Shows the count
 * of dirty dimensions; disabled/hidden by the caller when the count is 0.
 */
export function FilterClearButton({ count, onClear }: { count: number; onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      style={{
        flex: "none",
        display: "flex",
        alignItems: "center",
        gap: 6,
        height: 40,
        padding: "0 13px",
        border: "1px dashed var(--s-border-2)",
        borderRadius: 10,
        background: "transparent",
        color: "var(--s-t3)",
        font: "inherit",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      <RotateCcw size={13} strokeWidth={2.2} />
      {count > 0 ? `Limpar (${count})` : "Limpar"}
    </button>
  );
}

const eyebrowStyle: CSSProperties = {
  fontSize: 8.5,
  fontWeight: 700,
  letterSpacing: ".1em",
  textTransform: "uppercase",
  color: "var(--s-t3)",
};

const closeBtnStyle: CSSProperties = {
  flex: "none",
  display: "grid",
  placeItems: "center",
  width: 34,
  height: 34,
  borderRadius: 999,
  border: "1px solid var(--s-border)",
  background: "var(--s-sunken)",
  color: "var(--s-t2)",
  cursor: "pointer",
};
