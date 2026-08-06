"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCw } from "lucide-react";
import { ModalHeader, ModalShell } from "./AdminModal";
import { DateFilter } from "@/components/ui/date-filter";
import { previewIndicador } from "@/app/(app)/admin/indicadores/actions";
import { type PreviewResult } from "@/lib/data/indicators/sources";
import { formatValor } from "@/lib/data/indicators/ui";

const MN = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// The DateFilter speaks `Mês/YY` (e.g. "Jul/26"); the engine speaks `yyyy-MM`.
function ymToLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);

  return y && m ? `${MN[m - 1]}/${String(y).slice(-2)}` : "";
}

function labelToYm(label: string): string {
  const [mon, yy] = label.split("/");
  const mi = MN.indexOf(mon);

  return mi >= 0 && yy ? `${2000 + Number(yy)}-${String(mi + 1).padStart(2, "0")}` : "";
}

export function IndicadorPreview({
  specJson,
  formato,
  title,
  onClose,
}: {
  specJson: string;
  formato: string;
  title: string;
  onClose: () => void;
}) {
  const [competencia, setCompetencia] = useState("");
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const reqRef = useRef(0);

  async function run(ym?: string) {
    const req = ++reqRef.current;

    setLoading(true);
    setError(null);

    const resp = await previewIndicador(specJson, ym ? { competencia: ym } : {});

    if (req !== reqRef.current) return; // resposta obsoleta — chegou fora de ordem

    setLoading(false);

    if (!resp.ok) {
      setError(resp.error);
      setResult(null);

      return;
    }

    setResult(resp.result);

    // Só sincroniza a competência pelo resultado no carregamento inicial; num clique
    // ela já foi definida na hora (evita o chip "pular" de valor depois).
    if (!ym) setCompetencia(resp.result.competencia ?? "");
  }

  // Initial run on open (latest month).
  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPickMonth = (label: string) => {
    const ym = labelToYm(label);

    if (!ym) return;

    setCompetencia(ym); // reflete o mês escolhido imediatamente no chip
    void run(ym);
  };

  return (
    <ModalShell open onClose={onClose} maxWidth={520} modal={false}>
      <ModalHeader eyebrow="Visualizar indicador" title={title} onClose={onClose} />

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Competência (mesmo seletor do /dashboard) */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <DateFilter
            label="Competência"
            value={competencia ? ymToLabel(competencia) : "—"}
            onChange={onPickMonth}
            modes={["mes"]}
            zIndex={90}
          />
          {loading && (
            <RotateCw size={15} style={{ color: "var(--s-t3)", animation: "bdSpin 1s linear infinite" }} />
          )}
        </div>

        {/* Result card */}
        <div
          style={{
            border: "1px solid var(--s-border)",
            borderRadius: "var(--r-card)",
            background: "var(--s-sunken)",
            padding: "18px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            minHeight: 96,
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".04em", color: "var(--s-t3)" }}>
            {title}
          </span>
          {loading ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--s-t3)" }}>
              <RotateCw size={16} style={{ animation: "bdSpin 1s linear infinite" }} /> Calculando…
            </span>
          ) : error ? (
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--s-bad)" }}>{error}</span>
          ) : (
            <span
              className="font-display"
              style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-.02em", color: "var(--s-t1)" }}
            >
              {formatValor(result?.valor, formato)}
            </span>
          )}
          <span style={{ fontSize: 12, color: "var(--s-t3)" }}>
            {result?.competencia ? `Competência ${result.competencia}` : "—"}
          </span>
        </div>

        <p style={{ margin: 0, fontSize: 11, color: "var(--s-t3)", fontStyle: "italic" }}>
          Prévia sobre os últimos 12 meses da fonte, aplicando o cálculo cadastrado. É uma amostra para
          conferência — não substitui o número oficial do dashboard.
        </p>
      </div>
    </ModalShell>
  );
}
