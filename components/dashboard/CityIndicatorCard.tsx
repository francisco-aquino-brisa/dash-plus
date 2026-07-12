"use client";

import {
  Activity,
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  ArrowUpRight,
  Ban,
  CheckCircle2,
  DollarSign,
  Flame,
  Layers,
  Lock,
  Minus,
  Percent,
  Radio,
  RefreshCw,
  Rocket,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  UserMinus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber, formatPct } from "@/lib/format";
import { InfoHint } from "@/components/ui/info-hint";
import type { FooterStatVM, IndicatorCardVM } from "@/lib/data/cities/indicator-blocks";

// Icon per id_indicador (shared meaning across blocks). Falls back by unit.
const ICON_BY_ID: Record<string, LucideIcon> = {
  BA01: Users,
  BA02: ArrowUpRight,
  BA03: TrendingDown,
  BA04: TrendingUp,
  BA10: Ban,
  BA11: UserMinus,
  BA12: UserMinus,
  BA13: RefreshCw,
  CA01: Flame,
  CA02: Flame,
  CA03: Flame,
  CA04: Flame,
  CA09: Flame,
  CA10: Flame,
  CA12: Flame,
  VE01: ShoppingCart,
  VE02: CheckCircle2,
  VE03: Rocket,
  VE04: Radio,
  VE05: Percent,
  VE06: Percent,
  VE27: Layers,
  VE32: ArrowLeftRight,
  VE33: ArrowLeftRight,
  VE34: Percent,
  VE35: Percent,
  VE51: Radio,
};

function iconFor(kpi: IndicatorCardVM): LucideIcon {
  return (
    ICON_BY_ID[kpi.id] ?? (kpi.unit === "currency" ? DollarSign : kpi.unit === "percent" ? Percent : Activity)
  );
}

function formatValue(unit: IndicatorCardVM["unit"], v: number, decimals = 1): string {
  if (unit === "currency") return `R$ ${v.toFixed(decimals).replace(".", ",")}`;

  if (unit === "percent") return formatPct(v, decimals);

  return formatNumber(v);
}

const TONE_CLASS: Record<FooterStatVM["tone"], string> = {
  good: "text-success",
  warn: "text-warning",
  bad: "text-destructive",
  default: "text-foreground",
};

export function CityIndicatorCard({ kpi, onClick }: { kpi: IndicatorCardVM; onClick?: () => void }) {
  const Icon = iconFor(kpi);

  if (!kpi.available) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-dashed border-border bg-secondary/20 p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-secondary/60">
            <Lock className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-medium">{kpi.label}</h3>
          <InfoHint def={{ formula: kpi.description }} />
        </div>
        <div className="mt-4 text-sm font-medium text-muted-foreground">Sem acesso aos dados</div>
        <p className="mt-1 text-[11px] text-muted-foreground">Aguardando liberação do time de dados.</p>
      </div>
    );
  }

  const inverse = kpi.polarity === "down";
  const hasMeta = kpi.attainment !== null;
  const atin = kpi.attainment ?? 0;
  const good = inverse ? atin <= 100 : atin >= 100;
  const warn = inverse ? atin > 100 && atin <= 130 : atin >= 70 && atin < 100;
  const atinColor = good ? "text-success" : warn ? "text-warning" : "text-destructive";
  const barColor = good ? "bg-success" : warn ? "bg-warning" : "bg-destructive";

  const up = kpi.delta > 0.5;
  const down = kpi.delta < -0.5;
  const tendGood = inverse ? down : up;
  const TendIcon = up ? ArrowUp : down ? ArrowDown : Minus;

  const cols = Math.max(1, kpi.footer.length);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group bg-gradient-card shadow-elegant hover:shadow-glow relative w-full overflow-hidden rounded-xl border border-border p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary">
            <Icon className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-medium text-muted-foreground">{kpi.label}</h3>
          <InfoHint def={{ formula: kpi.description }} />
        </div>
        <span
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
            tendGood ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
          )}
        >
          <TendIcon className="h-3 w-3" /> {Math.abs(kpi.delta).toFixed(1).replace(".", ",")}%
        </span>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-bold tracking-tight text-foreground">
          {formatValue(kpi.unit, kpi.value, kpi.decimals)}
        </span>
        {hasMeta && <span className={cn("text-sm font-semibold", atinColor)}>{atin.toFixed(0)}%</span>}
      </div>

      {kpi.footer.length > 0 && (
        <div
          className="mt-3 grid gap-2 border-t border-border/60 pt-3 text-xs"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {kpi.footer.map((stat) => (
            <div key={stat.label}>
              <div className="text-muted-foreground">{stat.label}</div>
              <div className={cn("font-semibold", TONE_CLASS[stat.tone])}>{stat.display}</div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
        {hasMeta && (
          <div
            className={cn("h-full rounded-full", barColor)}
            style={{ width: `${Math.max(2, Math.min(100, atin))}%` }}
          />
        )}
      </div>
    </button>
  );
}
