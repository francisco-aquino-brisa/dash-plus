"use client";

import { useMemo, useState } from "react";
import type { QuartileLevel, QuartilesByLevel } from "@/lib/data/cities/compute";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  data: QuartilesByLevel;
}

const COLORS = ["bg-success", "bg-accent", "bg-warning", "bg-destructive"];

const LEVELS: { key: QuartileLevel; label: string }[] = [
  { key: "gerencia", label: "Gerência" },
  { key: "coordenacao", label: "Coordenação" },
  { key: "cidade", label: "Cidade" },
];

function atinTone(a: number): string {
  if (a >= 100) return "text-success";

  if (a >= 70) return "text-accent";

  if (a >= 0) return "text-warning";

  return "text-destructive";
}

export function QuartileChart({ data }: Props) {
  const [level, setLevel] = useState<QuartileLevel>("gerencia");
  const [active, setActive] = useState<number | null>(null);

  // Switching the drill level keeps the selected quartile (Q1-Q4 exist at every
  // level) and just re-renders its list for the new aggregation.
  const buckets = data[level];
  const max = Math.max(...buckets.map((b) => b.count), 1);
  const list = useMemo(() => (active !== null ? buckets[active].itens.slice(0, 50) : []), [active, buckets]);
  const levelLabel = LEVELS.find((l) => l.key === level)?.label ?? "";

  return (
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-3">
        {buckets.map((b, i) => (
          <button
            key={b.label}
            onClick={() => setActive(active === i ? null : i)}
            className={cn(
              "group block w-full rounded-lg border border-border bg-card/40 p-3 text-left transition hover:border-primary/40",
              active === i && "border-primary/60 bg-card",
            )}
          >
            <div className="flex items-center justify-between text-sm">
              <div>
                <div className="font-medium text-foreground">{b.label}</div>
                <div className="text-xs text-muted-foreground">{b.range}</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">{b.count}</div>
                <div className="text-xs text-muted-foreground">{b.pct.toFixed(1)}%</div>
              </div>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-secondary">
              <div
                className={cn("h-full rounded-full transition-all", COLORS[i])}
                style={{ width: `${(b.count / max) * 100}%` }}
              />
            </div>
            <div className="mt-1.5 text-right text-xs text-muted-foreground">
              Real {formatNumber(b.real)} / Meta {formatNumber(b.meta)}
            </div>
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card/40 p-4">
        {/* Tabs: choose the drill level — only once a quartile is selected. */}
        {active !== null && (
          <div className="mb-3 flex gap-1 rounded-lg bg-secondary/50 p-1">
            {LEVELS.map((l) => (
              <button
                key={l.key}
                type="button"
                onClick={() => setLevel(l.key)}
                className={cn(
                  "flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  level === l.key
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {l.label}
              </button>
            ))}
          </div>
        )}

        <h4 className="mb-2 text-sm font-semibold">
          {active !== null ? `${levelLabel} · ${buckets[active].label}` : `Selecione um quartil`}
        </h4>

        {active === null ? (
          <p className="text-sm text-muted-foreground">
            Clique em uma faixa para ver {levelLabel.toLowerCase()} correspondentes.
          </p>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada nesta faixa.</p>
        ) : (
          <>
            <div className="flex items-center justify-between px-2 pb-1 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
              <span>{levelLabel}</span>
              <span>Real / Meta · Ating.</span>
            </div>
            <ul className="max-h-[280px] space-y-1 overflow-y-auto pr-1 text-sm">
              {list.map((c, idx) => (
                <li
                  key={`${c.nome}-${idx}`}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-secondary/50"
                >
                  <span className="truncate">{c.nome}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {formatNumber(c.real)} / {formatNumber(c.meta)}
                    </span>
                    <span className={cn("w-10 text-right text-xs font-semibold", atinTone(c.atingimento))}>
                      {c.atingimento.toFixed(0)}%
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
