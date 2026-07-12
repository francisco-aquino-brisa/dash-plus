"use client";

import { ArrowDown, ArrowUp, Minus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber, formatPct } from "@/lib/format";
import { InfoHint } from "@/components/ui/info-hint";
import { getIndicatorDef } from "@/lib/indicators/definitions";
import type { KpiValue } from "@/lib/data/cities/compute";

interface Props {
  title: string;
  icon: LucideIcon;
  kpi: KpiValue;
  highlight?: boolean;
  onClick?: () => void;
}

export function KpiCard({ title, icon: Icon, kpi, highlight, onClick }: Props) {
  const good = kpi.inverse ? kpi.atingimento <= 100 : kpi.atingimento >= 100;
  const warn = kpi.inverse
    ? kpi.atingimento > 100 && kpi.atingimento <= 130
    : kpi.atingimento >= 70 && kpi.atingimento < 100;
  const atinColor = good ? "text-success" : warn ? "text-warning" : "text-destructive";

  const tendUp = kpi.tendencia > 0.5;
  const tendDown = kpi.tendencia < -0.5;
  const tendGood = kpi.inverse ? tendDown : tendUp;
  const TendIcon = tendUp ? ArrowUp : tendDown ? ArrowDown : Minus;

  const fmt = (n: number) => (kpi.isPct ? formatPct(n) : formatNumber(n));
  const def = getIndicatorDef(title);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group bg-gradient-card shadow-elegant hover:shadow-glow relative w-full overflow-hidden rounded-xl border border-border p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
        highlight && "ring-1 ring-primary/30",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary">
            <Icon className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
          {def && <InfoHint def={def} />}
        </div>
        <span
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
            tendGood ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
          )}
        >
          <TendIcon className="h-3 w-3" /> {Math.abs(kpi.tendencia).toFixed(1)}%
        </span>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-bold tracking-tight text-foreground">{fmt(kpi.resultado)}</span>
        <span className={cn("text-sm font-semibold", atinColor)}>{kpi.atingimento.toFixed(0)}%</span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-xs">
        <div>
          <div className="text-muted-foreground">Meta</div>
          <div className="font-semibold text-foreground">{fmt(kpi.meta)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Projeção</div>
          <div className="font-semibold text-foreground">{fmt(kpi.projecao)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Ating.</div>
          <div className={cn("font-semibold", atinColor)}>{kpi.atingimento.toFixed(0)}%</div>
        </div>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn("h-full rounded-full", good ? "bg-success" : warn ? "bg-warning" : "bg-destructive")}
          style={{ width: `${Math.max(2, Math.min(100, kpi.atingimento))}%` }}
        />
      </div>
    </button>
  );
}
