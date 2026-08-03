"use client";

import { useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { FilterChipTrigger } from "@/components/ui/chip-filter";
import { Segmented } from "@/components/ui/segmented";

/**
 * Date filter — three modes (DESIGN_SYSTEM §4.2).
 *
 * Every temporal dimension (competência, período) uses this, not a plain list:
 * **Mês** (12-month grid + year nav), **Dia** (calendar) and **Intervalo**
 * (pick start then end). It is the one filter that opens in a popover even on
 * mobile — a calendar doesn't fit a bottom-sheet list.
 *
 * Mês is hand-rolled (a 12-cell grid isn't react-day-picker's model); Dia and
 * Intervalo reuse the shared `Calendar` (react-day-picker) restyled by tokens.
 * Output formats: `Jul/26` · `14/07/2026` · `27/06 – 26/07/2026`.
 */
export type DateMode = "mes" | "dia" | "intervalo";

const MN = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MODES: { value: DateMode; label: string }[] = [
  { value: "mes", label: "Mês" },
  { value: "dia", label: "Dia" },
  { value: "intervalo", label: "Intervalo" },
];

const pad = (n: number) => String(n).padStart(2, "0");
const monthLabel = (d: Date) => `${MN[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`;
const dayLabel = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const rangeLabel = (a: Date, b: Date) =>
  `${pad(a.getDate())}/${pad(a.getMonth() + 1)} – ${pad(b.getDate())}/${pad(b.getMonth() + 1)}/${b.getFullYear()}`;

export interface DateFilterProps {
  label: string;
  /** Pre-formatted display value shown on the chip. */
  value: string;
  /** Default value — the chip goes "dirty" (orange) when `value` differs. */
  defaultValue?: string;
  onChange: (value: string) => void;
  initialMode?: DateMode;
  /** Which modes to offer. A single mode hides the mode switch entirely. */
  modes?: DateMode[];
  align?: "start" | "end";
}

export function DateFilter({
  label,
  value,
  defaultValue,
  onChange,
  initialMode = "mes",
  modes = ["mes", "dia", "intervalo"],
  align = "start",
}: DateFilterProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<DateMode>(modes.includes(initialMode) ? initialMode : modes[0]);
  const modeOptions = MODES.filter((m) => modes.includes(m.value));
  const [displayMonth, setDisplayMonth] = useState<Date>(() => new Date());
  const [range, setRange] = useState<DateRange | undefined>();

  const dirty = defaultValue != null && value !== defaultValue;

  const apply = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const shiftYear = (delta: number) =>
    setDisplayMonth((d) => new Date(d.getFullYear() + delta, d.getMonth(), 1));

  const hint =
    mode === "mes"
      ? "Selecione a competência"
      : mode === "dia"
        ? "Selecione o dia"
        : range?.from && !range.to
          ? "Agora escolha o fim do intervalo"
          : "Selecione início e fim";

  const year = displayMonth.getFullYear();

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
            width: 288,
            maxWidth: "calc(100vw - 32px)",
            padding: 8,
            background: "var(--s-card)",
            border: "1px solid var(--s-border)",
            borderRadius: 12,
            boxShadow: "var(--s-sh-2)",
            animation: "bdIn .14s ease both",
          }}
        >
          {modeOptions.length > 1 && (
            <Segmented
              options={modeOptions}
              value={mode}
              onChange={(m) => {
                setMode(m);
                setRange(undefined);
              }}
              size="sm"
              full
              ariaLabel="Modo de data"
            />
          )}

          {mode === "mes" ? (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "9px 2px 6px",
                }}
              >
                <NavButton aria-label="Ano anterior" onClick={() => shiftYear(-1)}>
                  <ChevronLeft size={14} strokeWidth={2.3} />
                </NavButton>
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 800,
                    fontSize: 14,
                    color: "var(--s-t1)",
                  }}
                >
                  {year}
                </span>
                <NavButton aria-label="Próximo ano" onClick={() => shiftYear(1)}>
                  <ChevronRight size={14} strokeWidth={2.3} />
                </NavButton>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
                {MN.map((m, i) => {
                  const cellVal = `${m}/${String(year).slice(-2)}`;
                  const active = value === cellVal;

                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => apply(cellVal)}
                      style={{
                        minHeight: 38,
                        border: `1px solid ${active ? "var(--s-brand)" : "var(--s-border)"}`,
                        borderRadius: 9,
                        background: active ? "var(--s-brand)" : "var(--s-sunken)",
                        color: active ? "#fff" : "var(--s-t1)",
                        font: "inherit",
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </>
          ) : mode === "dia" ? (
            <Calendar
              mode="single"
              month={displayMonth}
              onMonthChange={setDisplayMonth}
              onSelect={(d) => d && apply(dayLabel(d))}
            />
          ) : (
            <Calendar
              mode="range"
              month={displayMonth}
              onMonthChange={setDisplayMonth}
              selected={range}
              onSelect={(r) => {
                setRange(r);

                if (r?.from && r.to) apply(rangeLabel(r.from, r.to));
              }}
            />
          )}

          <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--s-t3)", padding: "8px 2px 2px" }}>
            {hint}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

function NavButton({ children, ...rest }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      style={{
        width: 30,
        height: 30,
        borderRadius: 9,
        border: "1px solid var(--s-border)",
        background: "var(--s-card)",
        color: "var(--s-t2)",
        cursor: "pointer",
        display: "grid",
        placeItems: "center",
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
