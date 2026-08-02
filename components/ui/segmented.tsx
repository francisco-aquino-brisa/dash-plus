"use client";

import type { CSSProperties } from "react";

/**
 * Segmented control / tabs (DESIGN_SYSTEM §4.6).
 *
 * A pill rail on `--s-sunken`; the active item gets `--s-card` + shadow +
 * `--s-brand` text. Used for *view* recortes that are NOT data filters
 * (Todos / Fora da meta / Na meta · Resultados / Pendências · the date-picker
 * mode switch), so its state lives in the screen, not in the filter set.
 */
export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

const SIZE = {
  sm: { fontSize: 11, padding: "5px 10px" },
  md: { fontSize: 12.5, padding: "6px 12px" },
} as const;

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  full = false,
  ariaLabel,
}: {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** `sm` matches the in-card tabs (11px); `md` the standalone recortes. */
  size?: keyof typeof SIZE;
  /** Stretch items to fill the rail (used inside the date popover). */
  full?: boolean;
  ariaLabel?: string;
}) {
  const dims = SIZE[size];

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      style={{
        display: "flex",
        gap: 4,
        padding: 3,
        borderRadius: 999,
        background: "var(--s-sunken)",
        border: "1px solid var(--s-border)",
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        const style: CSSProperties = {
          flex: full ? 1 : "none",
          border: 0,
          cursor: "pointer",
          font: "inherit",
          fontSize: dims.fontSize,
          fontWeight: 700,
          padding: dims.padding,
          borderRadius: 999,
          background: active ? "var(--s-card)" : "transparent",
          color: active ? "var(--s-brand)" : "var(--s-t3)",
          boxShadow: active ? "var(--s-sh)" : "none",
          transition: ".18s",
        };

        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            style={style}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
