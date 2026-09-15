"use client";

import { useState } from "react";
import { AlertCircle, Check, LoaderCircle, Save, Settings2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Segmented } from "@/components/ui/segmented";
import { PrimaryButton, SecondaryButton } from "@/components/admin/primitives";
import { SERVICO_LABEL } from "./ui";
import type { HcRegras } from "@/lib/data/hc-zerado/types";

/** The services the source carries — verified against it, not the rules string. */
const SERVICOS = ["INTERNET", "FWA", "5G", "RENOVACAO"];

const STATUS = [
  { value: "CRIADO", label: "Criado" },
  { value: "EFETIVADO", label: "Efetivado" },
  { value: "INSTALADO", label: "Instalado" },
];

const AGILIDADE = [
  { value: "Todos", label: "Sem filtro" },
  { value: "Efetivado", label: "Efetivado m. dia" },
  { value: "Instalado", label: "Instalado m. dia" },
];

export interface RegrasDraft {
  servicos: string[];
  statusVenda: string;
  agilidade: string;
}

/**
 * Edits `regras_justificativa_hc` — one row, and it defines what counts as a
 * sale for everybody on this screen. Open to any signed-in user, as in the
 * origin. The copy says so plainly, because the blast radius is the company and
 * the control is a button on a screen.
 */
export function RegrasModal({
  regras,
  saving,
  error,
  onClose,
  onSave,
}: {
  regras: HcRegras;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (draft: RegrasDraft) => void;
}) {
  const [draft, setDraft] = useState<RegrasDraft>({
    servicos: regras.servicos,
    statusVenda: regras.statusVenda,
    agilidade: regras.agilidade,
  });

  const toggle = (servico: string) =>
    setDraft((d) => ({
      ...d,
      servicos: d.servicos.includes(servico)
        ? d.servicos.filter((s) => s !== servico)
        : [...d.servicos, servico],
    }));

  const issue = draft.servicos.length === 0 ? "Selecione ao menos um serviço." : null;
  const message = error ?? issue;

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent
        className="flex w-[min(460px,calc(100vw-32px))] max-w-none flex-col gap-0 overflow-hidden p-0"
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
            <Settings2 size={13} />
            Regra global
          </span>
          <DialogTitle
            className="font-display"
            style={{ fontSize: 16, fontWeight: 800, color: "var(--s-t1)", letterSpacing: "-.01em" }}
          >
            O que conta como venda
          </DialogTitle>
        </DialogHeader>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 18 }}>
          <p
            style={{
              margin: 0,
              padding: "9px 11px",
              borderRadius: 10,
              background: "var(--s-warn-bg)",
              color: "var(--s-t2)",
              fontSize: 11.5,
              lineHeight: 1.45,
            }}
          >
            Vale para todo mundo, não só para você: muda quem aparece como zerado nesta tela para a empresa
            inteira.
          </p>

          <Group label="Serviços cobrados">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {SERVICOS.map((s) => {
                const on = draft.servicos.includes(s);

                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggle(s)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      height: 30,
                      padding: "0 12px",
                      border: `1px solid ${on ? "var(--s-brand-line)" : "var(--s-border)"}`,
                      borderRadius: 999,
                      background: on ? "var(--s-brand-weak)" : "var(--s-card)",
                      color: on ? "var(--s-brand)" : "var(--s-t2)",
                      font: "inherit",
                      fontSize: 12,
                      fontWeight: on ? 800 : 600,
                      cursor: "pointer",
                      transition: ".14s",
                    }}
                  >
                    {on && <Check size={12} strokeWidth={3} />}
                    {SERVICO_LABEL[s] ?? s}
                  </button>
                );
              })}
            </div>
          </Group>

          <Group
            label="Status da venda"
            hint="Cobrado só de FTTH e FWA. 5G e Renovação têm status próprio e não respondem a este campo."
          >
            <Segmented
              options={STATUS}
              value={draft.statusVenda}
              onChange={(statusVenda) => setDraft((d) => ({ ...d, statusVenda }))}
              ariaLabel="Status da venda cobrado"
            />
          </Group>

          <Group label="Agilidade do processo">
            <Segmented
              options={AGILIDADE}
              value={draft.agilidade}
              onChange={(agilidade) => setDraft((d) => ({ ...d, agilidade }))}
              ariaLabel="Agilidade obrigatória"
            />
          </Group>
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
            justifyContent: "flex-end",
            gap: 8,
            padding: 18,
            borderTop: "1px solid var(--s-border)",
          }}
        >
          <SecondaryButton onClick={onClose} disabled={saving}>
            Cancelar
          </SecondaryButton>
          <PrimaryButton onClick={() => !issue && onSave(draft)} disabled={saving || Boolean(issue)}>
            {saving ? (
              <LoaderCircle size={14} style={{ animation: "bdSpin .7s linear infinite" }} />
            ) : (
              <Save size={14} />
            )}
            {saving ? "Salvando…" : "Salvar regra"}
          </PrimaryButton>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function Group({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
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
      </span>
      {children}
      {hint && <span style={{ fontSize: 11, color: "var(--s-t3)", lineHeight: 1.45 }}>{hint}</span>}
    </div>
  );
}
