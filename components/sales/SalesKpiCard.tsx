"use client";

import { ArrowDown, ArrowUp, Lock, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber, formatPct } from "@/lib/format";
import { InfoHint } from "@/components/ui/info-hint";
import { getIndicatorDef } from "@/lib/indicators/definitions";
import type { KpiBlock } from "@/lib/data/sales/types";

function formatValue(k: KpiBlock): string {
  if (k.unit === "currency") return `R$ ${k.value.toFixed(1).replace(".", ",")}`;

  if (k.unit === "percent") return formatPct(k.value);

  return formatNumber(k.value);
}
function formatMeta(k: KpiBlock): string {
  if (k.unit === "currency") return `R$ ${k.meta.toFixed(1).replace(".", ",")}`;

  if (k.unit === "percent") return formatPct(k.meta);

  return formatNumber(k.meta);
}

export function SalesKpiCard({ kpi }: { kpi: KpiBlock }) {
  const def = getIndicatorDef(kpi.label);

  if (!kpi.available) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-dashed border-border bg-secondary/20 p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Lock className="h-4 w-4" />
          <h3 className="text-sm font-medium">{kpi.label}</h3>
          {def && <InfoHint def={def} />}
        </div>
        <div className="mt-4 text-sm font-medium text-muted-foreground">Sem acesso aos dados</div>
        <p className="mt-1 text-[11px] text-muted-foreground">Aguardando liberação do time de dados.</p>
      </div>
    );
  }

  const hasMeta = kpi.meta > 0;
  const atingimento = hasMeta ? (kpi.value / kpi.meta) * 100 : 0;
  const inverse = /churn/i.test(kpi.label);
  const good = inverse ? atingimento <= 100 : atingimento >= 100;
  const warn = inverse ? atingimento > 100 && atingimento <= 130 : atingimento >= 70 && atingimento < 100;
  const barColor = good ? "bg-success" : warn ? "bg-warning" : "bg-destructive";

  const up = kpi.delta > 0.05;
  const down = kpi.delta < -0.05;
  const deltaGood = inverse ? down : up;
  const DeltaIcon = up ? ArrowUp : down ? ArrowDown : Minus;

  return (
    <div className="bg-gradient-card shadow-elegant relative overflow-hidden rounded-xl border border-border p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-medium text-muted-foreground">{kpi.label}</h3>
          {def && <InfoHint def={def} />}
        </div>
        <span
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
            deltaGood ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
          )}
        >
          <DeltaIcon className="h-3 w-3" /> {Math.abs(kpi.delta).toFixed(1).replace(".", ",")}%
        </span>
      </div>

      <div className="mt-3 text-3xl font-bold tracking-tight text-foreground">{formatValue(kpi)}</div>
      <div className="mt-1 text-xs text-muted-foreground">
        {hasMeta ? `Meta ${formatMeta(kpi)} · ${formatPct(atingimento, 0)}` : "Meta —"}
      </div>

      {hasMeta && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className={cn("h-full rounded-full", barColor)}
            style={{ width: `${Math.max(2, Math.min(100, atingimento))}%` }}
          />
        </div>
      )}

      {kpi.helper && <div className="mt-2 text-[11px] text-muted-foreground">{kpi.helper}</div>}
    </div>
  );
}
