"use client";

import { useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, SlidersHorizontal } from "lucide-react";
import { KpiCard, LockedKpiCard } from "@/components/ui/kpi-card";
import { Segmented } from "@/components/ui/segmented";
import type { IndicatorCardVM } from "@/lib/data/cities/indicator-blocks";
import { formatIndicatorValue, iconForIndicator } from "./indicator-format";

/**
 * One selectable KPI block for the Cities screen (SCREENS §1.2). A section
 * header (h2 + subtitle) with a Todos / Fora da meta / Na meta segmented and an
 * "Indicadores (n)" selector, over an `auto-fill minmax(228px)` grid of KpiCards
 * mapped from the server `IndicatorCardVM`s. Missing sources render the dashed
 * LockedKpiCard, never a fake 0.
 */
type KpiTab = "all" | "off" | "ok";

const TABS: { value: KpiTab; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "off", label: "Fora da meta" },
  { value: "ok", label: "Na meta" },
];

/** Does a card pass the "na meta" test? (inverse indicators invert the compare.) */
function onTarget(vm: IndicatorCardVM): boolean {
  if (vm.attainment == null) return false;

  return vm.polarity === "down" ? vm.attainment <= 100 : vm.attainment >= 100;
}

export function KpiBlock({
  title,
  subtitle,
  vms,
  selection,
  onSelectionChange,
  onCardClick,
}: {
  title: string;
  subtitle: string;
  vms: IndicatorCardVM[];
  selection: string[];
  onSelectionChange: (next: string[]) => void;
  onCardClick: (vm: IndicatorCardVM) => void;
}) {
  const [tab, setTab] = useState<KpiTab>("all");
  const selected = vms.filter((v) => selection.includes(v.id));
  // The tab filters by attainment; cards without a meta (and locked ones) only
  // show under "Todos".
  const shown = selected.filter((v) => {
    if (tab === "all") return true;

    if (v.attainment == null) return false;

    return tab === "ok" ? onTarget(v) : !onTarget(v);
  });

  return (
    <section
      style={{
        border: "1px solid var(--s-border)",
        borderRadius: "var(--r-panel)",
        background: "var(--s-card)",
        padding: 15,
        boxShadow: "var(--s-sh)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: 17,
              letterSpacing: "-.02em",
            }}
          >
            {title}
          </h2>
          <div style={{ fontSize: 11.5, color: "var(--s-t3)", marginTop: 2 }}>{subtitle}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Segmented options={TABS} value={tab} onChange={setTab} size="sm" ariaLabel="Filtrar indicadores" />
          <IndicatorSelect vms={vms} selection={selection} onSelectionChange={onSelectionChange} />
        </div>
      </header>

      {shown.length === 0 ? (
        <p style={{ padding: "10px 2px", fontSize: 12.5, color: "var(--s-t3)" }}>
          {selected.length === 0
            ? "Nenhum indicador selecionado. Use “Indicadores” para escolher."
            : "Nenhum indicador nesta faixa."}
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(228px, 1fr))",
            gap: 10,
          }}
        >
          {shown.map((vm) =>
            vm.available ? (
              <KpiCard
                key={vm.id}
                icon={iconForIndicator(vm.id, vm.unit)}
                label={vm.label}
                value={formatIndicatorValue(vm.unit, vm.value, vm.decimals)}
                trend={vm.delta}
                atingimento={vm.attainment}
                inverse={vm.polarity === "down"}
                stats={vm.footer.map((f) => ({
                  label: f.label,
                  value: f.display,
                  status: f.tone !== "default",
                }))}
                sparkline={vm.series.map((s) => s.valor)}
                description={vm.description}
                onClick={() => onCardClick(vm)}
              />
            ) : (
              <LockedKpiCard key={vm.id} label={vm.label} />
            ),
          )}
        </div>
      )}
    </section>
  );
}

/** "Indicadores (n)" selector: a pill that opens a checkbox popover of the full
 *  block catalog with Todos / Nenhum shortcuts; the selection persists upstream. */
function IndicatorSelect({
  vms,
  selection,
  onSelectionChange,
}: {
  vms: IndicatorCardVM[];
  selection: string[];
  onSelectionChange: (next: string[]) => void;
}) {
  const selectedSet = new Set(selection);
  // Preserve catalog order so the card layout stays stable across toggles.
  const commit = (ids: Set<string>) => onSelectionChange(vms.filter((v) => ids.has(v.id)).map((v) => v.id));

  const toggle = (id: string) => {
    const next = new Set(selectedSet);

    if (next.has(id)) next.delete(id);
    else next.add(id);

    commit(next);
  };

  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            minHeight: 34,
            padding: "0 12px",
            border: "1px solid var(--s-border)",
            borderRadius: 999,
            background: "var(--s-card)",
            color: "var(--s-t2)",
            font: "inherit",
            fontSize: 11.5,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          <SlidersHorizontal size={13} strokeWidth={2.2} />
          Indicadores ({selection.length})
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={6}
          style={{
            zIndex: 50,
            width: 280,
            maxHeight: 380,
            display: "flex",
            flexDirection: "column",
            padding: 8,
            background: "var(--s-card)",
            border: "1px solid var(--s-border)",
            borderRadius: 12,
            boxShadow: "var(--s-sh-2)",
            animation: "bdIn .14s ease both",
          }}
        >
          <div style={{ padding: "2px 4px 8px" }}>
            <div
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: "var(--s-t3)",
              }}
            >
              Indicadores
            </div>
            <div style={{ fontSize: 11.5, color: "var(--s-t3)", marginTop: 2 }}>
              {selection.length} de {vms.length} visíveis · sua seleção fica salva
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, padding: "0 4px 8px" }}>
            <ShortcutButton label="Todos" onClick={() => commit(new Set(vms.map((v) => v.id)))} />
            <ShortcutButton label="Nenhum" onClick={() => commit(new Set())} />
          </div>
          <div
            style={{ overflowY: "auto", maxHeight: 260, display: "flex", flexDirection: "column", gap: 1 }}
          >
            {vms.map((v) => {
              const on = selectedSet.has(v.id);

              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => toggle(v.id)}
                  className="bd-menuitem"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    width: "100%",
                    minHeight: 36,
                    padding: "0 8px",
                    border: 0,
                    borderRadius: 8,
                    background: "transparent",
                    color: on ? "var(--s-t1)" : "var(--s-t2)",
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
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {v.label}
                  </span>
                  {!v.available && (
                    <span style={{ flex: "none", fontSize: 10, fontWeight: 700, color: "var(--s-t3)" }}>
                      sem acesso
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

function ShortcutButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        minHeight: 30,
        border: "1px solid var(--s-border)",
        borderRadius: 8,
        background: "var(--s-sunken)",
        color: "var(--s-t2)",
        font: "inherit",
        fontSize: 11.5,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
