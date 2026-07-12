"use client";

import { ArrowDown, ArrowUp, Lock, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber, formatPct } from "@/lib/format";
import { InfoHint } from "@/components/ui/info-hint";
import type { IndicatorCardVM } from "@/lib/data/cities/indicator-blocks";

function formatValue(unit: IndicatorCardVM["unit"], v: number): string {
  if (unit === "currency") return `R$ ${v.toFixed(1).replace(".", ",")}`;
  if (unit === "percent") return formatPct(v);
  return formatNumber(v);
}

export function CityIndicatorCard({ kpi, onClick }: { kpi: IndicatorCardVM; onClick?: () => void }) {
  if (!kpi.available) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-dashed border-border bg-secondary/20 p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Lock className="h-4 w-4" />
          <h3 className="text-sm font-medium">{kpi.label}</h3>
          <InfoHint def={{ formula: kpi.description }} />
        </div>
        <div className="mt-4 text-sm font-medium text-muted-foreground">Sem acesso aos dados</div>
        <p className="mt-1 text-[11px] text-muted-foreground">Aguardando liberação do time de dados.</p>
      </div>
    );
  }

  const inverse = kpi.polarity === "down";
  const hasMeta = kpi.meta !== null && kpi.atingimento !== null;
  const atin = kpi.atingimento ?? 0;
  const good = inverse ? atin <= 100 : atin >= 100;
  const warn = inverse ? atin > 100 && atin <= 130 : atin >= 70 && atin < 100;
  const barColor = good ? "bg-success" : warn ? "bg-warning" : "bg-destructive";

  const up = kpi.delta > 0.05;
  const down = kpi.delta < -0.05;
  const deltaGood = inverse ? down : up;
  const DeltaIcon = up ? ArrowUp : down ? ArrowDown : Minus;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative w-full overflow-hidden rounded-xl border border-border bg-gradient-card p-5 text-left shadow-elegant transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-glow focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-medium text-muted-foreground">{kpi.label}</h3>
          <InfoHint def={{ formula: kpi.description }} />
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

      <div className="mt-3 text-3xl font-bold tracking-tight text-foreground">
        {formatValue(kpi.unit, kpi.value)}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {hasMeta ? `Meta ${formatValue(kpi.unit, kpi.meta as number)} · ${formatPct(atin, 0)}` : "Meta —"}
      </div>

      {hasMeta && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div className={cn("h-full rounded-full", barColor)} style={{ width: `${Math.max(2, Math.min(100, atin))}%` }} />
        </div>
      )}
    </button>
  );
}
