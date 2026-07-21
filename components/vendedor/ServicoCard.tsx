"use client";

import { ChevronRight, Globe, Radio, Smartphone, Wifi } from "lucide-react";
import { formatNumber, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { IndicadorVM, ServicoCard as ServicoCardType, ServicoKey } from "@/lib/data/vendedor/types";

const ICONS: Record<ServicoKey, React.ElementType> = {
  FTTH: Wifi,
  FWA: Radio,
  "5G": Smartphone,
  Banda: Globe,
};

/** Format an indicator value per its catalog `formato` (qtd / R$ / %). */
function fmtValor(v: number, formato: IndicadorVM["formato"]): string {
  if (formato === "R$")
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  // "%" metas are stored as a fraction (0.15 → 15%).
  if (formato === "%") return formatPct(v * 100, 0);

  return formatNumber(v);
}

/** Small labeled stat used for NDU / PDU. */
function MiniStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 px-2.5 py-1.5 text-center">
      <div className="text-[9px] font-medium tracking-wider text-muted-foreground uppercase">{label}</div>
      <div className={cn("text-sm leading-none font-bold", accent ? "text-primary" : "text-foreground")}>
        {value}
      </div>
    </div>
  );
}

export function ServicoCard({
  card,
  chartVar,
  onOpen,
}: {
  card: ServicoCardType;
  chartVar: string; // e.g. "var(--chart-1)"
  onOpen: (key: ServicoKey) => void;
}) {
  const Icon = ICONS[card.key];

  return (
    <button
      onClick={() => onOpen(card.key)}
      className="bg-gradient-card shadow-elegant flex w-full flex-col rounded-2xl border border-border p-4 text-left transition-colors hover:border-primary/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white shadow-sm"
            style={{ backgroundColor: chartVar }}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-bold text-foreground">{card.label}</h3>
            <p className="text-[11px] text-muted-foreground">Realizado {formatNumber(card.realizado)}</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <MiniStat label="NDU" value={formatNumber(card.ndu)} />
          <MiniStat label="PDU" value={card.pdu.toFixed(2).replace(".", ",")} accent />
        </div>
      </div>

      {/* Catalog indicators (meta × realizado) from metas_vendedores_canais */}
      <div className="mt-3 space-y-2">
        {card.indicadores.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-secondary/20 px-2.5 py-3 text-center text-[11px] text-muted-foreground">
            Sem indicadores neste mês.
          </p>
        ) : (
          card.indicadores.map((ind) => {
            const pct = ind.disponivel && ind.meta > 0 ? `${Math.round(ind.atingimento)}%` : "—";
            const real = ind.disponivel ? fmtValor(ind.realizado, ind.formato) : "—";
            const falta = ind.disponivel && ind.polaridade === "up" ? formatNumber(ind.falta) : "—";

            return (
              <div
                key={`${ind.id}-${ind.label}`}
                className="rounded-lg border border-border bg-secondary/30 p-2.5"
              >
                <p className="mb-1.5 text-[11px] font-semibold text-foreground">{ind.label}</p>
                <div className="grid grid-cols-4 gap-1.5">
                  <Cell label="Meta" value={fmtValor(ind.meta, ind.formato)} />
                  <Cell label="Real" value={real} accent={ind.disponivel} muted={!ind.disponivel} />
                  <Cell label="%" value={pct} muted={!ind.disponivel} />
                  <Cell label="Falta" value={falta} muted={falta === "—"} />
                </div>
              </div>
            );
          })
        )}
      </div>

      <span className="mt-3 flex items-center justify-end gap-1 text-[11px] font-medium text-primary">
        Ver raio-X <ChevronRight className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

function Cell({
  label,
  value,
  accent,
  muted,
}: {
  label: string;
  value: string;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-card px-1 py-1 text-center">
      <div className="text-[8px] font-medium tracking-wider text-muted-foreground uppercase">{label}</div>
      <div
        className={cn(
          "text-[11px] font-bold",
          accent ? "text-primary" : muted ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}
