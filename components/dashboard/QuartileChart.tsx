"use client";

import { useMemo, useState } from "react";
import type { QuartileBucket } from "@/lib/data/cities/compute";
import { cn } from "@/lib/utils";

interface Props {
  buckets: QuartileBucket[];
}

const COLORS = ["bg-success", "bg-accent", "bg-warning", "bg-destructive"];

export function QuartileChart({ buckets }: Props) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...buckets.map((b) => b.count), 1);
  const list = useMemo(
    () => (active !== null ? buckets[active].cidades.slice(0, 30) : []),
    [active, buckets],
  );

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
          </button>
        ))}
      </div>
      <div className="rounded-lg border border-border bg-card/40 p-4">
        <h4 className="mb-2 text-sm font-semibold">
          {active !== null ? `Cidades · ${buckets[active].label}` : "Selecione um quartil"}
        </h4>
        {active === null ? (
          <p className="text-sm text-muted-foreground">
            Clique em uma faixa para ver as cidades correspondentes.
          </p>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem cidades nesta faixa.</p>
        ) : (
          <ul className="max-h-[280px] space-y-1 overflow-y-auto pr-1 text-sm">
            {list.map((c, idx) => (
              <li
                key={`${c.cidade}-${c.tecnologia}-${idx}`}
                className="flex items-center justify-between rounded-md px-2 py-1 hover:bg-secondary/50"
              >
                <span className="truncate">
                  {c.cidade} <span className="text-xs text-muted-foreground">· {c.tecnologia}</span>
                </span>
                <span
                  className={cn(
                    "text-xs font-semibold",
                    c.atingimento >= 100
                      ? "text-success"
                      : c.atingimento >= 70
                        ? "text-accent"
                        : c.atingimento >= 0
                          ? "text-warning"
                          : "text-destructive",
                  )}
                >
                  {c.atingimento.toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
