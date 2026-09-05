"use client";

import type { CSSProperties } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Lock, X } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { statusColor } from "@/lib/ui/status";
import type { ServicoCard } from "@/lib/data/vendedor/types";
import { SERVICO_STYLE, formatIndicadorValue, fullIndicadorValue } from "./vendedor-format";

/**
 * Raio-X por serviço (SCREENS §4.3 "Ver raio-X" + §5 drill shell). Opens from a
 * service card: the drill header (eyebrow + service name) over its catalog
 * indicators with Realizado / Projeção / Atingimento. There is no 12-month
 * series per indicator for a vendedor yet (data-map: histórico/quintil não
 * implementados), so this stays a per-service detail rather than the §5
 * per-indicator chart — Phase 3 unifies the drills. Projeção is pro-rata over
 * the month's business days (NDU is locked); a closed month projects = realizado.
 */

/** Business days (Mon–Fri) in the whole month. */
function businessDays(ano: number, mes: number): number {
  const last = new Date(ano, mes, 0).getDate();
  let n = 0;

  for (let d = 1; d <= last; d++) {
    const dow = new Date(ano, mes - 1, d).getDay();

    if (dow !== 0 && dow !== 6) n++;
  }

  return n;
}

/** Business days elapsed up to and including `hoje`. */
function businessDaysUpTo(ano: number, mes: number, hoje: number): number {
  let n = 0;

  for (let d = 1; d <= hoje; d++) {
    const dow = new Date(ano, mes - 1, d).getDay();

    if (dow !== 0 && dow !== 6) n++;
  }

  return n;
}

export function RaioXModal({
  card,
  ano,
  mes,
  hoje,
  onClose,
}: {
  card: ServicoCard | null;
  ano: number;
  mes: number;
  /** Day-of-month "today" when the competência is the current month, else null. */
  hoje: number | null;
  onClose: () => void;
}) {
  return (
    <DialogPrimitive.Root open={!!card} onOpenChange={(o) => !o && onClose()}>
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
          aria-describedby={undefined}
          style={{
            position: "fixed",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 81,
            width: "calc(100vw - 32px)",
            maxWidth: 720,
            maxHeight: "calc(100% - 48px)",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            padding: 18,
            background: "var(--s-card)",
            border: "1px solid var(--s-border)",
            borderRadius: "var(--r-modal)",
            boxShadow: "var(--s-sh-2)",
            animation: "bdModalIn .18s ease both",
          }}
        >
          {card && <DrillBody card={card} ano={ano} mes={mes} hoje={hoje} />}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function DrillBody({
  card,
  ano,
  mes,
  hoje,
}: {
  card: ServicoCard;
  ano: number;
  mes: number;
  hoje: number | null;
}) {
  const style = SERVICO_STYLE[card.key];
  const Icon = style.icon;
  const total = businessDays(ano, mes);
  const elapsed = hoje != null ? businessDaysUpTo(ano, mes, hoje) : total;
  const factor = hoje != null && elapsed > 0 ? Math.max(1, total / elapsed) : 1;

  return (
    <>
      <DialogPrimitive.Title asChild>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 11, minWidth: 0 }}>
            <span
              style={{
                flex: "none",
                display: "grid",
                placeItems: "center",
                width: 34,
                height: 34,
                borderRadius: 10,
                background: style.bg,
                color: style.fg,
              }}
            >
              <Icon size={17} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={eyebrowStyle}>Raio-X do serviço</div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 800,
                  fontSize: 22,
                  letterSpacing: "-.02em",
                  color: "var(--s-t1)",
                  marginTop: 2,
                }}
              >
                {card.label}
              </div>
              <div style={{ fontSize: 12, color: "var(--s-t3)", marginTop: 3 }}>
                Realizado {formatNumber(card.realizado)} ·{" "}
                {hoje != null
                  ? `projeção pro-rata sobre ${total} dias úteis (${elapsed} decorridos)`
                  : "mês fechado — projeção igual ao realizado"}
              </div>
            </div>
          </div>
          <DialogPrimitive.Close aria-label="Fechar" style={closeBtnStyle}>
            <X size={15} />
          </DialogPrimitive.Close>
        </div>
      </DialogPrimitive.Title>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {card.indicadores.length === 0 && (
          <p
            style={{
              border: "1px dashed var(--s-border-2)",
              borderRadius: 12,
              background: "var(--s-sunken)",
              padding: "20px 12px",
              textAlign: "center",
              fontSize: 12.5,
              color: "var(--s-t3)",
            }}
          >
            Sem indicadores neste mês.
          </p>
        )}
        {card.indicadores.map((ind) => {
          const projReal = Math.round(ind.realizado * factor);
          const ating = ind.disponivel && ind.meta > 0 ? `${Math.round(ind.atingimento)}%` : "—";
          const atingColor =
            ind.disponivel && ind.meta > 0
              ? statusColor(ind.atingimento, ind.polaridade === "down")
              : "var(--s-t3)";

          return (
            <div
              key={`${ind.id}-${ind.label}`}
              style={{
                border: "1px solid var(--s-border)",
                borderRadius: 12,
                background: "var(--s-sunken)",
                padding: "12px 13px",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}
              >
                <h4 style={{ fontSize: 13, fontWeight: 700, color: "var(--s-t1)", textWrap: "pretty" }}>
                  {ind.label}
                </h4>
                <span
                  title={fullIndicadorValue(ind.meta, ind.formato) || undefined}
                  style={{ fontSize: 11, color: "var(--s-t3)" }}
                >
                  Meta {formatIndicadorValue(ind.meta, ind.formato)}
                </span>
              </div>
              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                <Box
                  label="Realizado"
                  value={ind.disponivel ? formatIndicadorValue(ind.realizado, ind.formato) : "—"}
                  full={ind.disponivel ? fullIndicadorValue(ind.realizado, ind.formato) : ""}
                  color={ind.disponivel ? "var(--s-t1)" : "var(--s-t3)"}
                />
                <Box
                  label="Projeção"
                  value={ind.disponivel ? formatIndicadorValue(projReal, ind.formato) : "—"}
                  full={ind.disponivel ? fullIndicadorValue(projReal, ind.formato) : ""}
                  color={ind.disponivel ? "var(--s-t1)" : "var(--s-t3)"}
                />
                <Box label="Atingimento" value={ating} color={atingColor} />
              </div>
              {!ind.disponivel && (
                <div
                  style={{
                    marginTop: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    border: "1px dashed var(--s-border-2)",
                    borderRadius: 8,
                    background: "var(--s-card)",
                    padding: "6px 8px",
                    fontSize: 10.5,
                    color: "var(--s-t3)",
                  }}
                >
                  <Lock size={12} /> Realizado aguardando fonte/fórmula.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function Box({ label, value, full, color }: { label: string; value: string; full?: string; color?: string }) {
  return (
    <div
      style={{
        border: "1px solid var(--s-border)",
        borderRadius: 10,
        background: "var(--s-card)",
        padding: "9px 10px",
        textAlign: "center",
      }}
    >
      <div style={eyebrowStyle}>{label}</div>
      <div
        title={full || undefined}
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: 17,
          letterSpacing: "-.02em",
          color: color ?? "var(--s-t1)",
          marginTop: 3,
        }}
      >
        {value}
      </div>
    </div>
  );
}

const eyebrowStyle: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 700,
  letterSpacing: ".09em",
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
