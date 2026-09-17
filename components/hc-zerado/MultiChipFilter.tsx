"use client";

import { useMemo, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, Search, X } from "lucide-react";
import { FilterChipTrigger } from "@/components/ui/chip-filter";
import { useIsMobile } from "@/lib/hooks/use-media-query";

const AUTO_SEARCH_THRESHOLD = 7;

/** Accent- and case-insensitive normalisation for search. */
function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Multi-select sibling of `ChipFilter` (DESIGN_SYSTEM §4.2).
 *
 * Shares the exact 40px chip trigger and popover chrome; the difference is that
 * it keeps a set of values, which the HC Zerado filter panel needs — the
 * original screens let a user pick several gerências, canais or serviços at once.
 */
export function MultiChipFilter({
  label,
  values,
  options,
  onChange,
  align = "start",
  maxVisible,
}: {
  label: string;
  values: string[];
  options: string[];
  onChange: (values: string[]) => void;
  align?: "start" | "end";
  maxVisible?: number;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const summary =
    values.length === 0 ? "Todos" : values.length === 1 ? values[0] : `${values.length} selecionados`;

  const toggle = (option: string) => {
    const next = new Set(values);

    if (next.has(option)) next.delete(option);
    else next.add(option);

    onChange([...next]);
  };

  const list = (
    <OptionList
      options={options}
      values={values}
      onToggle={toggle}
      onAll={() => onChange([])}
      maxVisible={maxVisible}
      padded={isMobile}
    />
  );

  if (isMobile) {
    return (
      <>
        <FilterChipTrigger
          label={label}
          value={summary}
          dirty={values.length > 0}
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
                  <div
                    style={{
                      fontSize: 8.5,
                      fontWeight: 700,
                      letterSpacing: ".1em",
                      textTransform: "uppercase",
                      color: "var(--s-t3)",
                    }}
                  >
                    {label}
                  </div>
                  <DialogPrimitive.Title
                    className="font-display"
                    style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-.02em", color: "var(--s-t1)" }}
                  >
                    {summary}
                  </DialogPrimitive.Title>
                </div>
                <DialogPrimitive.Close
                  aria-label="Fechar"
                  style={{
                    display: "grid",
                    placeItems: "center",
                    width: 34,
                    height: 34,
                    borderRadius: 999,
                    border: "1px solid var(--s-border)",
                    background: "var(--s-card)",
                    color: "var(--s-t2)",
                  }}
                >
                  <X size={15} />
                </DialogPrimitive.Close>
              </div>
              {list}
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </>
    );
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <FilterChipTrigger label={label} value={summary} dirty={values.length > 0} open={open} />
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
          {list}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

function OptionList({
  options,
  values,
  onToggle,
  onAll,
  maxVisible,
  padded,
}: {
  options: string[];
  values: string[];
  onToggle: (option: string) => void;
  onAll: () => void;
  maxVisible?: number;
  padded?: boolean;
}) {
  const [busca, setBusca] = useState("");
  const withSearch = options.length >= AUTO_SEARCH_THRESHOLD;
  const selectedValues = useMemo(() => new Set(values), [values]);
  const visible = useMemo(() => {
    const term = norm(busca.trim());
    const filtered = term ? options.filter((o) => norm(o).includes(term)) : options;

    return maxVisible ? filtered.slice(0, maxVisible) : filtered;
  }, [options, busca, maxVisible]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        padding: padded ? "0 10px 14px" : undefined,
      }}
    >
      {withSearch && (
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
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar..."
            aria-label="Buscar opção"
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
            {visible.length}/{options.length}
          </span>
        </div>
      )}
      <button
        type="button"
        onClick={onAll}
        style={{
          ...itemStyle(values.length === 0),
          justifyContent: "space-between",
        }}
      >
        Todos
        {values.length === 0 && <Check size={13} />}
      </button>
      <div style={{ overflowY: "auto", minHeight: 0 }}>
        {visible.map((option) => {
          const ativo = selectedValues.has(option);

          return (
            <button
              key={option}
              type="button"
              onClick={() => onToggle(option)}
              style={{ ...itemStyle(ativo), justifyContent: "space-between" }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {option}
              </span>
              {ativo && <Check size={13} style={{ flex: "none" }} />}
            </button>
          );
        })}
        {visible.length === 0 && (
          <div style={{ padding: "8px 9px", fontSize: 12, color: "var(--s-t3)" }}>Nada encontrado.</div>
        )}
      </div>
    </div>
  );
}

function itemStyle(ativo: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    minHeight: 34,
    padding: "0 9px",
    border: 0,
    borderRadius: 9,
    background: ativo ? "var(--s-brand-weak)" : "transparent",
    color: ativo ? "var(--s-brand)" : "var(--s-t2)",
    font: "inherit",
    fontSize: 12.5,
    fontWeight: ativo ? 800 : 600,
    textAlign: "left",
    cursor: "pointer",
  };
}
