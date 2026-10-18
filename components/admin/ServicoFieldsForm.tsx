"use client";

import { useState, type CSSProperties } from "react";
import { ChevronDown } from "lucide-react";
import { Field, TextAreaField } from "./primitives";
import { SelectMenu } from "./SelectMenu";
import { SERVICOS_PADRAO, servicoCode, servicoNome } from "@/lib/data/indicators/codes";
import type { ServicoDraft } from "@/lib/data/indicators/types";

const FORMATOS_DADO = [
  { value: "Qtd", label: "Qtd" },
  { value: "%", label: "%" },
];
const POLARIDADES = [
  { value: "Maior melhor", label: "Maior melhor" },
  { value: "Menor melhor", label: "Menor melhor" },
];
const STATUS_OPTS = [
  { value: "Ativo", label: "Ativo" },
  { value: "Inativo", label: "Inativo" },
];

const SERVICO_OPTS = SERVICOS_PADRAO.map((s) => ({ value: s, label: s }));

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: ".06em",
  textTransform: "uppercase",
  color: "var(--s-t3)",
  marginBottom: 6,
};

/**
 * Fields for one serviço row (indicadores_servicos) — shared by the "novo
 * indicador" repeatable list and the standalone add/edit-serviço modal. On a new
 * row code and name come pre-filled and stay editable; once it exists the code never changes.
 */
export function ServicoFieldsForm({
  draft,
  onChange,
  idIndicadorGeral,
  indicadorGeral,
  isNew = true,
}: {
  draft: ServicoDraft;
  onChange: (d: ServicoDraft) => void;
  idIndicadorGeral: string;
  indicadorGeral: string;
  isNew?: boolean;
}) {
  const [docsOpen, setDocsOpen] = useState(false);
  const set = (patch: Partial<ServicoDraft>) => onChange({ ...draft, ...patch });
  const code = isNew ? resolvedServicoCode(draft, idIndicadorGeral) : draft.id;
  const nome = resolvedServicoNome(draft, indicadorGeral);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <SelectMenu
          label="Serviço"
          value={draft.servico}
          options={SERVICO_OPTS}
          onChange={(v) => set({ servico: v })}
          placeholder="Selecionar serviço…"
          searchPlaceholder="Buscar ou digitar serviço…"
          creatable
        />
        {isNew ? (
          <Field
            label="Código"
            value={code}
            onChange={(v) => set({ id: v, autoId: false })}
            placeholder="ex.: BA01FTTH"
            mono
          />
        ) : (
          <ReadOnlyField label="Código" value={code} />
        )}
      </div>

      <Field
        label="Nome do indicador nesse serviço"
        value={nome}
        onChange={(v) => set({ indicadorServico: v, autoNome: false })}
        placeholder="ex.: Base Ativa - FTTH"
        hint={
          isNew && (draft.autoId || draft.autoNome)
            ? "Código e nome são sugeridos automaticamente — edite se quiser."
            : undefined
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <SelectMenu
          label="Formato"
          value={draft.formatoDado}
          options={FORMATOS_DADO}
          onChange={(v) => set({ formatoDado: v })}
        />
        <SelectMenu
          label="Polaridade"
          value={draft.polaridade}
          options={POLARIDADES}
          onChange={(v) => set({ polaridade: v })}
        />
        <SelectMenu
          label="Status"
          value={draft.status}
          options={STATUS_OPTS}
          onChange={(v) => set({ status: v })}
        />
      </div>

      <div>
        <button
          type="button"
          onClick={() => setDocsOpen((v) => !v)}
          className="bd-ghost"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            border: 0,
            background: "transparent",
            color: "var(--s-t3)",
            font: "inherit",
            fontSize: 11.5,
            fontWeight: 700,
            cursor: "pointer",
            padding: 0,
          }}
        >
          <ChevronDown
            size={13}
            style={{ transition: "transform .15s ease", transform: docsOpen ? "none" : "rotate(-90deg)" }}
          />
          Documentação (opcional)
        </button>

        {docsOpen && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
            <TextAreaField
              label="Descrição"
              value={draft.descricao}
              onChange={(v) => set({ descricao: v })}
              rows={2}
            />
            <Field label="Tabela (origem)" value={draft.tabela} onChange={(v) => set({ tabela: v })} mono />
            <TextAreaField
              label="Colunas"
              value={draft.colunas}
              onChange={(v) => set({ colunas: v })}
              rows={2}
            />
            <Field label="Função" value={draft.funcao} onChange={(v) => set({ funcao: v })} />
            <TextAreaField
              label="Métrica (prosa)"
              value={draft.metrica}
              onChange={(v) => set({ metrica: v })}
              rows={3}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function resolvedServicoCode(draft: ServicoDraft, idIndicadorGeral: string): string {
  return draft.autoId ? servicoCode(idIndicadorGeral, draft.servico) : draft.id;
}

export function resolvedServicoNome(draft: ServicoDraft, indicadorGeral: string): string {
  return draft.autoNome ? servicoNome(indicadorGeral, draft.servico) : draft.indicadorServico;
}

export function ReadOnlyField({
  label,
  value,
  placeholder = "",
}: {
  label: string;
  value: string;
  placeholder?: string;
}) {
  return (
    <div>
      <span style={labelStyle}>{label}</span>
      <div
        style={{
          height: 40,
          padding: "0 12px",
          borderRadius: 10,
          border: "1px solid var(--s-border)",
          background: "var(--s-card)",
          color: value ? "var(--s-t2)" : "var(--s-t3)",
          display: "flex",
          alignItems: "center",
          fontSize: 13.5,
          fontWeight: 600,
          fontFamily: "var(--font-mono, ui-monospace, monospace)",
        }}
      >
        {value || placeholder}
      </div>
    </div>
  );
}
