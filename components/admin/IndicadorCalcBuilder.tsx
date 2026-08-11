"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { PrimaryButton } from "./primitives";
import { SelectMenu } from "./SelectMenu";
import { salvarCalculo } from "@/app/(app)/admin/indicadores/actions";
import { sourceOptions } from "@/lib/data/indicators/sources";
import { specToSql } from "@/lib/data/indicators/to-sql";
import {
  AGREGACOES,
  emptyCondicao,
  emptyGrupo,
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
  type Condicao,
  type Conector,
  type FiltroNo,
  type Grupo,
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
  const [view, setView] = useState<"json" | "sql">("json");

  const columns = sourceColumns[spec.fonte] ?? [];
  const json = useMemo(() => serializeSpec(spec), [spec]);
  const sql = useMemo(() => specToSql(spec), [spec]);
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
      <GrupoEditor
        title="Filtros (aplicados a todas as medidas)"
        columns={columns}
        grupo={spec.filtros}
        onChange={(g) => set({ filtros: g })}
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

      {/* JSON / SQL preview */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ ...labelStyle, marginBottom: 0 }}>especificacao_calculo</span>
          <span style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 6 }}>
            <ModeTab active={view === "json"} onClick={() => setView("json")}>
              JSON
            </ModeTab>
            <ModeTab active={view === "sql"} onClick={() => setView("sql")}>
              SQL
            </ModeTab>
          </div>
        </div>
        <pre
          style={{
            marginTop: 6,
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
          {view === "json" ? json : sql}
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

      <GrupoEditor
        title="Filtros da medida"
        columns={columns}
        grupo={value.filtros}
        onChange={(g) => set({ filtros: g })}
      />
    </Section>
  );
}

// ── Filter tree (groups of conditions / nested groups) ─────────────────────────

function GrupoEditor({
  grupo,
  columns,
  onChange,
  title,
  depth = 0,
}: {
  grupo: Grupo | undefined;
  columns: string[];
  onChange: (g: Grupo) => void;
  title?: string;
  depth?: number;
}) {
  const g = grupo ?? emptyGrupo();

  const setJuncao = (j: Conector) => onChange({ ...g, juncao: j });
  const addCond = () => onChange({ ...g, itens: [...g.itens, emptyCondicao()] });
  const addGrupo = () => onChange({ ...g, itens: [...g.itens, { tipo: "grupo", juncao: "e", itens: [] }] });
  const updateItem = (i: number, node: FiltroNo) =>
    onChange({ ...g, itens: g.itens.map((n, idx) => (idx === i ? node : n)) });
  const removeItem = (i: number) => onChange({ ...g, itens: g.itens.filter((_, idx) => idx !== i) });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {title && <span style={{ ...labelStyle, marginBottom: 0 }}>{title}</span>}
        {g.itens.length > 1 && (
          <div style={{ display: "flex", gap: 6 }}>
            <ModeTab active={g.juncao === "e"} onClick={() => setJuncao("e")}>
              E
            </ModeTab>
            <ModeTab active={g.juncao === "ou"} onClick={() => setJuncao("ou")}>
              OU
            </ModeTab>
          </div>
        )}
        <span style={{ flex: 1 }} />
        <AddBtn onClick={addCond}>Condição</AddBtn>
        {depth < 2 && <AddBtn onClick={addGrupo}>Grupo</AddBtn>}
      </div>

      {g.itens.length === 0 && (
        <span style={{ fontSize: 11.5, color: "var(--s-t3)", fontStyle: "italic" }}>Sem filtros.</span>
      )}

      {g.itens.map((n, i) =>
        n.tipo === "grupo" ? (
          <div
            key={i}
            style={{
              border: "1px solid var(--s-border)",
              borderLeft: "3px solid var(--s-brand)",
              borderRadius: 10,
              background: "var(--s-card)",
              padding: 10,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".08em", color: "var(--s-t3)" }}>
                GRUPO
              </span>
              <span style={{ flex: 1 }} />
              <RemoveBtn onClick={() => removeItem(i)} label="Remover grupo" />
            </div>
            <GrupoEditor
              grupo={n}
              columns={columns}
              onChange={(gg) => updateItem(i, { tipo: "grupo", ...gg })}
              depth={depth + 1}
            />
          </div>
        ) : (
          <CondicaoRow
            key={i}
            cond={n}
            columns={columns}
            onChange={(c) => updateItem(i, { tipo: "condicao", ...c })}
            onRemove={() => removeItem(i)}
          />
        ),
      )}
    </div>
  );
}

function CondicaoRow({
  cond: c,
  columns,
  onChange,
  onRemove,
}: {
  cond: Condicao;
  columns: string[];
  onChange: (c: Condicao) => void;
  onRemove: () => void;
}) {
  const isList = c.operador === "em" || c.operador === "nao_em";
  const isNull = c.operador === "nulo" || c.operador === "nao_nulo";
  const set = (patch: Partial<Condicao>) => onChange({ ...c, ...patch });

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <div style={{ flex: 1.2, minWidth: 0 }}>
        <SelectField
          label=""
          value={c.coluna}
          options={columns.map((col) => ({ value: col, label: col }))}
          placeholder="coluna…"
          onChange={(v) => set({ coluna: v })}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <SelectField
          label=""
          value={c.operador ?? "igual"}
          options={OPERADORES}
          onChange={(v) => set({ operador: v as Condicao["operador"] })}
        />
      </div>
      <div style={{ flex: 1.2, minWidth: 0 }}>
        {isNull ? (
          <div
            style={{
              ...controlStyle,
              display: "flex",
              alignItems: "center",
              background: "var(--s-card)",
              color: "var(--s-t3)",
            }}
          >
            —
          </div>
        ) : (
          <input
            value={Array.isArray(c.valor) ? c.valor.join(", ") : c.valor}
            onChange={(e) => set({ valor: e.target.value })}
            placeholder={isList ? "A, B, C" : "valor"}
            style={controlStyle}
          />
        )}
      </div>
      <RemoveBtn onClick={onRemove} label="Remover condição" />
    </div>
  );
}

/** Small add/remove buttons — exported for reuse in the indicador/serviço CRUD forms. */
export function AddBtn({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
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
      <Plus size={13} /> {children}
    </button>
  );
}

export function RemoveBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="bd-ghost"
      style={{
        flex: "none",
        display: "grid",
        placeItems: "center",
        width: 36,
        height: 36,
        borderRadius: 9,
        border: "1px solid var(--s-border)",
        background: "var(--s-card)",
        color: "var(--s-bad)",
        cursor: "pointer",
      }}
    >
      <Trash2 size={14} />
    </button>
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

/** Small tab toggle (E/OU, Coluna/Expressão, JSON/SQL) — exported for reuse in the detail screen. */
export function ModeTab({
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
