"use client";

import { ChevronRight, Clock, Globe, Lock, Radio, Smartphone, Wifi } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ServicoCard as ServicoCardType, ServicoKey } from "@/lib/data/vendedor/types";

const ICONS: Record<ServicoKey, React.ElementType> = {
  FTTH: Wifi,
  FWA: Radio,
  "5G": Smartphone,
  Banda: Globe,
};

/** Small labeled stat used for NDU / PDU. */
function MiniStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 px-2.5 py-1.5 text-center">
      <div className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("text-sm font-bold leading-none", accent ? "text-primary" : "text-foreground")}>{value}</div>
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
      className="flex w-full flex-col rounded-2xl border border-border bg-gradient-card p-4 text-left shadow-elegant transition-colors hover:border-primary/40"
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
            <p className="text-[11px] text-muted-foreground">
              Realizado {formatNumber(card.realizado)}
            </p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <MiniStat label="NDU" value={formatNumber(card.ndu)} />
          <MiniStat label="PDU" value={card.pdu.toFixed(2).replace(".", ",")} accent />
        </div>
      </div>

      {/* Real indicators (funnel / ativação) */}
      <div className="mt-3 space-y-2">
        {card.indicadores.map((ind) => (
          <div key={ind.label} className="rounded-lg border border-border bg-secondary/30 p-2.5">
            <p className="mb-1.5 text-[11px] font-semibold text-foreground">{ind.label}</p>
            <div className="grid grid-cols-4 gap-1.5">
              <Cell label="Meta" value="—" muted />
              <Cell label="Real" value={formatNumber(ind.realizado)} accent />
              <Cell label="%" value="—" muted />
              <Cell label="Falta" value="—" muted />
            </div>
          </div>
        ))}
      </div>

      {/* Meta flag */}
      {!card.metaAvailable && (
        <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-dashed border-border bg-secondary/20 px-2.5 py-2 text-[11px] text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> Meta, %, Falta e Quintil aguardando meta por vendedor.
        </div>
      )}

      {/* Grouped "aguardando" indicators */}
      {card.aguardando.length > 0 && (
        <div className="mt-2 rounded-lg border border-dashed border-border bg-secondary/20 px-2.5 py-2">
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> Outros indicadores aguardando meta/fonte
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {card.aguardando.map((a) => (
              <span key={a} className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {a}
              </span>
            ))}
          </div>
        </div>
      )}

      <span className="mt-3 flex items-center justify-end gap-1 text-[11px] font-medium text-primary">
        Ver raio-X <ChevronRight className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

function Cell({ label, value, accent, muted }: { label: string; value: string; accent?: boolean; muted?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-card px-1 py-1 text-center">
      <div className="text-[8px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("text-[11px] font-bold", accent ? "text-primary" : muted ? "text-muted-foreground" : "text-foreground")}>
        {value}
      </div>
    </div>
  );
}
