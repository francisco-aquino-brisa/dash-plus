"use client";

import { Building, Globe, Lock, MapPin, Trophy, Users2 } from "lucide-react";
import { formatNumber } from "@/lib/format";
import type { RankingEscopo, RankingView } from "@/lib/data/vendedor/types";

const ICONS: Record<RankingEscopo["escopo"], React.ElementType> = {
  cidade: MapPin,
  coordenacao: Users2,
  gerencia: Building,
  geral: Globe,
};

export function RankingsBlock({ ranking }: { ranking: RankingView }) {
  return (
    <section className="rounded-2xl border border-border bg-card/40 p-5 shadow-elegant backdrop-blur">
      <header className="mb-4 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary">
          <Trophy className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Rankings</h2>
          <p className="text-sm text-muted-foreground">{ranking.metrica || "Posição do vendedor"}</p>
        </div>
      </header>

      {!ranking.available || ranking.escopos.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-secondary/20 px-3 py-4 text-sm text-muted-foreground">
          <Lock className="h-4 w-4" /> Ranking indisponível para este vendedor no período.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ranking.escopos.map((e) => {
            const Icon = ICONS[e.escopo];
            return (
              <div key={e.escopo} className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 p-3">
                <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                  <Icon className="h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium uppercase tracking-wider">{e.label}</div>
                    <div className="truncate text-[11px] text-muted-foreground/80" title={e.contexto}>
                      {e.contexto}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-foreground">
                    {e.posicao != null ? `${e.posicao}º` : "—"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">de {formatNumber(e.total)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
