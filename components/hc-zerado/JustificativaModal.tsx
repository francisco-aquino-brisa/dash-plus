"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  ClipboardCheck,
  LoaderCircle,
  PartyPopper,
  Save,
  Trash2,
  UserRound,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Segmented } from "@/components/ui/segmented";
import { DangerButton, PrimaryButton, SecondaryButton } from "@/components/admin/primitives";
import { SERVICO_LABEL, STATUS_TONE, initials, ptBr } from "./ui";
import { CATEGORIAS } from "@/lib/data/hc-zerado/catalog";
import { useCan } from "@/lib/auth/client";
import { CAP } from "@/lib/auth/capabilities";
import type { DiaZerado, JustificativaStatus, PessoaZerada } from "@/lib/data/hc-zerado/types";

const MOTIVO_MIN = 15;
const MOTIVO_MAX = 400;
const OBSERVACAO_MAX = 400;

const STATUS_OPTIONS: Array<{ value: JustificativaStatus; label: string }> = [
  { value: "Em Análise", label: "Em análise" },
  { value: "Aprovado", label: "Aprovado" },
  { value: "Rejeitado", label: "Rejeitado" },
];

export interface JustificativaDraft {
  categoria: string;
  motivo: string;
  status: JustificativaStatus;
  observacaoLider: string;
}

/**
 * One day's justification, plus the leader's verdict on it — the same single
 * modal the origin used. There is no attachment field: the origin's upload
 * stored the file's name and size and threw the file away, which reads to an
 * evaluator as evidence that does not exist.
 */
export function JustificativaModal({
  pessoa,
  dia,
  saving,
  error,
  onClose,
  onSave,
  onDelete,
}: {
  pessoa: PessoaZerada | null;
  dia: DiaZerado | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (draft: JustificativaDraft) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<JustificativaDraft>({
    categoria: "",
    motivo: "",
    status: "Em Análise",
    observacaoLider: "",
  });
  const podeColaborador = useCan(CAP.HC_JUSTIFICATIVA_COLABORADOR);
  const podeGestor = useCan(CAP.HC_DEVOLUTIVA_GESTOR);
  const [touched, setTouched] = useState(false);
  // Deleting is not undoable, so the button asks once before it does anything.
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Re-seeded per day: the modal is a single instance reused for every card.
  useEffect(() => {
    const j = dia?.justificativa;

    setDraft({
      categoria: j?.categoria ?? "",
      motivo: j?.motivo ?? "",
      status: j?.status ?? "Em Análise",
      observacaoLider: j?.observacaoLider ?? "",
    });
    setTouched(false);
    setConfirmingDelete(false);
  }, [dia]);

  if (!pessoa || !dia) return null;

  const motivo = draft.motivo.trim();
  const issue = !podeColaborador
    ? dia.justificativa
      ? null
      : "Não há justificativa registrada neste dia para avaliar."
    : !draft.categoria
      ? "Selecione uma categoria."
      : motivo.length < MOTIVO_MIN
        ? `Descreva o motivo com pelo menos ${MOTIVO_MIN} caracteres.`
        : null;

  const submit = () => {
    setTouched(true);

    if (!issue) onSave(draft);
  };

  const patch = (p: Partial<JustificativaDraft>) => setDraft((d) => ({ ...d, ...p }));
  const message = error ?? (touched ? issue : null);

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent
        className="flex max-h-[92vh] w-[min(560px,calc(100vw-32px))] max-w-none flex-col gap-0 overflow-hidden p-0"
        style={{ borderColor: "var(--s-border)", background: "var(--s-card)", borderRadius: 16 }}
      >
        <DialogHeader
          style={{ padding: "16px 18px 13px", borderBottom: "1px solid var(--s-border)", gap: 3 }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "var(--s-brand)",
            }}
          >
            <ClipboardCheck size={13} />
            Justificativa de ociosidade
          </span>
          <DialogTitle
            className="font-display"
            style={{ fontSize: 16, fontWeight: 800, color: "var(--s-t1)", letterSpacing: "-.01em" }}
          >
            {ptBr(dia.data)} · {pessoa.consultor}
          </DialogTitle>
          {dia.feriado && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                marginTop: 4,
                fontSize: 11.5,
                fontWeight: 700,
                color: "var(--s-warn)",
              }}
            >
              <PartyPopper size={12} />
              Feriado
            </span>
          )}
        </DialogHeader>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            padding: 18,
            // The dialog is a flex column: this row is the one that scrolls, and
            // `minHeight: 0` is what lets it shrink instead of pushing the footer out.
            flex: 1,
            overflowY: "auto",
            minHeight: 0,
          }}
        >
          <Pessoa pessoa={pessoa} dia={dia} />

          <Field label="Categoria" required>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {CATEGORIAS.map((c) => {
                const on = draft.categoria === c;

                return (
                  <button
                    key={c}
                    type="button"
                    disabled={!podeColaborador}
                    onClick={() => patch({ categoria: c })}
                    style={{
                      height: 28,
                      padding: "0 11px",
                      border: `1px solid ${on ? "var(--s-brand-line)" : "var(--s-border)"}`,
                      borderRadius: 999,
                      background: on ? "var(--s-brand-weak)" : "var(--s-card)",
                      color: on ? "var(--s-brand)" : "var(--s-t2)",
                      font: "inherit",
                      fontSize: 11.5,
                      fontWeight: on ? 800 : 600,
                      cursor: podeColaborador ? "pointer" : "default",
                      opacity: !podeColaborador && !on ? 0.45 : 1,
                      transition: ".14s",
                    }}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field
            label="Motivo da ociosidade"
            required
            hint={`${motivo.length} / ${MOTIVO_MAX}`}
            hintTone={motivo.length < MOTIVO_MIN ? "var(--s-bad)" : "var(--s-t3)"}
          >
            <textarea
              value={draft.motivo}
              onChange={(e) => patch({ motivo: e.target.value })}
              readOnly={!podeColaborador}
              maxLength={MOTIVO_MAX}
              rows={4}
              placeholder={
                podeColaborador
                  ? "Descreva por que a pessoa não registrou venda neste dia."
                  : "Sem justificativa registrada."
              }
              style={podeColaborador ? textarea : readOnlyTextarea}
            />
          </Field>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 2 }}>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: "var(--s-t3)",
              }}
            >
              <UserRound size={12} />
              Avaliação do gestor
            </span>

            <Field label="Status da ocorrência">
              {podeGestor ? (
                <Segmented
                  options={STATUS_OPTIONS}
                  value={draft.status}
                  onChange={(status) => patch({ status })}
                  ariaLabel="Status da ocorrência"
                />
              ) : (
                <span style={readOnlyValue}>{draft.status}</span>
              )}
            </Field>

            <Field
              label="Tratativa / observação"
              hint={`${draft.observacaoLider.length} / ${OBSERVACAO_MAX}`}
            >
              <textarea
                value={draft.observacaoLider}
                onChange={(e) => patch({ observacaoLider: e.target.value })}
                readOnly={!podeGestor}
                maxLength={OBSERVACAO_MAX}
                rows={3}
                placeholder={
                  podeGestor ? "Opcional — o parecer que a pessoa vai ler." : "Sem parecer do gestor."
                }
                style={podeGestor ? textarea : readOnlyTextarea}
              />
            </Field>
          </div>

          {dia.justificativa && podeColaborador && (
            <p
              style={{
                margin: 0,
                padding: "8px 11px",
                borderRadius: 10,
                background: "var(--s-warn-bg)",
                color: "var(--s-t2)",
                fontSize: 11.5,
                lineHeight: 1.45,
              }}
            >
              Esta justificativa já foi registrada
              {dia.justificativa.autor ? ` por ${dia.justificativa.autor}` : ""}. Alterar o texto devolve a
              ocorrência para <strong>Em análise</strong> e descarta o parecer anterior.
            </p>
          )}
        </div>

        {message && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              margin: "0 18px",
              padding: "9px 11px",
              borderRadius: 10,
              background: "var(--s-bad-bg)",
              color: "var(--s-bad)",
              fontSize: 11.5,
              fontWeight: 700,
            }}
          >
            <AlertCircle size={14} style={{ flex: "none" }} />
            {message}
          </div>
        )}

        <footer
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 8,
            padding: 18,
            borderTop: "1px solid var(--s-border)",
          }}
        >
          {dia.justificativa &&
            podeColaborador &&
            (confirmingDelete ? (
              <span
                style={{
                  marginRight: "auto",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  color: "var(--s-t2)",
                }}
              >
                Excluir sem volta?
                <DangerButton onClick={onDelete} disabled={saving} style={{ height: 32, fontSize: 12 }}>
                  Sim, excluir
                </DangerButton>
                <SecondaryButton
                  onClick={() => setConfirmingDelete(false)}
                  disabled={saving}
                  style={{ height: 32, fontSize: 12 }}
                >
                  Não
                </SecondaryButton>
              </span>
            ) : (
              <SecondaryButton
                onClick={() => setConfirmingDelete(true)}
                disabled={saving}
                style={{ marginRight: "auto", color: "var(--s-bad)" }}
              >
                <Trash2 size={14} />
                Excluir
              </SecondaryButton>
            ))}
          <SecondaryButton onClick={onClose} disabled={saving}>
            Cancelar
          </SecondaryButton>
          <PrimaryButton onClick={submit} disabled={saving}>
            {saving ? (
              <LoaderCircle size={14} style={{ animation: "bdSpin .7s linear infinite" }} />
            ) : (
              <Save size={14} />
            )}
            {saving ? "Salvando…" : "Salvar"}
          </PrimaryButton>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function Pessoa({ pessoa, dia }: { pessoa: PessoaZerada; dia: DiaZerado }) {
  const tone = dia.justificativa ? STATUS_TONE[dia.justificativa.status] : null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 11,
        padding: 12,
        border: "1px solid var(--s-border)",
        borderRadius: 12,
        background: "var(--s-sunken)",
      }}
    >
      <span
        style={{
          flex: "none",
          display: "grid",
          placeItems: "center",
          width: 38,
          height: 38,
          borderRadius: 999,
          background: "var(--s-card)",
          border: "1px solid var(--s-border)",
          fontSize: 12,
          fontWeight: 800,
          color: "var(--s-t2)",
        }}
      >
        {initials(pessoa.consultor)}
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--s-t1)" }}>{pessoa.consultor}</div>
        <div style={{ fontSize: 10.5, color: "var(--s-t3)", marginTop: 2 }}>
          <span className="font-mono">{pessoa.matricula}</span> · {pessoa.cargo} · {pessoa.cidade}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
          {dia.servicos.map((s) => (
            <span
              key={s}
              style={{
                padding: "1px 7px",
                borderRadius: 6,
                border: "1px solid var(--s-border)",
                background: "var(--s-card)",
                color: "var(--s-t3)",
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: ".05em",
              }}
            >
              {SERVICO_LABEL[s] ?? s}
            </span>
          ))}
        </div>
      </div>
      {tone && (
        <span
          style={{
            flex: "none",
            padding: "2px 8px",
            borderRadius: 999,
            background: tone.bg,
            color: tone.fg,
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: ".06em",
            textTransform: "uppercase",
          }}
        >
          {tone.label}
        </span>
      )}
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  hintTone,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  hintTone?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: ".09em",
            textTransform: "uppercase",
            color: "var(--s-t3)",
          }}
        >
          {label}
          {required && <span style={{ color: "var(--s-bad)" }}> *</span>}
        </span>
        {hint && (
          <span className="font-mono" style={{ fontSize: 10, color: hintTone ?? "var(--s-t3)" }}>
            {hint}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}

const textarea: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  border: "1px solid var(--s-border)",
  borderRadius: 10,
  background: "var(--s-card)",
  color: "var(--s-t1)",
  font: "inherit",
  fontSize: 12.5,
  lineHeight: 1.5,
  resize: "vertical",
};

const readOnlyTextarea: React.CSSProperties = {
  ...textarea,
  background: "var(--s-sunken)",
  color: "var(--s-t2)",
  cursor: "default",
  resize: "none",
};

const readOnlyValue: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  height: 32,
  padding: "0 12px",
  borderRadius: 999,
  border: "1px solid var(--s-border)",
  background: "var(--s-sunken)",
  color: "var(--s-t2)",
  fontSize: 12,
  fontWeight: 800,
};
