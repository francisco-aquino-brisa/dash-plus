"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { DiasZeradosView, ServicoKey } from "@/lib/data/vendedor/types";

const FILTROS = ["Todos", "FTTH", "FWA", "5G", "Banda"] as const;
const SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
const MESES_LONG = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const TILES: ServicoKey[] = ["FTTH", "FWA", "5G", "Banda"];

/**
 * Dias Zerados (SCREENS §4.4): a `--s-warn-bg` band with a per-technology count
 * of zeroed days, opening the legacy month calendar (restyled) that marks
 * zeroed / sold / holiday / future days per service filter.
 */
export function DiasZeradosBlock({ dias }: { dias: DiasZeradosView }) {
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]>("Todos");

  const totalTodos = dias.resumo.find((r) => r.servico === "Todos")?.dias ?? 0;
  const countFor = (k: string) => dias.resumo.find((r) => r.servico === k)?.dias ?? 0;

  const lastDay = new Date(dias.ano, dias.mes, 0).getDate();
  const firstDow = new Date(dias.ano, dias.mes - 1, 1).getDay();
  const zerados = new Set(dias.zeradosPorServico[filtro] ?? []);
  const comVenda = new Set(dias.comVendaPorServico[filtro] ?? []);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          style={{
            width: "100%",
            textAlign: "left",
            font: "inherit",
            cursor: "pointer",
            border: "1px solid var(--s-warn)",
            borderRadius: "var(--r-panel)",
            background: "var(--s-warn-bg)",
            padding: 14,
            display: "flex",
            flexDirection: "column",
            gap: 11,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                flex: "none",
                display: "grid",
                placeItems: "center",
                width: 30,
                height: 30,
                borderRadius: 9,
                background: "rgba(255,255,255,.55)",
                color: "var(--s-warn)",
              }}
            >
              <AlertTriangle size={16} />
            </span>
            <span style={{ flex: 1 }}>
              <span
                style={{
                  display: "block",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  color: "var(--s-warn)",
                }}
              >
                Dias zerados
              </span>
              <span
                style={{
                  display: "block",
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: "var(--s-t1)",
                  marginTop: 1,
                }}
              >
                {totalTodos} dia(s) sem venda no mês
              </span>
            </span>
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 8 }}
          >
            {TILES.map((k) => (
              <span
                key={k}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                  borderRadius: 11,
                  background: "rgba(255,255,255,.6)",
                  padding: 9,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 800,
                    fontSize: 18,
                    color: "var(--s-t1)",
                  }}
                >
                  {countFor(k)}
                </span>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".09em", color: "var(--s-t3)" }}>
                  {k.toUpperCase()}
                </span>
              </span>
            ))}
          </div>
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle size={18} style={{ color: "var(--s-warn)" }} /> Dias Zerados
          </DialogTitle>
        </DialogHeader>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {FILTROS.map((f) => {
            const active = filtro === f;

            return (
              <button
                key={f}
                type="button"
                onClick={() => setFiltro(f)}
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
                {f}
              </button>
            );
          })}
        </div>

        <div
          style={{
            border: "1px solid var(--s-border)",
            borderRadius: 14,
            background: "var(--s-card)",
            padding: 16,
          }}
        >
          <h3
            style={{
              marginBottom: 14,
              textAlign: "center",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: ".08em",
              textTransform: "uppercase",
              color: "var(--s-t3)",
            }}
          >
            {MESES_LONG[dias.mes - 1]} {dias.ano}
          </h3>
          <div
            style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, textAlign: "center" }}
          >
            {SEMANA.map((d, i) => (
              <div key={i} style={{ fontSize: 10, fontWeight: 800, color: "var(--s-t3)" }}>
                {d}
              </div>
            ))}
            {Array.from({ length: firstDow }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {Array.from({ length: lastDay }).map((_, i) => {
              const day = i + 1;
              const isFuture = dias.hoje != null && day > dias.hoje;
              const isZerado = zerados.has(day);
              const hasVenda = comVenda.has(day);
              const isToday = dias.hoje === day;
              let bg = "var(--s-sunken)";
              let color = "var(--s-t2)";

              if (isZerado) {
                bg = "var(--s-bad)";
                color = "#fff";
              } else if (hasVenda) {
                bg = "var(--s-ok-bg)";
                color = "var(--s-ok)";
              } else if (isFuture) {
                bg = "transparent";
                color = "var(--s-t3)";
              }

              return (
                <div
                  key={day}
                  style={{
                    display: "grid",
                    placeItems: "center",
                    aspectRatio: "1 / 1",
                    borderRadius: 9,
                    fontSize: 11,
                    fontWeight: 600,
                    background: bg,
                    color,
                    outline: isToday ? "2px solid var(--s-brand)" : undefined,
                    outlineOffset: isToday ? 1 : undefined,
                  }}
                >
                  {day}
                </div>
              );
            })}
          </div>
          <div
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTop: "1px solid var(--s-border)",
              display: "flex",
              justifyContent: "center",
              gap: 16,
              fontSize: 10.5,
              fontWeight: 600,
              color: "var(--s-t3)",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: "var(--s-bad)" }} /> Zerado
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: "var(--s-ok)" }} /> Com
              venda
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
