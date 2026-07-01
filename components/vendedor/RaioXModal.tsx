"use client";

import { Lock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatNumber } from "@/lib/format";
import type { ServicoCard } from "@/lib/data/vendedor/types";

/** Working days (Mon–Fri) in a month — an estimate for the pro-rata projeção. */
function businessDays(ano: number, mes: number): number {
  const last = new Date(ano, mes, 0).getDate();
  let n = 0;
  for (let d = 1; d <= last; d++) {
    const dow = new Date(ano, mes - 1, d).getDay();
    if (dow !== 0 && dow !== 6) n++;
  }
  return n;
}

export function RaioXModal({
  card,
  ano,
  mes,
  isCurrentMonth,
  onClose,
}: {
  card: ServicoCard | null;
  ano: number;
  mes: number;
  isCurrentMonth: boolean;
  onClose: () => void;
}) {
  const totalUteis = businessDays(ano, mes);
  // NDU = dias úteis decorridos; project realizado to end of month (current month only).
  const factor = isCurrentMonth && card && card.ndu > 0 ? Math.max(1, totalUteis / card.ndu) : 1;

  return (
    <Dialog open={!!card} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        {card && (
          <>
            <DialogHeader>
              <DialogTitle>Raio-X · {card.label}</DialogTitle>
            </DialogHeader>
            <p className="text-[11px] text-muted-foreground">
              {isCurrentMonth
                ? `Projeção pro-rata sobre ${totalUteis} dias úteis (estimativa).`
                : "Mês fechado — projeção igual ao realizado."}
            </p>

            <div className="max-h-[60vh] space-y-3 overflow-y-auto">
              {card.indicadores.map((ind) => {
                const projReal = Math.round(ind.realizado * factor);
                return (
                  <div key={ind.label} className="rounded-xl border border-border bg-secondary/30 p-3">
                    <h4 className="mb-2 text-sm font-semibold text-foreground">{ind.label}</h4>
                    <div className="grid grid-cols-3 gap-2">
                      <Box label="Realizado" value={formatNumber(ind.realizado)} accent />
                      <Box label="Projeção" value={formatNumber(projReal)} />
                      <Box label="Atingimento" value="—" muted />
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 rounded-md border border-dashed border-border bg-card px-2 py-1.5 text-[10px] text-muted-foreground">
                      <Lock className="h-3 w-3" /> Atingimento estimado e quintil aguardando meta por vendedor.
                    </div>
                  </div>
                );
              })}

              {card.aguardando.length > 0 && (
                <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-3">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Outros indicadores aguardando meta/fonte
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
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Box({ label, value, accent, muted }: { label: string; value: string; accent?: boolean; muted?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-2 text-center">
      <div className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={accent ? "text-sm font-bold text-primary" : muted ? "text-sm font-bold text-muted-foreground" : "text-sm font-bold text-foreground"}>
        {value}
      </div>
    </div>
  );
}
