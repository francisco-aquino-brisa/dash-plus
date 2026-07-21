"use client";

import { useState } from "react";
import { Globe, Radio, Smartphone, Wifi } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MixOferta, StatusVenda } from "@/lib/data/vendedor/types";

const SERVICO_ICONS: Record<MixOferta["servico"], React.ElementType> = {
  FTTH: Wifi,
  FWA: Radio,
  "5G": Smartphone,
};

/** Service filter buttons — "MIX" = todos; "Banda" = FTTH + FWA. */
const SERVICO_TABS = ["MIX", "FTTH", "FWA", "5G", "Banda"] as const;
const STATUS_TABS: StatusVenda[] = ["Criado", "Efetivado", "Instalado"];

const STATUS_COLOR: Record<StatusVenda, string> = {
  Criado: "bg-secondary text-secondary-foreground",
  Efetivado: "bg-accent/20 text-accent-foreground",
  Instalado: "bg-success/15 text-success",
};

function toggled<T>(set: Set<T>, v: T): Set<T> {
  const next = new Set(set);

  if (next.has(v)) next.delete(v);
  else next.add(v);

  return next;
}

export function MixVendasBlock({ mix }: { mix: MixOferta[] }) {
  // Empty set = "todos". Both filters are multi-select.
  const [servicos, setServicos] = useState<Set<string>>(new Set());
  const [statuses, setStatuses] = useState<Set<StatusVenda>>(new Set());

  const matchServico = (m: MixOferta) =>
    servicos.size === 0 ||
    servicos.has(m.servico) ||
    (servicos.has("Banda") && (m.servico === "FTTH" || m.servico === "FWA"));
  const matchStatus = (m: MixOferta) => statuses.size === 0 || statuses.has(m.status);

  const filtered = mix.filter((m) => matchServico(m) && matchStatus(m));

  return (
    <section className="shadow-elegant rounded-2xl border border-border bg-card/40 p-5 backdrop-blur">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Mix de Vendas</h2>
          <p className="text-sm text-muted-foreground">
            Ofertas vendidas no período · {filtered.length} oferta(s)
          </p>
        </div>
      </header>

      {/* Serviço (multi-select; MIX limpa a seleção) */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {SERVICO_TABS.map((s) => (
          <Chip
            key={s}
            active={s === "MIX" ? servicos.size === 0 : servicos.has(s)}
            onClick={() => setServicos(s === "MIX" ? new Set() : toggled(servicos, s))}
          >
            {s}
          </Chip>
        ))}
      </div>
      {/* Status (multi-select; nenhum = todos) */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {STATUS_TABS.map((s) => (
          <Chip key={s} active={statuses.has(s)} onClick={() => setStatuses(toggled(statuses, s))}>
            {s}
          </Chip>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-secondary/20 px-3 py-6 text-center text-sm text-muted-foreground">
          Nenhuma oferta para os filtros atuais.
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((m, i) => {
            const Icon = SERVICO_ICONS[m.servico] ?? Globe;

            return (
              <div
                key={`${m.titulo}-${m.servico}-${m.status}-${i}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/30 p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-card text-muted-foreground">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">{m.titulo}</div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="rounded bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {m.servico}
                      </span>
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-medium",
                          STATUS_COLOR[m.status],
                        )}
                      >
                        {m.status}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-lg leading-none font-bold text-foreground">
                    {formatNumber(m.vendas)}
                  </div>
                  <div className="mt-1 text-[9px] font-medium tracking-wider text-muted-foreground uppercase">
                    Vendas
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-[10px] font-medium tracking-wider uppercase transition-colors",
        active
          ? "border-primary/40 bg-primary/15 text-primary"
          : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
