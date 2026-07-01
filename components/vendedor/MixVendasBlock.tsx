"use client";

import { useState } from "react";
import { Globe, Radio, RefreshCw, Smartphone, Wifi } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MixItem, StatusVenda } from "@/lib/data/vendedor/types";

const SERVICO_ICONS: Record<string, React.ElementType> = {
  FTTH: Wifi,
  FWA: Radio,
  "5G": Smartphone,
  Banda: Globe,
  Renovação: RefreshCw,
};

const STATUS_TABS: (StatusVenda | "Todos")[] = ["Todos", "Criado", "Efetivado", "Instalado"];
const SERVICO_TABS = ["Todos", "FTTH", "FWA", "5G", "Renovação"] as const;

const STATUS_COLOR: Record<StatusVenda, string> = {
  Criado: "bg-secondary text-secondary-foreground",
  Efetivado: "bg-accent/20 text-accent-foreground",
  Instalado: "bg-success/15 text-success",
};

export function MixVendasBlock({ mix }: { mix: MixItem[] }) {
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]>("Todos");
  const [servico, setServico] = useState<(typeof SERVICO_TABS)[number]>("Todos");

  const filtered = mix.filter(
    (m) => (status === "Todos" || m.status === status) && (servico === "Todos" || m.servico === servico),
  );

  return (
    <section className="rounded-2xl border border-border bg-card/40 p-5 shadow-elegant backdrop-blur">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Mix de Vendas</h2>
          <p className="text-sm text-muted-foreground">Distribuição por serviço · {filtered.length} linha(s)</p>
        </div>
      </header>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {SERVICO_TABS.map((s) => (
          <Chip key={s} active={servico === s} onClick={() => setServico(s)}>
            {s}
          </Chip>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {STATUS_TABS.map((s) => (
          <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
            {s}
          </Chip>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-secondary/20 px-3 py-6 text-center text-sm text-muted-foreground">
          Nenhuma venda para os filtros atuais.
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((m, i) => {
            const Icon = SERVICO_ICONS[m.servico] ?? Globe;
            return (
              <div
                key={`${m.servico}-${m.status}-${i}`}
                className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-card text-muted-foreground">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{m.servico}</div>
                    <span className={cn("mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium", STATUS_COLOR[m.status])}>
                      {m.status}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold leading-none text-foreground">{formatNumber(m.vendas)}</div>
                  <div className="mt-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">Vendas</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-[10px] font-medium uppercase tracking-wider transition-colors",
        active
          ? "border-primary/40 bg-primary/15 text-primary"
          : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
