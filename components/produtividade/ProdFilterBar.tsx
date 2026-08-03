"use client";

import { useEffect, useState, type CSSProperties } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { CalendarDays } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { ChipFilter, FilterClearButton } from "@/components/ui/chip-filter";
import { Segmented } from "@/components/ui/segmented";
import { formatDateRange, fromIso, toIso } from "@/lib/date";
import { useIsMobile } from "@/lib/hooks/use-media-query";
import {
  MANAGEMENT_MODES,
  type ManagementMode,
  type ProdFilters,
  type ProdFilterOptions,
} from "@/lib/data/produtividade/types";

/**
 * Produtividade Comercial filter bar (SCREENS §3). A sticky card: a period range
 * popover + a Gestão segmented (Vendas Externas / Canais — a data filter that
 * also switches the ranking grouping) over mode-aware chip-selects (Serviço +
 * Gerência/Coordenação or Gerente/Nicho + Cidade). State lives in the URL (the
 * page recomputes server-side per filter, ADR 0002); this only emits the next
 * `ProdFilters`.
 */
const ALL = "Todos";
const MODE_OPTIONS = MANAGEMENT_MODES.map((m) => ({ value: m.key, label: m.label }));

function defaultRange(): { from: string; to: string } {
  const today = new Date();
  const from = new Date(today);

  from.setDate(from.getDate() - 29);

  return { from: toIso(from) ?? "", to: toIso(today) ?? "" };
}

export function ProdFilterBar({
  filters,
  options,
  onChange,
  onReset,
}: {
  filters: ProdFilters;
  options: ProdFilterOptions;
  onChange: (next: ProdFilters) => void;
  onReset: () => void;
}) {
  const pick = (key: keyof ProdFilters, v: string) =>
    onChange({ ...filters, [key]: v === ALL ? "" : v } as ProdFilters);

  const def = defaultRange();
  const periodDirty = filters.from !== def.from || filters.to !== def.to;
  const dirtyCount =
    (periodDirty ? 1 : 0) +
    (filters.mode !== "externas" ? 1 : 0) +
    (filters.servico ? 1 : 0) +
    (filters.gerencia ? 1 : 0) +
    (filters.coordenacao ? 1 : 0) +
    (filters.gerente ? 1 : 0) +
    (filters.nicho ? 1 : 0) +
    (filters.cidade ? 1 : 0);

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
        {/* Period range + management mode */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
          <PeriodRangeChip
            from={filters.from}
            to={filters.to}
            onApply={(from, to) => onChange({ ...filters, from, to })}
          />
          <Segmented
            options={MODE_OPTIONS}
            value={filters.mode}
            onChange={(mode: ManagementMode) =>
              onChange({ ...filters, mode, gerencia: "", coordenacao: "", gerente: "", nicho: "" })
            }
            size="sm"
            ariaLabel="Modo de gestão"
          />
        </div>

        {/* Mode-aware dimension chip-selects */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <ChipFilter
            label="Serviço"
            value={filters.servico || ALL}
            options={[ALL, ...options.servicos]}
            defaultValue={ALL}
            onChange={(v) => pick("servico", v)}
          />
          {filters.mode === "externas" ? (
            <>
              <ChipFilter
                label="Gerência"
                value={filters.gerencia || ALL}
                options={[ALL, ...options.gerencias]}
                defaultValue={ALL}
                onChange={(v) => pick("gerencia", v)}
              />
              <ChipFilter
                label="Coordenação"
                value={filters.coordenacao || ALL}
                options={[ALL, ...options.coordenacoes]}
                defaultValue={ALL}
                onChange={(v) => pick("coordenacao", v)}
              />
            </>
          ) : (
            <>
              <ChipFilter
                label="Gerente"
                value={filters.gerente || ALL}
                options={[ALL, ...options.gerentes]}
                defaultValue={ALL}
                onChange={(v) => pick("gerente", v)}
              />
              <ChipFilter
                label="Nicho"
                value={filters.nicho || ALL}
                options={[ALL, ...options.nichos]}
                defaultValue={ALL}
                onChange={(v) => pick("nicho", v)}
              />
            </>
          )}
          <ChipFilter
            label="Cidade"
            value={filters.cidade || ALL}
            options={[ALL, ...options.cidades]}
            defaultValue={ALL}
            onChange={(v) => pick("cidade", v)}
            align="end"
          />
          {dirtyCount > 0 && <FilterClearButton count={dirtyCount} onClear={onReset} />}
        </div>
      </div>
    </div>
  );
}

/** Period range chip: a Calendar-range popover committing from/to ISO once both
 *  ends are picked (no fetch mid-selection). The period is always set. */
function PeriodRangeChip({
  from,
  to,
  onApply,
}: {
  from: string;
  to: string;
  onApply: (from: string, to: string) => void;
}) {
  const isMobile = useIsMobile();

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

  const label = committed?.from ? formatDateRange(committed.from, committed.to) : "Selecionar período";

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);

        if (o) setDraft(committed);
      }}
    >
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          aria-expanded={open}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            height: 40,
            padding: "0 12px",
            border: "1px solid var(--s-brand)",
            borderRadius: 10,
            background: "var(--s-brand-weak)",
            cursor: "pointer",
            font: "inherit",
            textAlign: "left",
          }}
        >
          <CalendarDays size={14} strokeWidth={2.2} style={{ color: "var(--s-brand)", flex: "none" }} />
          <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
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
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--s-brand)" }}>{label}</span>
          </span>
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
            numberOfMonths={isMobile ? 1 : 2}
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
            <button
              type="button"
              disabled={!draft?.from || !draft?.to}
              onClick={() => {
                if (!draft?.from || !draft?.to) return;

                const [lo, hi] = draft.from <= draft.to ? [draft.from, draft.to] : [draft.to, draft.from];
                const loIso = toIso(lo);
                const hiIso = toIso(hi);

                if (loIso && hiIso) onApply(loIso, hiIso);

                setOpen(false);
              }}
              style={applyBtnStyle(!draft?.from || !draft?.to)}
            >
              Aplicar
            </button>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

function applyBtnStyle(disabled: boolean): CSSProperties {
  return {
    minHeight: 30,
    padding: "0 14px",
    borderRadius: 8,
    border: "1px solid var(--s-brand)",
    background: "var(--s-brand)",
    color: "#fff",
    font: "inherit",
    fontSize: 11.5,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
  };
}
