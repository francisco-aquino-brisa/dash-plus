"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { PrimaryButton } from "./primitives";
import { SelectMenu } from "./SelectMenu";
import { salvarCalculo } from "@/app/(app)/admin/indicadores/actions";
import { sourceOptions } from "@/lib/data/indicators/sources";
import {
  AGREGACOES,
  emptyMedida,
  emptySpec,
  FORMAS,
  FORMATOS,
  OPERADORES,
  parseSpec,
  PERIODOS,
  POLARIDADES,
  serializeSpec,
  validateSpec,
  type CalcSpec,
  type Filtro,
  type Medida,
} from "@/lib/data/indicators/spec";

// small shared styles (mirror primitives' Field controls)
const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: ".06em",
  textTransform: "uppercase",
  color: "var(--s-t3)",
  marginBottom: 6,
};
const controlStyle: CSSProperties = {
  width: "100%",
  height: 40,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid var(--s-border)",
  background: "var(--s-sunken)",
  color: "var(--s-t1)",
  font: "inherit",
  fontSize: 13.5,
  fontWeight: 600,
  outline: "none",
};

/**
 * Inline visual builder for `especificacao_calculo` — renders directly on the
 * indicator detail page (no modal). Manages its own spec state, shows a live JSON
 * preview and validation, and offers "Copiar JSON". Persisting to the catalog is
 * wired in a later slice (Fatia 3).
 */
export function CalcBuilderForm({
  initialJson,
  sourceColumns,
  servicoId,
  onSaved,
}: {
  initialJson: string | null;
  sourceColumns: Record<string, string[]>;
  servicoId: string;
  onSaved?: () => void;
}) {
  const [spec, setSpec] = useState<CalcSpec>(() => parseSpec(initialJson) ?? emptySpec());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const columns = sourceColumns[spec.fonte] ?? [];
  const json = useMemo(() => serializeSpec(spec), [spec]);
  const issues = useMemo(() => validateSpec(spec, sourceColumns), [spec, sourceColumns]);
  const valid = issues.length === 0;

  const set = (patch: Partial<CalcSpec>) => setSpec((s) => ({ ...s, ...patch }));

  async function save() {
    setSaving(true);
    setSaveError(null);

    const resp = await salvarCalculo(servicoId, json);

    setSaving(false);

    if (!resp.ok) {
      setSaveError(resp.error);

      return;
    }

    onSaved?.();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Top row: forma / fonte */}
      <Grid2>
        <SelectField
          label="Forma"
          value={spec.forma}
          options={FORMAS}
          onChange={(v) => set({ forma: v as CalcSpec["forma"] })}
        />
        <SelectField
          label="Fonte"
          value={spec.fonte}
          options={sourceOptions()}
          placeholder="Selecionar fonte…"
          onChange={(v) => set({ fonte: v })}
        />
      </Grid2>

      {/* Measures */}
      {spec.forma === "razao" ? (
        <>
          <MeasureEditor
            title="Numerador"
            value={spec.numerador ?? emptyMedida()}
            columns={columns}
            onChange={(m) => set({ numerador: m })}
            showPeriodo
          />
          <MeasureEditor
            title="Denominador"
            value={spec.denominador ?? emptyMedida()}
            columns={columns}
            onChange={(m) => set({ denominador: m })}
            showPeriodo
          />
        </>
      ) : (
        <MeasureEditor
          title="Medida"
          value={spec.medida ?? emptyMedida()}
          columns={columns}
          onChange={(m) => set({ medida: m })}
        />
      )}

      {/* Indicator-level filters */}
      <FiltroList
        title="Filtros (aplicados a todas as medidas)"
        columns={columns}
        filtros={spec.filtros ?? []}
        onChange={(filtros) => set({ filtros })}
      />

      {/* Format / polarity */}
      <Grid2>
        <SelectField
          label="Formato"
          value={spec.formato}
          options={FORMATOS}
          onChange={(v) => set({ formato: v as CalcSpec["formato"] })}
        />
        <SelectField
          label="Polaridade"
          value={spec.polaridade}
          options={POLARIDADES}
          onChange={(v) => set({ polaridade: v as CalcSpec["polaridade"] })}
        />
      </Grid2>

      {/* Validation */}
      {valid ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "9px 12px",
            borderRadius: 10,
            background: "var(--s-ok-bg)",
            color: "var(--s-ok)",
            fontSize: 12.5,
            fontWeight: 700,
          }}
        >
          <Check size={15} /> Definição válida.
        </div>
      ) : (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            background: "var(--s-bad-bg)",
            color: "var(--s-bad)",
            fontSize: 12,
            fontWeight: 600,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {issues.map((i, idx) => (
            <span key={idx}>• {i.message}</span>
          ))}
        </div>
      )}

      {/* JSON preview */}
      <div>
        <span style={labelStyle}>especificacao_calculo (JSON)</span>
        <pre
          style={{
            margin: 0,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid var(--s-border)",
            background: "var(--s-sunken)",
            color: "var(--s-t2)",
            fontSize: 11.5,
            lineHeight: 1.45,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            maxHeight: 220,
            overflow: "auto",
          }}
        >
          {json}
        </pre>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <PrimaryButton onClick={save} disabled={!valid || saving}>
          <Check size={16} />
          {saving ? "Salvando…" : "Salvar"}
        </PrimaryButton>
      </div>

      {saveError && (
        <div
          style={{
            padding: "9px 12px",
            borderRadius: 10,
            background: "var(--s-bad-bg)",
            color: "var(--s-bad)",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {saveError}
        </div>
      )}
    </div>
  );
}

// ── Measure editor ────────────────────────────────────────────────────────────

function MeasureEditor({
  title,
  value,
  columns,
  onChange,
  showPeriodo = false,
}: {
  title: string;
  value: Medida;
  columns: string[];
  onChange: (m: Medida) => void;
  /** Período (atual/mês anterior) só faz sentido nas medidas de uma razão. */
  showPeriodo?: boolean;
}) {
  // Expression mode is available ONLY for Soma. `expressao` present (even "") means
  // expression mode — truthiness would bounce back to "coluna" on the first click.
  const isSoma = value.agregacao === "soma";
  const mode: "coluna" | "expressao" = isSoma && value.expressao !== undefined ? "expressao" : "coluna";
  const set = (patch: Partial<Medida>) => onChange({ ...value, ...patch });

  // Leaving Soma drops any pending expression and returns to Coluna.
  const onAgg = (v: Medida["agregacao"]) =>
    v === "soma"
      ? set({ agregacao: v })
      : set({ agregacao: v, expressao: undefined, coluna: value.coluna ?? "" });

  return (
    <Section title={title}>
      {showPeriodo ? (
        <Grid2>
          <SelectField
            label="Agregação"
            value={value.agregacao}
            options={AGREGACOES}
            onChange={(v) => onAgg(v as Medida["agregacao"])}
          />
          <SelectField
            label="Período"
            value={value.periodo ?? "atual"}
            options={PERIODOS}
            onChange={(v) => set({ periodo: v as Medida["periodo"] })}
          />
        </Grid2>
      ) : (
        <SelectField
          label="Agregação"
          value={value.agregacao}
          options={AGREGACOES}
          onChange={(v) => onAgg(v as Medida["agregacao"])}
        />
      )}

      {isSoma && (
        <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
          <ModeTab
            active={mode === "coluna"}
            onClick={() => set({ expressao: undefined, coluna: value.coluna ?? "" })}
          >
            Coluna
          </ModeTab>
          <ModeTab
            active={mode === "expressao"}
            onClick={() => set({ coluna: undefined, expressao: value.expressao ?? "" })}
          >
            Expressão
          </ModeTab>
        </div>
      )}

      {value.agregacao === "contagem" ? (
        <p style={{ margin: 0, fontSize: 12, color: "var(--s-t3)", fontStyle: "italic" }}>
          Conta todas as linhas que passam pelos filtros (COUNT).
        </p>
      ) : mode === "expressao" ? (
        <label style={{ display: "block" }}>
          <span style={labelStyle}>Expressão (soma de colunas)</span>
          <input
            value={value.expressao ?? ""}
            onChange={(e) => set({ expressao: e.target.value })}
            placeholder="ex.: base_ativa + fechados"
            style={{ ...controlStyle, fontFamily: "var(--font-mono, ui-monospace, monospace)" }}
          />
        </label>
      ) : (
        <SelectField
          label={value.agregacao === "contagem_distinta" ? "Coluna (chave distinta)" : "Coluna"}
          value={value.coluna ?? ""}
          options={columns.map((c) => ({ value: c, label: c }))}
          placeholder={columns.length ? "Selecionar coluna…" : "Selecione a fonte primeiro"}
          onChange={(v) => set({ coluna: v })}
        />
      )}

      <FiltroList
        title="Filtros da medida"
        columns={columns}
        filtros={value.filtros ?? []}
        onChange={(filtros) => set({ filtros })}
      />
    </Section>
  );
}

// ── Filter list ───────────────────────────────────────────────────────────────

function FiltroList({
  title,
  columns,
  filtros,
  onChange,
}: {
  title: string;
  columns: string[];
  filtros: Filtro[];
  onChange: (f: Filtro[]) => void;
}) {
  const add = () => onChange([...filtros, { coluna: "", operador: "igual", valor: "" }]);
  const update = (i: number, patch: Partial<Filtro>) =>
    onChange(filtros.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  const remove = (i: number) => onChange(filtros.filter((_, idx) => idx !== i));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ ...labelStyle, marginBottom: 0 }}>{title}</span>
        <button
          type="button"
          onClick={add}
          className="bd-ghost"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            height: 26,
            padding: "0 8px",
            borderRadius: 8,
            border: "1px solid var(--s-border)",
            background: "var(--s-card)",
            color: "var(--s-t2)",
            font: "inherit",
            fontSize: 11.5,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <Plus size={13} /> Filtro
        </button>
      </div>

      {filtros.map((f, i) => {
        const isList = f.operador === "em" || f.operador === "nao_em";

        return (
          <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
            <div style={{ flex: 1.2, minWidth: 0 }}>
              <SelectField
                label={i === 0 ? "Coluna" : ""}
                value={f.coluna}
                options={columns.map((c) => ({ value: c, label: c }))}
                placeholder="coluna…"
                onChange={(v) => update(i, { coluna: v })}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <SelectField
                label={i === 0 ? "Operador" : ""}
                value={f.operador ?? "igual"}
                options={OPERADORES}
                onChange={(v) => update(i, { operador: v as Filtro["operador"] })}
              />
            </div>
            <div style={{ flex: 1.2, minWidth: 0 }}>
              <label style={{ display: "block" }}>
                {i === 0 && <span style={labelStyle}>Valor</span>}
                <input
                  value={Array.isArray(f.valor) ? f.valor.join(", ") : f.valor}
                  onChange={(e) => update(i, { valor: e.target.value })}
                  placeholder={isList ? "A, B, C" : "valor"}
                  style={controlStyle}
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="Remover filtro"
              className="bd-ghost"
              style={{
                flex: "none",
                display: "grid",
                placeItems: "center",
                width: 40,
                height: 40,
                borderRadius: 10,
                border: "1px solid var(--s-border)",
                background: "var(--s-card)",
                color: "var(--s-bad)",
                cursor: "pointer",
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── Small building blocks ─────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid var(--s-border)",
        borderRadius: "var(--r-card)",
        background: "var(--s-sunken)",
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 800, color: "var(--s-t1)" }}>{title}</span>
      {children}
    </div>
  );
}

function Grid2({ children }: { children: ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>{children}</div>;
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 30,
        padding: "0 12px",
        borderRadius: 9,
        border: `1px solid ${active ? "var(--s-brand)" : "var(--s-border)"}`,
        background: active ? "var(--s-brand-weak)" : "var(--s-card)",
        color: active ? "var(--s-brand)" : "var(--s-t2)",
        font: "inherit",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <SelectMenu
      label={label || undefined}
      value={value}
      options={options}
      onChange={onChange}
      placeholder={placeholder}
    />
  );
}
