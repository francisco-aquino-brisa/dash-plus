"use client";

import { Lock } from "lucide-react";

const FAIXAS = [
  { label: "≥ 100%", color: "var(--success)" },
  { label: "80% – 99%", color: "oklch(0.7 0.16 130)" },
  { label: "60% – 79%", color: "var(--warning)" },
  { label: "30% – 59%", color: "oklch(0.65 0.18 40)" },
  { label: "< 30%", color: "var(--destructive)" },
];

/**
 * TAM de Vendedores — distribution by achievement quintile. This needs a
 * per-vendedor META, which has no accessible source yet, so it renders disabled
 * (see docs/pending-data-checklist.md), keeping the prototype's structure.
 */
export function TamBlock({ available }: { available: boolean }) {
  return (
    <section className="rounded-2xl border border-dashed border-border bg-secondary/20 p-5">
      <header className="mb-4 flex items-center gap-2">
        <Lock className="h-4 w-4 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-semibold text-foreground">TAM de Vendedores</h2>
          <p className="text-sm text-muted-foreground">
            Distribuição da força de vendas por faixa de atingimento da meta
          </p>
        </div>
      </header>

      {!available && (
        <div className="mb-4 rounded-lg border border-border bg-card/40 p-3 text-sm text-muted-foreground">
          Sem acesso à <strong>meta por vendedor</strong> — necessária para calcular o atingimento. Aguardando
          liberação do time de dados.
        </div>
      )}

      <div className="space-y-2 opacity-50">
        {FAIXAS.map((f) => (
          <div key={f.label} className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-xs text-muted-foreground">{f.label}</span>
            <div className="h-6 flex-1 rounded-md" style={{ background: f.color, opacity: 0.25 }} />
            <span className="w-8 text-right text-xs text-muted-foreground">—</span>
          </div>
        ))}
      </div>
    </section>
  );
}
