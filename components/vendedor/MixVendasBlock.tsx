"use client";

import { useState } from "react";
import { Globe, Radio, Wifi, Zap, type LucideIcon } from "lucide-react";
import { formatNumber } from "@/lib/format";
import type { MixOferta, StatusVenda } from "@/lib/data/vendedor/types";

const SERVICO_ICONS: Record<MixOferta["servico"], LucideIcon> = {
  FTTH: Wifi,
  FWA: Radio,
  "5G": Zap,
};

/** Service filter buttons — "MIX" = todos; "Banda" = FTTH + FWA. */
const SERVICO_TABS = ["MIX", "FTTH", "FWA", "5G", "Banda"] as const;
const STATUS_TABS: StatusVenda[] = ["Criado", "Efetivado", "Instalado"];

const STATUS_COLOR: Record<StatusVenda, { bg: string; fg: string }> = {
  Criado: { bg: "var(--s-sunken)", fg: "var(--s-t2)" },
  Efetivado: { bg: "var(--s-blue-bg)", fg: "var(--s-blue)" },
  Instalado: { bg: "var(--s-ok-bg)", fg: "var(--s-ok)" },
};

function toggled<T>(set: Set<T>, v: T): Set<T> {
  const next = new Set(set);

  if (next.has(v)) next.delete(v);
  else next.add(v);

  return next;
}

/**
 * Mix de Vendas (legacy block, kept per the migration rule): the vendor's real
 * offers (`plano`) with per-status counts, filterable by service and status.
 * Restyled with `--s-*` tokens; filtering logic unchanged.
 */
export function MixVendasBlock({ mix }: { mix: MixOferta[] }) {
  const [servicos, setServicos] = useState<Set<string>>(new Set());
  const [statuses, setStatuses] = useState<Set<StatusVenda>>(new Set());

  const matchServico = (m: MixOferta) =>
    servicos.size === 0 ||
    servicos.has(m.servico) ||
    (servicos.has("Banda") && (m.servico === "FTTH" || m.servico === "FWA"));
  const matchStatus = (m: MixOferta) => statuses.size === 0 || statuses.has(m.status);

  const filtered = mix.filter((m) => matchServico(m) && matchStatus(m));

  return (
    <section
      style={{
        border: "1px solid var(--s-border)",
        borderRadius: "var(--r-panel)",
        background: "var(--s-card)",
        padding: 15,
        boxShadow: "var(--s-sh)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <header>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: 17,
            letterSpacing: "-.02em",
          }}
        >
          Mix de Vendas
        </h2>
        <div style={{ fontSize: 11.5, color: "var(--s-t3)", marginTop: 2 }}>
          Ofertas vendidas no período · {filtered.length} oferta(s)
        </div>
      </header>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
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
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {STATUS_TABS.map((s) => (
          <Chip key={s} active={statuses.has(s)} onClick={() => setStatuses(toggled(statuses, s))}>
            {s}
          </Chip>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p
          style={{
            border: "1px dashed var(--s-border-2)",
            borderRadius: 12,
            background: "var(--s-sunken)",
            padding: "24px 12px",
            textAlign: "center",
            fontSize: 12.5,
            color: "var(--s-t3)",
          }}
        >
          Nenhuma oferta para os filtros atuais.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((m, i) => {
            const Icon = SERVICO_ICONS[m.servico] ?? Globe;
            const status = STATUS_COLOR[m.status];

            return (
              <div
                key={`${m.titulo}-${m.servico}-${m.status}-${i}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  border: "1px solid var(--s-border)",
                  borderRadius: 12,
                  background: "var(--s-sunken)",
                  padding: 11,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <span
                    style={{
                      flex: "none",
                      display: "grid",
                      placeItems: "center",
                      width: 32,
                      height: 32,
                      borderRadius: 9,
                      background: "var(--s-card)",
                      color: "var(--s-t3)",
                    }}
                  >
                    <Icon size={16} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: "var(--s-t1)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {m.titulo}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                      <Tag>{m.servico}</Tag>
                      <Tag bg={status.bg} fg={status.fg}>
                        {m.status}
                      </Tag>
                    </div>
                  </div>
                </div>
                <div style={{ flex: "none", textAlign: "right" }}>
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 18,
                      fontWeight: 800,
                      color: "var(--s-t1)",
                      lineHeight: 1,
                    }}
                  >
                    {formatNumber(m.vendas)}
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: ".09em",
                      textTransform: "uppercase",
                      color: "var(--s-t3)",
                      marginTop: 3,
                    }}
                  >
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
      type="button"
      onClick={onClick}
      style={{
        padding: "5px 11px",
        border: `1px solid ${active ? "var(--s-brand)" : "var(--s-border)"}`,
        borderRadius: 999,
        background: active ? "var(--s-brand-weak)" : "var(--s-sunken)",
        color: active ? "var(--s-brand)" : "var(--s-t2)",
        font: "inherit",
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: ".04em",
        textTransform: "uppercase",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function Tag({
  children,
  bg = "var(--s-card)",
  fg = "var(--s-t3)",
}: {
  children: React.ReactNode;
  bg?: string;
  fg?: string;
}) {
  return (
    <span
      style={{
        borderRadius: 5,
        background: bg,
        color: fg,
        padding: "1px 6px",
        fontSize: 10,
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
}
