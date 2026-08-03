"use client";

import { Check, SlidersHorizontal } from "lucide-react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

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

/**
 * "Exibir" control (legacy VisibilityFilter, kept per the user's decision to keep
 * the legacy controls): toggles which service cards and which sections are shown.
 * Restyled with `--s-*` tokens to match the filter bar.
 */
export function VisibilityFilter({
  value,
  onChange,
}: {
  value: Visibility;
  onChange: (v: Visibility) => void;
}) {
  const toggle = (k: keyof Visibility) => onChange({ ...value, [k]: !value[k] });
  const hidden = (Object.keys(value) as (keyof Visibility)[]).filter((k) => !value[k]).length;

  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label="Exibir na tela"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            minHeight: 40,
            padding: "0 12px",
            border: `1px solid ${hidden > 0 ? "var(--s-brand)" : "var(--s-border)"}`,
            borderRadius: 999,
            background: hidden > 0 ? "var(--s-brand-weak)" : "var(--s-card)",
            color: hidden > 0 ? "var(--s-brand)" : "var(--s-t2)",
            font: "inherit",
            fontSize: 11.5,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          <SlidersHorizontal size={14} strokeWidth={2.2} />
          Exibir{hidden > 0 ? ` (${hidden} oculto${hidden > 1 ? "s" : ""})` : ""}
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={6}
          style={{
            zIndex: 50,
            width: 224,
            padding: 8,
            background: "var(--s-card)",
            border: "1px solid var(--s-border)",
            borderRadius: 12,
            boxShadow: "var(--s-sh-2)",
            animation: "bdIn .14s ease both",
          }}
        >
          <div
            style={{
              padding: "2px 4px 8px",
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "var(--s-t3)",
            }}
          >
            Exibir na tela
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {GROUPS.map((g) => (
              <div key={g.title}>
                <div
                  style={{
                    padding: "0 4px 4px",
                    fontSize: 9.5,
                    fontWeight: 700,
                    letterSpacing: ".08em",
                    textTransform: "uppercase",
                    color: "var(--s-t3)",
                  }}
                >
                  {g.title}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {g.keys.map((k) => {
                    const on = value[k];

                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => toggle(k)}
                        className="bd-menuitem"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 9,
                          width: "100%",
                          minHeight: 34,
                          padding: "0 8px",
                          border: 0,
                          borderRadius: 8,
                          background: "transparent",
                          color: on ? "var(--s-t1)" : "var(--s-t3)",
                          font: "inherit",
                          fontSize: 12.5,
                          fontWeight: on ? 700 : 600,
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <span
                          style={{
                            flex: "none",
                            display: "grid",
                            placeItems: "center",
                            width: 16,
                            height: 16,
                            borderRadius: 5,
                            border: `1px solid ${on ? "var(--s-brand)" : "var(--s-border-2)"}`,
                            background: on ? "var(--s-brand)" : "transparent",
                            color: "#fff",
                          }}
                        >
                          {on && <Check size={11} strokeWidth={3} />}
                        </span>
                        {g.labels[k]}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
