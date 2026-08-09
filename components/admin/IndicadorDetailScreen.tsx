"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Copy, Eye, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { ModalHeader, ModalShell } from "./AdminModal";
import { CalcBuilderForm } from "./IndicadorCalcBuilder";
import { IndicadorPreview } from "./IndicadorPreview";
import { Chip, Panel } from "./primitives";
import { statusChipTone } from "@/lib/data/admin/derive";
import { parseSpec } from "@/lib/data/indicators/spec";
import { categoryTone, servicoTone } from "@/lib/data/indicators/ui";
import type { IndicadorGeral, IndicadorServico } from "@/lib/data/indicators/types";

function isAtivo(status: string | null): boolean {
  return (status ?? "").trim().toLowerCase() === "ativo";
}

export function IndicadorDetailScreen({
  indicador,
  sourceColumns,
}: {
  indicador: IndicadorGeral;
  sourceColumns: Record<string, string[]>;
}) {
  return (
    <div style={{ padding: "clamp(18px, 4vw, 34px)", animation: "bdIn .3s ease both" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Header with back link */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Link
            href="/admin/indicadores"
            className="bd-ghost"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              alignSelf: "flex-start",
              fontSize: 12,
              fontWeight: 700,
              color: "var(--s-t3)",
              textDecoration: "none",
            }}
          >
            <ArrowLeft size={14} />
            Indicadores
          </Link>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: categoryTone(indicador.categoria).fg,
            }}
          >
            {indicador.id} · {indicador.categoria}
          </div>
          <h1
            className="font-display"
            style={{
              margin: 0,
              fontSize: "clamp(24px, 4vw, 30px)",
              fontWeight: 800,
              letterSpacing: "-.02em",
              color: "var(--s-t1)",
            }}
          >
            {indicador.nome}
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Chip tone={statusChipTone(isAtivo(indicador.status))}>{indicador.status || "—"}</Chip>
            <span style={{ fontSize: 12.5, color: "var(--s-t3)" }}>
              {indicador.servicos.length} {indicador.servicos.length === 1 ? "serviço" : "serviços"}
            </span>
          </div>
        </div>

        {indicador.servicos.length === 0 && (
          <Panel style={{ padding: 24 }}>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--s-t3)" }}>
              Este indicador não tem serviços cadastrados.
            </p>
          </Panel>
        )}

        {indicador.servicos.map((s) => (
          <ServicoDetail key={s.id} servico={s} sourceColumns={sourceColumns} />
        ))}
      </div>
    </div>
  );
}

function ServicoDetail({
  servico: s,
  sourceColumns,
}: {
  servico: IndicadorServico;
  sourceColumns: Record<string, string[]>;
}) {
  const [editing, setEditing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  const tone = servicoTone(s.servico);
  const savedSpec = parseSpec(s.especificacaoCalculo);
  const label = s.indicadorServico || s.servico;

  async function copy() {
    if (!s.especificacaoCalculo) return;

    try {
      await navigator.clipboard.writeText(s.especificacaoCalculo);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard may be blocked; ignore */
    }
  }

  return (
    <Panel style={{ padding: 16, borderLeft: `3px solid ${tone.fg}` }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Chip tone={tone}>{s.servico}</Chip>
          <span style={{ fontWeight: 700, color: "var(--s-t1)", fontSize: 14 }}>{s.indicadorServico}</span>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 20px" }}>
          <Meta label="Formato" value={s.formatoDado} />
          <Meta label="Polaridade" value={s.polaridade} />
          <Meta label="Função" value={s.funcao} />
          <Meta label="Status" value={s.status} />
        </div>

        {s.tabela && <Meta label="Fonte" value={s.tabela} mono />}

        {s.metrica && (
          <div>
            <FieldLabel>Métrica (documentação)</FieldLabel>
            <pre
              style={{
                margin: "4px 0 0",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--s-border)",
                background: "var(--s-sunken)",
                color: "var(--s-t2)",
                fontSize: 11.5,
                lineHeight: 1.45,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {s.metrica}
            </pre>
          </div>
        )}

        {/* Calc section */}
        <div
          style={{
            borderTop: "1px solid var(--s-border)",
            paddingTop: 12,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <FieldLabel>Especificação de cálculo (JSON)</FieldLabel>
            <span style={{ flex: 1 }} />
            <RowBtn icon={Eye} onClick={() => setPreviewing(true)} disabled={!savedSpec}>
              Visualizar
            </RowBtn>
            <RowBtn icon={copied ? Check : Copy} onClick={copy} disabled={!s.especificacaoCalculo}>
              {copied ? "Copiado" : "Copiar JSON"}
            </RowBtn>
            <RowBtn icon={SlidersHorizontal} onClick={() => setEditing(true)} accent>
              {s.especificacaoCalculo ? "Editar cálculo" : "Configurar cálculo"}
            </RowBtn>
          </div>

          {s.especificacaoCalculo ? (
            <pre
              style={{
                margin: 0,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--s-border)",
                background: "var(--s-sunken)",
                color: "var(--s-t2)",
                fontSize: 11,
                lineHeight: 1.45,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                maxHeight: 200,
                overflow: "auto",
              }}
            >
              {s.especificacaoCalculo}
            </pre>
          ) : (
            <p style={{ margin: 0, fontSize: 12, color: "var(--s-t3)", fontStyle: "italic" }}>
              Ainda não configurada.
            </p>
          )}
        </div>
      </div>

      {editing && (
        <ModalShell open onClose={() => setEditing(false)} maxWidth={760}>
          <ModalHeader
            eyebrow={`${s.idIndicadorGeral} · ${s.servico} · especificação de cálculo`}
            title={label}
            onClose={() => setEditing(false)}
          />
          <CalcBuilderForm
            initialJson={s.especificacaoCalculo}
            sourceColumns={sourceColumns}
            servicoId={s.id}
            onSaved={() => {
              setEditing(false);
              router.refresh();
            }}
          />
        </ModalShell>
      )}

      {previewing && savedSpec && (
        <IndicadorPreview
          specJson={s.especificacaoCalculo ?? ""}
          formato={savedSpec.formato}
          title={label}
          onClose={() => setPreviewing(false)}
        />
      )}
    </Panel>
  );
}

function RowBtn({
  icon: Icon,
  onClick,
  disabled,
  accent,
  children,
}: {
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="bd-ghost"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 30,
        padding: "0 12px",
        borderRadius: 9,
        border: "1px solid var(--s-border)",
        background: "var(--s-card)",
        color: accent ? "var(--s-brand)" : "var(--s-t2)",
        font: "inherit",
        fontSize: 12,
        fontWeight: 800,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Icon size={14} />
      {children}
    </button>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        display: "block",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: ".06em",
        textTransform: "uppercase",
        color: "var(--s-t3)",
      }}
    >
      {children}
    </span>
  );
}

function Meta({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <FieldLabel>{label}</FieldLabel>
      <span
        style={{
          fontSize: 12.5,
          fontWeight: 600,
          color: value ? "var(--s-t1)" : "var(--s-t3)",
          fontFamily: mono ? "var(--font-mono, ui-monospace, monospace)" : undefined,
          wordBreak: mono ? "break-all" : undefined,
        }}
      >
        {value || "—"}
      </span>
    </span>
  );
}
