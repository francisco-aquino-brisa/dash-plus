"use client";

import { useEffect, useState, type CSSProperties } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { CalendarDays } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { ChipFilter, FilterClearButton } from "@/components/ui/chip-filter";
import { formatDateRange, fromIso, toIso } from "@/lib/date";
import type { SalesFilters, SalesFilterOptions } from "@/lib/data/sales/types";

/**
 * Vendas · Canais filter bar (DESIGN_SYSTEM "Estrutura comum" + SCREENS §2).
 *
 * A sticky card: a row of period preset chips (Mês atual / anterior / 7·30·90
 * dias / Ano) plus a "Personalizado" range popover, over a row of 40px
 * chip-selects (Serviço · Gerente · Canal · Nicho · UF · Cidade · Tipo cidade)
 * and "Limpar (n)". State lives in the URL (the page recomputes the view-model
 * server-side per filter, ADR 0002); this only emits the next `SalesFilters`.
 */
const ALL = "Todos";

function currentMonthRange(): DateRange {
  const today = new Date();

  return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: today };
}

export function SalesFilterBar({
  filters,
  options,
  onChange,
  onReset,
}: {
  filters: SalesFilters;
  options: SalesFilterOptions;
  onChange: (next: SalesFilters) => void;
  onReset: () => void;
}) {
  const set = (patch: Partial<SalesFilters>) => onChange({ ...filters, ...patch });
  // "Todos" sentinel ↔ "" (the data layer's "no filter") for the chip-selects.
  const pick = (key: keyof SalesFilters, v: string) =>
    set({ [key]: v === ALL ? "" : v } as Partial<SalesFilters>);

  const custom = filters.period === "custom";
  const cidadeOptions = filters.uf ? (options.cidadesByUf[filters.uf] ?? []) : options.cidades;

  const dirtyCount =
    (custom || (filters.period && filters.period !== "mes_atual") ? 1 : 0) +
    (filters.servico ? 1 : 0) +
    (filters.gerente ? 1 : 0) +
    (filters.canal ? 1 : 0) +
    (filters.nicho ? 1 : 0) +
    (filters.uf ? 1 : 0) +
    (filters.cidade ? 1 : 0) +
    (filters.tipo ? 1 : 0);

  return (
    <div style={{ position: "sticky", top: 0, zIndex: 30, paddingTop: 4 }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          padding: "10px 12px",
          background: "var(--s-card)",
          border: "1px solid var(--s-border)",
          borderRadius: "var(--r-panel)",
          boxShadow: "var(--s-sh)",
        }}
      >
        {/* Period presets + custom range */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 7 }}>
          <span
            style={{
              fontSize: 8.5,
              fontWeight: 700,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "var(--s-t3)",
            }}
          >
            Período
          </span>
          {options.periods.map((p) => (
            <PeriodChip
              key={p.key}
              label={p.label}
              active={!custom && filters.period === p.key}
              onClick={() => set({ period: p.key, from: undefined, to: undefined })}
            />
          ))}
          <CustomRangeChip
            active={custom}
            from={filters.from}
            to={filters.to}
            onApply={(from, to) => onChange({ ...filters, period: "custom", from, to })}
          />
        </div>

        {/* Dimension chip-selects */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <ChipFilter
            label="Serviço"
            value={filters.servico || ALL}
            options={[ALL, ...options.servicos]}
            defaultValue={ALL}
            onChange={(v) => pick("servico", v)}
          />
          <ChipFilter
            label="Gerente"
            value={filters.gerente || ALL}
            options={[ALL, ...options.gerentes]}
            defaultValue={ALL}
            onChange={(v) => pick("gerente", v)}
          />
          <ChipFilter
            label="Canal"
            value={filters.canal || ALL}
            options={[ALL, ...options.canais]}
            defaultValue={ALL}
            onChange={(v) => pick("canal", v)}
          />
          <ChipFilter
            label="Nicho"
            value={filters.nicho || ALL}
            options={[ALL, ...options.nichos]}
            defaultValue={ALL}
            onChange={(v) => pick("nicho", v)}
          />
          <ChipFilter
            label="UF"
            value={filters.uf || ALL}
            options={[ALL, ...options.ufs]}
            defaultValue={ALL}
            onChange={(v) => {
              // Narrow Cidade to the chosen UF; drop a city that doesn't belong to it.
              const nextUf = v === ALL ? "" : v;
              const allowed = nextUf ? (options.cidadesByUf[nextUf] ?? []) : null;
              const keepCidade = !filters.cidade || !allowed || allowed.includes(filters.cidade);

              set({ uf: nextUf, cidade: keepCidade ? filters.cidade : "" });
            }}
          />
          <ChipFilter
            label="Cidade"
            value={filters.cidade || ALL}
            options={[ALL, ...cidadeOptions]}
            defaultValue={ALL}
            onChange={(v) => pick("cidade", v)}
            align="end"
            maxVisible={100}
          />
          <ChipFilter
            label="Tipo cidade"
            value={filters.tipo || ALL}
            options={[ALL, ...options.tipos]}
            defaultValue={ALL}
            onChange={(v) => pick("tipo", v)}
            align="end"
          />
          {dirtyCount > 0 && <FilterClearButton count={dirtyCount} onClear={onReset} />}
        </div>
      </div>
    </div>
  );
}

/** A small period-preset pill, styled with the `--s-*` tokens. */
function PeriodChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "6px 11px",
        border: `1px solid ${active ? "var(--s-brand)" : "var(--s-border)"}`,
        borderRadius: 999,
        background: active ? "var(--s-brand-weak)" : "var(--s-sunken)",
        color: active ? "var(--s-brand)" : "var(--s-t2)",
        font: "inherit",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        transition: ".16s",
      }}
    >
      {label}
    </button>
  );
}

/** "Personalizado" range chip: a Calendar-range popover that commits from/to ISO
 *  only once both ends are picked (no fetch mid-selection). */
function CustomRangeChip({
  active,
  from,
  to,
  onApply,
}: {
  active: boolean;
  from?: string;
  to?: string;
  onApply: (from: string, to: string) => void;
}) {
  const toRange = (): DateRange | undefined => {
    const f = fromIso(from);

    return f ? { from: f, to: fromIso(to) } : undefined;
  };

  const committed = toRange();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(committed);

  useEffect(() => {
    setDraft(toRange());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const chipValue =
    active && committed?.from ? formatDateRange(committed.from, committed.to) : "Personalizado";

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);

        if (o) setDraft(committed); // reopen shows the committed range; discard drafts
      }}
    >
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          aria-expanded={open}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "6px 11px",
            border: `1px solid ${active ? "var(--s-brand)" : "var(--s-border)"}`,
            borderRadius: 999,
            background: active ? "var(--s-brand-weak)" : "var(--s-sunken)",
            color: active ? "var(--s-brand)" : "var(--s-t2)",
            font: "inherit",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            transition: ".16s",
          }}
        >
          <CalendarDays size={13} strokeWidth={2.2} />
          {chipValue}
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          style={{
            zIndex: 50,
            maxWidth: "calc(100vw - 24px)",
            maxHeight: "calc(100dvh - 24px)",
            overflowY: "auto",
            padding: 8,
            background: "var(--s-card)",
            border: "1px solid var(--s-border)",
            borderRadius: 12,
            boxShadow: "var(--s-sh-2)",
            animation: "bdIn .14s ease both",
          }}
        >
          <Calendar
            mode="range"
            selected={draft}
            onSelect={setDraft}
            defaultMonth={draft?.from ?? new Date()}
            locale={ptBR}
            autoFocus
          />
          <div
            style={{
              position: "sticky",
              bottom: -8,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              borderTop: "1px solid var(--s-border)",
              padding: "8px 0 2px",
              marginTop: 4,
              background: "var(--s-card)",
            }}
          >
            <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--s-t3)" }}>
              {draft?.from && draft?.to ? formatDateRange(draft.from, draft.to) : "Selecione início e fim"}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <RangeButton subtle label="Mês atual" onClick={() => setDraft(currentMonthRange())} />
              <RangeButton
                label="Aplicar"
                disabled={!draft?.from || !draft?.to}
                onClick={() => {
                  if (!draft?.from || !draft?.to) return;

                  // Enforce início ≤ fim before fetching.
                  const [lo, hi] = draft.from <= draft.to ? [draft.from, draft.to] : [draft.to, draft.from];
                  const loIso = toIso(lo);
                  const hiIso = toIso(hi);

                  if (loIso && hiIso) onApply(loIso, hiIso);

                  setOpen(false);
                }}
              />
            </div>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

function RangeButton({
  label,
  onClick,
  disabled,
  subtle,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  subtle?: boolean;
}) {
  const base: CSSProperties = {
    minHeight: 30,
    padding: "0 12px",
    borderRadius: 8,
    font: "inherit",
    fontSize: 11.5,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={
        subtle
          ? {
              ...base,
              border: "1px solid var(--s-border)",
              background: "var(--s-sunken)",
              color: "var(--s-t2)",
            }
          : { ...base, border: "1px solid var(--s-brand)", background: "var(--s-brand)", color: "#fff" }
      }
    >
      {label}
    </button>
  );
}
