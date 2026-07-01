"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Lock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InfoHint } from "@/components/ui/info-hint";
import { getIndicatorDef } from "@/lib/indicators/definitions";
import { cn } from "@/lib/utils";
import type { FreeIndicator } from "@/lib/data/sales/types";

export function SelecaoLivre({
  indicators,
  series,
}: {
  indicators: FreeIndicator[];
  series: Record<string, { mes: string; valor: number }[]>;
}) {
  const firstAvailable = indicators.find((i) => i.available)?.nome ?? indicators[0]?.nome ?? "";
  const [selected, setSelected] = useState(firstAvailable);
  const [kind, setKind] = useState<"linha" | "coluna">("linha");

  const data = series[selected];
  const blocked = !data;
  const selectedDef = getIndicatorDef(selected);

  return (
    <section className="rounded-2xl border border-border bg-card/40 p-5 shadow-elegant backdrop-blur">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Seleção Livre de Indicadores</h2>
          <p className="text-sm text-muted-foreground">Escolha um indicador para visualizar a série</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedDef ? <InfoHint def={selectedDef} /> : null}
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="h-9 min-w-[260px] bg-secondary/60 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {indicators.map((i) => (
                <SelectItem key={i.nome} value={i.nome} disabled={!i.available}>
                  {i.nome}
                  {!i.available && " · sem acesso"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-1 rounded-lg border border-border bg-secondary/40 p-0.5">
            {(["linha", "coluna"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={cn(
                  "cursor-pointer rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors",
                  kind === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {k}
              </button>
            ))}
          </div>
        </div>
      </header>

      {blocked ? (
        <div className="grid h-[300px] place-items-center rounded-lg border border-dashed border-border bg-secondary/20 text-center">
          <div>
            <Lock className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium text-muted-foreground">Sem acesso aos dados deste indicador</p>
            <p className="text-[11px] text-muted-foreground">Aguardando liberação do time de dados.</p>
          </div>
        </div>
      ) : (
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {kind === "linha" ? (
              <LineChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="valor" stroke="var(--primary)" strokeWidth={2} dot={false} />
              </LineChart>
            ) : (
              <BarChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} cursor={{ fill: "var(--secondary)" }} />
                <Bar dataKey="valor" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
