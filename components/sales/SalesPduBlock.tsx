"use client";

import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMonth } from "@/lib/format";
import type { PduPoint } from "@/lib/data/sales/types";

const SERIES: { key: keyof Omit<PduPoint, "mes">; color: string }[] = [
  { key: "FTTH", color: "var(--chart-1)" },
  { key: "FWA", color: "var(--chart-2)" },
  { key: "5G", color: "var(--chart-3)" },
];

const nf = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const monthLabel = (mes: string) => (/^\d{4}-\d{2}$/.test(mes) ? formatMonth(mes) : mes);

/** PDU · Produtividade por Dia Útil — one line per technology, 12 months. */
export function SalesPduBlock({ pdu }: { pdu: PduPoint[] | null }) {
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
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: 17,
              letterSpacing: "-.02em",
            }}
          >
            PDU · Produtividade por Dia Útil
          </h2>
          <div style={{ fontSize: 11.5, color: "var(--s-t3)", marginTop: 2 }}>
            Vendas do HC ativo ÷ dias trabalhados, por tecnologia · o filtro de gerente não se aplica
          </div>
        </div>
        {pdu && pdu.length > 0 && (
          <div style={{ display: "flex", gap: 14 }}>
            {SERIES.map((s) => (
              <span
                key={s.key}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: "var(--s-t2)",
                }}
              >
                <span style={{ width: 14, height: 2, borderRadius: 2, background: s.color }} />
                {s.key}
              </span>
            ))}
          </div>
        )}
      </div>

      {pdu === null ? (
        <EmptyState icon title="Sem acesso aos dados">
          Não foi possível ler a produção do HC agora. Tente atualizar em instantes.
        </EmptyState>
      ) : pdu.length === 0 ? (
        <EmptyState title="Sem produção no período">
          Nenhum HC ativo com dias trabalhados para os filtros escolhidos.
        </EmptyState>
      ) : (
        <div style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={pdu} margin={{ top: 12, right: 44, left: -8, bottom: 4 }}>
              <CartesianGrid vertical={false} stroke="var(--s-border)" />
              <XAxis
                dataKey="mes"
                tickFormatter={monthLabel}
                tick={{ fontSize: 10.5, fill: "var(--s-t3)", fontWeight: 600 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={(v: number) => nf.format(v)}
                tick={{ fontSize: 10.5, fill: "var(--s-t3)" }}
                tickLine={false}
                axisLine={false}
                width={44}
              />
              <Tooltip
                cursor={{ stroke: "var(--s-border-2)" }}
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <div
                      style={{
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: "1px solid var(--s-border)",
                        background: "var(--s-raise)",
                        boxShadow: "var(--s-sh-2)",
                        fontSize: 12,
                        color: "var(--s-t1)",
                      }}
                    >
                      <div style={{ fontWeight: 800, marginBottom: 4 }}>{monthLabel(String(label))}</div>
                      {SERIES.map((s) => {
                        const p = payload.find((x) => x.dataKey === s.key);

                        return (
                          <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 999, background: s.color }} />
                            <span style={{ color: "var(--s-t2)", minWidth: 40 }}>{s.key}</span>
                            <span style={{ fontWeight: 700 }}>{nf.format(Number(p?.value ?? 0))}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : null
                }
              />
              {SERIES.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.key}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 0, fill: s.color }}
                  activeDot={{ r: 5, stroke: "var(--s-card)", strokeWidth: 2 }}
                  isAnimationActive={false}
                  label={(p: { index?: number; x?: number; y?: number; value?: number }) =>
                    p.index === pdu.length - 1 ? (
                      <text
                        key={`${s.key}-end`}
                        x={(p.x ?? 0) + 8}
                        y={(p.y ?? 0) + 4}
                        fontSize={11}
                        fontWeight={700}
                        fill="var(--s-t1)"
                      >
                        {nf.format(Number(p.value ?? 0))}
                      </text>
                    ) : (
                      <g key={`${s.key}-${p.index}`} />
                    )
                  }
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function EmptyState({ icon, title, children }: { icon?: boolean; title: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding: "34px 16px",
        textAlign: "center",
        border: "1px dashed var(--s-border-2)",
        borderRadius: 14,
      }}
    >
      {icon && (
        <span
          style={{
            display: "grid",
            placeItems: "center",
            width: 40,
            height: 40,
            borderRadius: 12,
            background: "var(--s-sunken)",
            color: "var(--s-t3)",
          }}
        >
          <Lock size={20} />
        </span>
      )}
      <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--s-t1)" }}>{title}</div>
      <div style={{ fontSize: 12, color: "var(--s-t3)", maxWidth: 420, lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}
