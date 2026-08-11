"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Copy,
  Eye,
  Pencil,
  SlidersHorizontal,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { AdminModal, ModalHeader, ModalShell } from "./AdminModal";
import { AddBtn, CalcBuilderForm, ModeTab } from "./IndicadorCalcBuilder";
import { ConfirmDelete } from "./ConfirmDelete";
import { IndicadorPreview } from "./IndicadorPreview";
import { Chip, Field, Panel } from "./primitives";
import { SelectMenu } from "./SelectMenu";
import { ServicoFormModal } from "./ServicoFormModal";
import { useAdminAction } from "./useAdminAction";
import {
  removerIndicador,
  removerServico,
  salvarIndicadorGeral,
} from "@/app/(app)/admin/indicadores/actions";
import { statusChipTone } from "@/lib/data/admin/derive";
import { parseSpec } from "@/lib/data/indicators/spec";
import { specToSql } from "@/lib/data/indicators/to-sql";
import { CATEGORY_META, categoryTone, servicoTone } from "@/lib/data/indicators/ui";
import type { IndicadorGeral, IndicadorServico } from "@/lib/data/indicators/types";

const CATEGORIA_OPTS = CATEGORY_META.map((c) => ({ value: c.key, label: c.label }));
const STATUS_OPTS = [
  { value: "Ativo", label: "Ativo" },
  { value: "Inativo", label: "Inativo" },
];

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
  const [editingGeral, setEditingGeral] = useState(false);
  const [deletingGeral, setDeletingGeral] = useState(false);
  const [addingServico, setAddingServico] = useState(false);
  const { busy, error, run } = useAdminAction();
  const router = useRouter();

  function confirmDeleteGeral() {
    run(
      () => removerIndicador(indicador.id),
      () => router.push("/admin/indicadores"),
    );
  }

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
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Chip tone={statusChipTone(isAtivo(indicador.status))}>{indicador.status || "—"}</Chip>
            <span style={{ fontSize: 12.5, color: "var(--s-t3)" }}>
              {indicador.servicos.length} {indicador.servicos.length === 1 ? "serviço" : "serviços"}
            </span>
            <span style={{ flex: 1 }} />
            <RowBtn icon={Pencil} onClick={() => setEditingGeral(true)}>
              Editar indicador
            </RowBtn>
            <RowBtn icon={Trash2} onClick={() => setDeletingGeral(true)} danger>
              Excluir indicador
            </RowBtn>
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
          <ServicoDetail
            key={s.id}
            servico={s}
            idIndicadorGeral={indicador.id}
            categoria={indicador.categoria}
            indicadorNome={indicador.nome}
            sourceColumns={sourceColumns}
          />
        ))}

        <div>
          <AddBtn onClick={() => setAddingServico(true)}>Adicionar serviço</AddBtn>
        </div>
      </div>

      {editingGeral && (
        <IndicadorEditModal
          indicador={indicador}
          onClose={() => setEditingGeral(false)}
          onSaved={() => {
            setEditingGeral(false);
            router.refresh();
          }}
        />
      )}

      {deletingGeral && (
        <ConfirmDelete
          open
          onClose={() => setDeletingGeral(false)}
          onConfirm={confirmDeleteGeral}
          question="Excluir este indicador?"
          recordName={`${indicador.id} · ${indicador.nome} (${indicador.servicos.length} serviço(s))`}
          busy={busy}
          error={error}
        />
      )}

      {addingServico && (
        <ServicoFormModal
          idIndicadorGeral={indicador.id}
          categoria={indicador.categoria}
          indicadorGeral={indicador.nome}
          onClose={() => setAddingServico(false)}
          onSaved={() => {
            setAddingServico(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// ── Editar indicador (metadata) ─────────────────────────────────────────────────

function IndicadorEditModal({
  indicador,
  onClose,
  onSaved,
}: {
  indicador: IndicadorGeral;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [categoria, setCategoria] = useState(indicador.categoria);
  const [nome, setNome] = useState(indicador.nome);
  const [status, setStatus] = useState(indicador.status ?? "Ativo");
  const { busy, error, run } = useAdminAction();

  function submit() {
    run(() => salvarIndicadorGeral({ id: indicador.id, categoria, nome: nome.trim(), status }), onSaved);
  }

  return (
    <AdminModal
      open
      onClose={onClose}
      eyebrow={`${indicador.id} · editar indicador`}
      title="Editar indicador"
      onSubmit={submit}
      submitLabel="Salvar"
      submitDisabled={!nome.trim()}
      busy={busy}
      error={error}
    >
      <SelectMenu label="Categoria" value={categoria} options={CATEGORIA_OPTS} onChange={setCategoria} />
      <Field label="Nome" value={nome} onChange={setNome} placeholder="ex.: Crescimento Base" autoFocus />
      <SelectMenu label="Status" value={status} options={STATUS_OPTS} onChange={setStatus} />
    </AdminModal>
  );
}

// ── Serviço card ────────────────────────────────────────────────────────────────

function ServicoDetail({
  servico: s,
  idIndicadorGeral,
  categoria,
  indicadorNome,
  sourceColumns,
}: {
  servico: IndicadorServico;
  idIndicadorGeral: string;
  categoria: string;
  indicadorNome: string;
  sourceColumns: Record<string, string[]>;
}) {
  const [editing, setEditing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<"json" | "sql">("json");
  const [editingMeta, setEditingMeta] = useState(false);
  const [removing, setRemoving] = useState(false);
  const { busy: removeBusy, error: removeError, run: runRemove } = useAdminAction();
  const router = useRouter();

  const tone = servicoTone(s.servico);
  const savedSpec = parseSpec(s.especificacaoCalculo);
  const sql = useMemo(() => (savedSpec ? specToSql(savedSpec) : null), [savedSpec]);
  const displayed = view === "sql" && sql ? sql : s.especificacaoCalculo;
  const label = s.indicadorServico || s.servico;

  async function copy() {
    if (!displayed) return;

    try {
      await navigator.clipboard.writeText(displayed);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard may be blocked; ignore */
    }
  }

  function confirmRemove() {
    runRemove(
      () => removerServico(s.id, idIndicadorGeral),
      () => {
        setRemoving(false);
        router.refresh();
      },
    );
  }

  return (
    <Panel style={{ padding: 16, borderLeft: `3px solid ${tone.fg}` }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Chip tone={tone}>{s.servico}</Chip>
          <span style={{ fontWeight: 700, color: "var(--s-t1)", fontSize: 14 }}>{s.indicadorServico}</span>
          <span style={{ flex: 1 }} />
          <RowBtn icon={Pencil} onClick={() => setEditingMeta(true)}>
            Editar serviço
          </RowBtn>
          <RowBtn icon={Trash2} onClick={() => setRemoving(true)} danger>
            Remover serviço
          </RowBtn>
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
            <FieldLabel>Especificação de cálculo</FieldLabel>
            {savedSpec && (
              <div style={{ display: "flex", gap: 6 }}>
                <ModeTab active={view === "json"} onClick={() => setView("json")}>
                  JSON
                </ModeTab>
                <ModeTab active={view === "sql"} onClick={() => setView("sql")}>
                  SQL
                </ModeTab>
              </div>
            )}
            <span style={{ flex: 1 }} />
            <RowBtn icon={Eye} onClick={() => setPreviewing(true)} disabled={!savedSpec}>
              Visualizar
            </RowBtn>
            <RowBtn icon={copied ? Check : Copy} onClick={copy} disabled={!displayed}>
              {copied ? "Copiado" : view === "sql" ? "Copiar SQL" : "Copiar JSON"}
            </RowBtn>
            <RowBtn icon={SlidersHorizontal} onClick={() => setEditing(true)} accent>
              {s.especificacaoCalculo ? "Editar cálculo" : "Configurar cálculo"}
            </RowBtn>
          </div>

          {displayed ? (
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
              {displayed}
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

      {editingMeta && (
        <ServicoFormModal
          idIndicadorGeral={idIndicadorGeral}
          categoria={categoria}
          indicadorGeral={indicadorNome}
          existing={s}
          onClose={() => setEditingMeta(false)}
          onSaved={() => {
            setEditingMeta(false);
            router.refresh();
          }}
        />
      )}

      {removing && (
        <ConfirmDelete
          open
          onClose={() => setRemoving(false)}
          onConfirm={confirmRemove}
          question="Remover este serviço?"
          recordName={label}
          busy={removeBusy}
          error={removeError}
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
  danger,
  children,
}: {
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
  danger?: boolean;
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
        color: danger ? "var(--s-bad)" : accent ? "var(--s-brand)" : "var(--s-t2)",
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
