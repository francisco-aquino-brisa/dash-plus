"use client";

import { useMemo, useState } from "react";
import type { NegativeRow, NegativesByLevel, QuartileLevel } from "@/lib/data/cities/compute";
import { formatNumber, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

const STATUS_STYLE: Record<NegativeRow["status"], string> = {
  "Negativa Crescimento": "bg-warning/15 text-warning",
  "Negativa Base Ativa": "bg-accent/15 text-accent",
  Ambas: "bg-destructive/15 text-destructive",
};

const LEVELS: { key: QuartileLevel; label: string; noun: string }[] = [
  { key: "gerencia", label: "Gerência", noun: "gerência(s)" },
  { key: "coordenacao", label: "Coordenação", noun: "coordenação(ões)" },
  { key: "cidade", label: "Cidade", noun: "cidade(s)" },
];

function atinCrescTone(a: number): string {
  if (a < 0) return "text-destructive";

  if (a < 70) return "text-warning";

  return "text-foreground";
}

/** Meta/Resultado/Ating. cells shared across levels. */
function MetricCells({ r }: { r: NegativeRow }) {
  return (
    <>
      <td className="px-3 py-2 text-right">{formatNumber(r.metaCrescimento)}</td>
      <td className={cn("px-3 py-2 text-right", r.resultadoCrescimento < 0 && "text-destructive")}>
        {formatNumber(r.resultadoCrescimento, { signed: true })}
      </td>
      <td className={cn("px-3 py-2 text-right font-semibold", atinCrescTone(r.atingCresc))}>
        {formatPct(r.atingCresc, 0)}
      </td>
      <td className="px-3 py-2 text-right">{formatNumber(r.metaBaseAtiva)}</td>
      <td className="px-3 py-2 text-right">{formatNumber(r.resultadoBaseAtiva)}</td>
      <td
        className={cn(
          "px-3 py-2 text-right font-semibold",
          r.atingBaseAtiva < 100 ? "text-warning" : "text-success",
        )}
      >
        {formatPct(r.atingBaseAtiva, 0)}
      </td>
      <td className="px-3 py-2">
        <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", STATUS_STYLE[r.status])}>
          {r.status}
        </span>
      </td>
    </>
  );
}

export function NegativeCitiesTable({ data }: { data: NegativesByLevel }) {
  const [level, setLevel] = useState<QuartileLevel>("cidade");
  const [q, setQ] = useState("");

  const rows = data[level];
  const filtered = useMemo(
    () => rows.filter((r) => r.nome.toLowerCase().includes(q.toLowerCase())),
    [rows, q],
  );
  const noun = LEVELS.find((l) => l.key === level)?.noun ?? "";
  const nameLabel = LEVELS.find((l) => l.key === level)?.label ?? "";
  const isCity = level === "cidade";
  const cols = isCity ? 11 : 9;

  return (
    <div className="rounded-xl border border-border bg-card/40">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div>
          <h3 className="font-semibold">Negativações</h3>
          <p className="text-xs text-muted-foreground">
            {filtered.length} {noun} abaixo da meta de crescimento ou base ativa
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Tabs: drill level (Gerência / Coordenação / Cidade). */}
          <div className="flex gap-1 rounded-lg bg-secondary/50 p-1">
            {LEVELS.map((l) => (
              <button
                key={l.key}
                type="button"
                onClick={() => setLevel(l.key)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  level === l.key
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {l.label}
              </button>
            ))}
          </div>
          <div className="relative w-56">
            <Search className="pointer-events-none absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={`Buscar ${nameLabel.toLowerCase()}…`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-8 bg-secondary/60 pl-7 text-sm"
            />
          </div>
        </div>
      </div>
      <div className="max-h-[440px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur">
            <tr className="text-left text-xs tracking-wider text-muted-foreground uppercase">
              <th className="px-4 py-2 font-medium">{nameLabel}</th>
              {isCity ? (
                <>
                  <th className="px-3 py-2 font-medium">Gerência</th>
                  <th className="px-3 py-2 font-medium">Coord.</th>
                  <th className="px-3 py-2 font-medium">Tec</th>
                </>
              ) : (
                <th className="px-3 py-2 text-right font-medium">Cidades</th>
              )}
              <th className="px-3 py-2 text-right font-medium">Meta Cresc.</th>
              <th className="px-3 py-2 text-right font-medium">Resultado</th>
              <th className="px-3 py-2 text-right font-medium">Ating.</th>
              <th className="px-3 py-2 text-right font-medium">Meta BA</th>
              <th className="px-3 py-2 text-right font-medium">Resultado BA</th>
              <th className="px-3 py-2 text-right font-medium">Ating. BA</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={`${r.nome}-${i}`} className="border-t border-border/40 hover:bg-secondary/40">
                <td className="px-4 py-2 font-medium">{r.nome}</td>
                {isCity ? (
                  <>
                    <td className="px-3 py-2 text-muted-foreground">{r.gerencia}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.coordenacao}</td>
                    <td className="px-3 py-2">{r.tecnologia}</td>
                  </>
                ) : (
                  <td className="px-3 py-2 text-right text-muted-foreground">{r.cidades}</td>
                )}
                <MetricCells r={r} />
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={cols} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Nenhuma {nameLabel.toLowerCase()} negativa com os filtros atuais.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
