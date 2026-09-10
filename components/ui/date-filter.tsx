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
  /** Popover stacking — raise above a modal (default 50). */
  zIndex?: number;
  /** Month the calendar opens on. Defaults to today's — pass the month being
   *  filtered so the user does not land somewhere else and have to navigate. */
  initialMonth?: Date;
  /** Longest interval accepted, in days, both ends included. Days outside the
   *  window grey out once the first one is picked. */
  maxRangeDays?: number;
  /** Latest day accepted. Later days and months grey out. */
  maxDate?: Date;
}

export function DateFilter({
  label,
  value,
  defaultValue,
  onChange,
  initialMode = "mes",
  modes = ["mes", "dia", "intervalo"],
  align = "start",
  zIndex = 50,
  initialMonth,
  maxRangeDays,
  maxDate,
}: DateFilterProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<DateMode>(modes.includes(initialMode) ? initialMode : modes[0]);
  const modeOptions = MODES.filter((m) => modes.includes(m.value));
  const [displayMonth, setDisplayMonth] = useState<Date>(() => initialMonth ?? new Date());
  const [range, setRange] = useState<DateRange | undefined>();

  const dirty = defaultValue != null && value !== defaultValue;

  const apply = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const shiftYear = (delta: number) =>
    setDisplayMonth((d) => new Date(d.getFullYear() + delta, d.getMonth(), 1));

  // While the range is half-open the window closes around the first day in both
  // directions, so an over-long range cannot be drawn in the first place.
  const isDayDisabled = (d: Date): boolean => {
    if (maxDate && d > maxDate) return true;

    const start = range?.from;

    if (!maxRangeDays || !start || range?.to) return false;

    const span = Math.abs(d.getTime() - start.getTime()) / 86_400_000;

    return span > maxRangeDays - 1;
  };

  const hint =
    mode === "mes"
      ? "Selecione a competência"
      : mode === "dia"
        ? "Selecione o dia"
        : range?.from && !range.to
          ? maxRangeDays
            ? `Agora escolha o fim — no máximo ${maxRangeDays} dias`
            : "Agora escolha o fim do intervalo"
          : maxRangeDays
            ? `Selecione início e fim — no máximo ${maxRangeDays} dias`
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
            zIndex,
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
                  const blocked = maxDate != null && new Date(year, i, 1) > maxDate;

                  return (
                    <button
                      key={m}
                      type="button"
                      disabled={blocked}
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
                        cursor: blocked ? "not-allowed" : "pointer",
                        opacity: blocked ? 0.35 : 1,
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
              disabled={isDayDisabled}
              onSelect={(d) => d && apply(dayLabel(d))}
            />
          ) : (
            <Calendar
              mode="range"
              month={displayMonth}
              onMonthChange={setDisplayMonth}
              selected={range}
              disabled={isDayDisabled}
              onSelect={(_r, day) => {
                // react-day-picker v9 answers the FIRST click with a complete
                // `{from: d, to: d}`, so trusting its range would close the
                // popover on one click and select a single day. Drive the two
                // clicks here instead: the first opens a range, the second
                // closes it (in either direction).
                const opening = !range?.from || Boolean(range.to);

                if (opening) {
                  setRange({ from: day, to: undefined });

                  return;
                }

                const start = range.from as Date;
                const [a, b] = day < start ? [day, start] : [start, day];

                setRange({ from: a, to: b });
                apply(rangeLabel(a, b));
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
