"use client";

import type { CSSProperties } from "react";
import { ChevronRight } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { statusColor } from "@/lib/ui/status";
import type { IndicadorVM, ServicoCard as ServicoCardType, ServicoKey } from "@/lib/data/vendedor/types";
import { SERVICO_STYLE, formatIndicadorValue, fullIndicadorValue } from "./vendedor-format";

const LOCK_HINT =
  "PDU/NDU: fonte oficial indisponível — fórmula (denominador) e meta em confirmação com o time de dados.";

/**
 * Resultado por Serviço card (SCREENS §4.3): coloured icon + nome + realizado,
 * the NDU/PDU pair (currently **locked** → "—", never a fabricated 0), the
 * vendor's catalog indicators (meta × realizado) or an empty state, and the
 * "Ver raio-X" button. Reconstructed with `--s-*` tokens; data = current app.
 */
export function ServicoCard({ card, onOpen }: { card: ServicoCardType; onOpen: (key: ServicoKey) => void }) {
  const style = SERVICO_STYLE[card.key];
  const Icon = style.icon;

  return (
    <div
      style={{
        border: "1px solid var(--s-border)",
        borderRadius: 14,
        background: "var(--s-card)",
        padding: 13,
        boxShadow: "var(--s-sh)",
        display: "flex",
        flexDirection: "column",
        gap: 11,
      }}
    >
      {/* Header: icon · nome/realizado · NDU/PDU */}
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span
          style={{
            flex: "none",
            display: "grid",
            placeItems: "center",
            width: 30,
            height: 30,
            borderRadius: 9,
            background: style.bg,
            color: style.fg,
          }}
        >
          <Icon size={15} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: 14,
              color: "var(--s-t1)",
            }}
          >
            {card.label}
          </span>
          <span style={{ display: "block", fontSize: 11, color: "var(--s-t3)" }}>
            Realizado {formatNumber(card.realizado)}
          </span>
        </span>
        <span style={{ flex: "none", display: "flex", gap: 5 }} title={LOCK_HINT}>
          <MiniStat label="NDU" value={card.ndu == null ? "—" : formatNumber(card.ndu)} />
          <MiniStat label="PDU" value={card.pdu == null ? "—" : card.pdu.toFixed(2).replace(".", ",")} />
        </span>
      </div>

      {/* Catalog indicators (meta × realizado) or empty state */}
      {card.indicadores.length === 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            border: "1px dashed var(--s-border-2)",
            borderRadius: 11,
            padding: "14px 10px",
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--s-t2)" }}>
            Sem indicadores neste mês
          </span>
          <span style={{ fontSize: 10.5, color: "var(--s-t3)" }}>
            Nada foi lançado para {card.label} nesta competência.
          </span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {card.indicadores.map((ind) => (
            <IndicadorRow key={`${ind.id}-${ind.label}`} ind={ind} />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => onOpen(card.key)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          height: 38,
          border: "1px solid var(--s-brand-line)",
          borderRadius: 10,
          background: "var(--s-brand-weak)",
          color: "var(--s-brand)",
          font: "inherit",
          fontSize: 12.5,
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        Ver raio-X
        <ChevronRight size={14} strokeWidth={2.3} />
      </button>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  const locked = value === "—";

  return (
    <span
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        border: "1px solid var(--s-border)",
        borderRadius: 8,
        padding: "3px 7px",
      }}
    >
      <span style={{ fontSize: 8.5, fontWeight: 700, color: "var(--s-t3)" }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 800, color: locked ? "var(--s-t3)" : "var(--s-t1)" }}>
        {value}
      </span>
    </span>
  );
}

/** One catalog indicator: label + Meta / Real / % / Falta cells. */
function IndicadorRow({ ind }: { ind: IndicadorVM }) {
  const meta = formatIndicadorValue(ind.meta, ind.formato);
  const metaFull = fullIndicadorValue(ind.meta, ind.formato);
  const real = ind.disponivel ? formatIndicadorValue(ind.realizado, ind.formato) : "—";
  const realFull = ind.disponivel ? fullIndicadorValue(ind.realizado, ind.formato) : "";
  const pct = ind.disponivel && ind.meta > 0 ? `${Math.round(ind.atingimento)}%` : "—";
  const falta = ind.disponivel && ind.polaridade === "up" ? formatNumber(ind.falta) : "—";
  const pctColor =
    ind.disponivel && ind.meta > 0 ? statusColor(ind.atingimento, ind.polaridade === "down") : "var(--s-t3)";

  return (
    <div
      style={{
        border: "1px solid var(--s-border)",
        borderRadius: 9,
        background: "var(--s-sunken)",
        padding: "7px 8px",
      }}
    >
      <div
        style={{ fontSize: 11, fontWeight: 700, color: "var(--s-t2)", marginBottom: 5, textWrap: "pretty" }}
      >
        {ind.label}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 5 }}>
        <Cell label="Meta" value={meta} full={metaFull} />
        <Cell
          label="Real"
          value={real}
          full={realFull}
          color={ind.disponivel ? "var(--s-t1)" : "var(--s-t3)"}
        />
        <Cell label="%" value={pct} color={pctColor} />
        <Cell label="Falta" value={falta} color={falta === "—" ? "var(--s-t3)" : "var(--s-t1)"} />
      </div>
    </div>
  );
}

function Cell({
  label,
  value,
  full,
  color,
}: {
  label: string;
  value: string;
  full?: string;
  color?: string;
}) {
  const box: CSSProperties = {
    border: "1px solid var(--s-border)",
    borderRadius: 7,
    background: "var(--s-card)",
    padding: "4px 2px",
    textAlign: "center",
    minWidth: 0,
  };

  return (
    <div style={box}>
      <div
        style={{
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: ".06em",
          textTransform: "uppercase",
          color: "var(--s-t3)",
        }}
      >
        {label}
      </div>
      <div
        title={full || undefined}
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: color ?? "var(--s-t1)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
    </div>
  );
}
