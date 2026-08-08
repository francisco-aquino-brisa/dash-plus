/**
 * The `especificacao_calculo` contract — client-safe types, vocabulary and a
 * pure validator. Mirrors docs/solicitacao-time-de-dados-indicadores-dinamicos.md
 * (Parte A): all keys and values are in Portuguese, like the warehouse.
 *
 * The `forma` carries the aggregation semantics (not `formato`): `simples` sums
 * the measure, `razao` recomputes Σnum ÷ Σden, `variacao_mensal` is mês − mês−1.
 *
 * Filters form a TREE: a `Grupo` joins its `itens` (conditions or nested groups)
 * by `juncao` (E/OU), so `(a OR b) AND c` and `a OR (b AND c)` are expressible.
 */

export type Forma = "simples" | "razao" | "variacao_mensal";
export type Agregacao = "soma" | "contagem" | "contagem_distinta";
export type Formato = "inteiro" | "percentual" | "moeda" | "decimal";
export type Polaridade = "maior_melhor" | "menor_melhor";
export type Periodo = "atual" | "mes_anterior";
export type Operador =
  | "igual"
  | "diferente"
  | "em"
  | "nao_em"
  | "maior"
  | "maior_igual"
  | "menor"
  | "menor_igual"
  | "nulo"
  | "nao_nulo";

/** How a group's items are joined (E/OU). */
export type Conector = "e" | "ou";

/** A leaf comparison. In builder state `valor` is a string; serialized to an array for em/nao_em. */
export interface Condicao {
  coluna: string;
  operador?: Operador;
  valor: string | string[];
}

/** A group of items (conditions or nested groups) joined by `juncao`. */
export interface Grupo {
  juncao: Conector;
  itens: FiltroNo[];
}

export type FiltroNo = ({ tipo: "condicao" } & Condicao) | ({ tipo: "grupo" } & Grupo);

/** Operators that take no value (IS NULL / IS NOT NULL). */
export function operadorSemValor(op: Operador | undefined): boolean {
  return op === "nulo" || op === "nao_nulo";
}

export interface Medida {
  agregacao: Agregacao;
  coluna?: string;
  expressao?: string;
  filtros?: Grupo;
  periodo?: Periodo;
}

export interface CalcSpec {
  forma: Forma;
  fonte: string;
  medida?: Medida;
  numerador?: Medida;
  denominador?: Medida;
  filtros?: Grupo;
  formato: Formato;
  polaridade: Polaridade;
}

// ── UI vocabularies (value + human label) ────────────────────────────────────

export const FORMAS: { value: Forma; label: string }[] = [
  { value: "simples", label: "Simples — soma/contagem" },
  { value: "razao", label: "Razão — numerador ÷ denominador" },
  { value: "variacao_mensal", label: "Variação mensal — mês − mês anterior" },
];

export const AGREGACOES: { value: Agregacao; label: string }[] = [
  { value: "soma", label: "Soma" },
  { value: "contagem", label: "Contagem" },
  { value: "contagem_distinta", label: "Contagem distinta" },
];

export const FORMATOS: { value: Formato; label: string }[] = [
  { value: "inteiro", label: "Inteiro" },
  { value: "percentual", label: "Percentual (×100)" },
  { value: "moeda", label: "Moeda (R$)" },
  { value: "decimal", label: "Decimal" },
];

export const POLARIDADES: { value: Polaridade; label: string }[] = [
  { value: "maior_melhor", label: "Maior melhor" },
  { value: "menor_melhor", label: "Menor melhor" },
];

export const PERIODOS: { value: Periodo; label: string }[] = [
  { value: "atual", label: "Mês atual" },
  { value: "mes_anterior", label: "Mês anterior" },
];

export const OPERADORES: { value: Operador; label: string }[] = [
  { value: "igual", label: "= igual" },
  { value: "diferente", label: "≠ diferente" },
  { value: "em", label: "∈ em (lista)" },
  { value: "nao_em", label: "∉ não em (lista)" },
  { value: "maior", label: "> maior" },
  { value: "maior_igual", label: "≥ maior ou igual" },
  { value: "menor", label: "< menor" },
  { value: "menor_igual", label: "≤ menor ou igual" },
  { value: "nulo", label: "vazio (nulo)" },
  { value: "nao_nulo", label: "preenchido (não nulo)" },
];

export const CONECTORES: { value: Conector; label: string }[] = [
  { value: "e", label: "E" },
  { value: "ou", label: "OU" },
];

// ── Constructors ──────────────────────────────────────────────────────────────

export function emptyMedida(): Medida {
  return { agregacao: "soma", coluna: "" };
}

export function emptyCondicao(): FiltroNo {
  return { tipo: "condicao", coluna: "", operador: "igual", valor: "" };
}

export function emptyGrupo(): Grupo {
  return { juncao: "e", itens: [] };
}

export function emptySpec(): CalcSpec {
  return {
    forma: "simples",
    fonte: "",
    medida: emptyMedida(),
    formato: "inteiro",
    polaridade: "maior_melhor",
  };
}

// ── Parse ─────────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

function toNode(raw: any): FiltroNo | null {
  if (!raw || typeof raw !== "object") return null;

  const isGrupo = Array.isArray(raw.itens) || raw.tipo === "grupo" || raw.juncao != null;

  if (isGrupo) {
    return {
      tipo: "grupo",
      juncao: raw.juncao === "ou" ? "ou" : "e",
      itens: (raw.itens ?? []).map(toNode).filter(Boolean) as FiltroNo[],
    };
  }

  return {
    tipo: "condicao",
    coluna: String(raw.coluna ?? ""),
    operador: raw.operador,
    valor: Array.isArray(raw.valor) ? raw.valor.join(", ") : String(raw.valor ?? ""),
  };
}

/** Normalize either the legacy flat array (implicit AND) or a group object into a Grupo. */
function normGrupo(raw: any): Grupo | undefined {
  if (raw == null) return undefined;

  if (Array.isArray(raw)) {
    return { juncao: "e", itens: raw.map(toNode).filter(Boolean) as FiltroNo[] };
  }

  if (typeof raw === "object") {
    return {
      juncao: raw.juncao === "ou" ? "ou" : "e",
      itens: (raw.itens ?? []).map(toNode).filter(Boolean) as FiltroNo[],
    };
  }

  return undefined;
}

/** Parse stored JSON into an editable spec (list `valor`s joined, filters as a tree). */
export function parseSpec(json: string | null | undefined): CalcSpec | null {
  if (!json || !json.trim()) return null;

  try {
    const raw = JSON.parse(json) as any;
    const inMedida = (m?: any): Medida | undefined =>
      m && {
        agregacao: m.agregacao,
        coluna: m.coluna,
        expressao: m.expressao,
        periodo: m.periodo,
        filtros: normGrupo(m.filtros),
      };

    return {
      forma: raw.forma,
      fonte: raw.fonte,
      medida: inMedida(raw.medida),
      numerador: inMedida(raw.numerador),
      denominador: inMedida(raw.denominador),
      filtros: normGrupo(raw.filtros),
      formato: raw.formato,
      polaridade: raw.polaridade,
    };
  } catch {
    return null;
  }
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Serialize ─────────────────────────────────────────────────────────────────

/** Serialize the editable spec to canonical JSON — prunes empties, arrays list values. */
export function serializeSpec(spec: CalcSpec): string {
  const out: Record<string, unknown> = { forma: spec.forma, fonte: spec.fonte };

  if (spec.forma === "razao") {
    out.numerador = outMedida(spec.numerador);
    out.denominador = outMedida(spec.denominador);
  } else {
    out.medida = outMedida(spec.medida);
  }

  const g = outRoot(spec.filtros);

  if (g !== undefined) out.filtros = g;

  out.formato = spec.formato;
  out.polaridade = spec.polaridade;

  return JSON.stringify(out, null, 2);
}

function outMedida(m?: Medida): Record<string, unknown> | undefined {
  if (!m) return undefined;

  const o: Record<string, unknown> = { agregacao: m.agregacao };

  if (m.expressao?.trim()) o.expressao = m.expressao.trim();
  else if (m.coluna?.trim()) o.coluna = m.coluna.trim();

  const g = outRoot(m.filtros);

  if (g !== undefined) o.filtros = g;

  if (m.periodo && m.periodo !== "atual") o.periodo = m.periodo;

  return o;
}

/** Root group: emit the simple all-"e"-of-conditions case as a flat array (doc-friendly). */
function outRoot(g?: Grupo): unknown {
  if (!g || g.itens.length === 0) return undefined;

  if (g.juncao === "e" && g.itens.every((n) => n.tipo === "condicao")) {
    return g.itens.map((n) => outCond(n as Condicao));
  }

  return outGrupo(g);
}

function outGrupo(g: Grupo): Record<string, unknown> {
  return { juncao: g.juncao, itens: g.itens.map((n) => (n.tipo === "grupo" ? outGrupo(n) : outCond(n))) };
}

function outCond(c: Condicao): Record<string, unknown> {
  const op = c.operador && c.operador !== "igual" ? c.operador : undefined;
  const isList = op === "em" || op === "nao_em";
  const o: Record<string, unknown> = { coluna: c.coluna };

  if (op) o.operador = op;

  if (!operadorSemValor(c.operador)) {
    const raw = Array.isArray(c.valor) ? c.valor.join(", ") : String(c.valor ?? "");

    o.valor = isList
      ? raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : raw;
  }

  return o;
}

// ── Validation ────────────────────────────────────────────────────────────────

export interface SpecIssue {
  path: string;
  message: string;
}

const IDENT = /[a-zA-Z_][a-zA-Z0-9_]*/g;

export function expressionColumns(expr: string): string[] {
  return [...new Set(expr.match(IDENT) ?? [])];
}

function hasInvalidExprChars(expr: string): boolean {
  return /[^a-zA-Z0-9_+\-*/().\s]/.test(expr);
}

/**
 * Validate a spec against the registered source columns. Returns [] when valid.
 * Unknown source / column / empty required field surface as issues so the UI can
 * block "definição incompleta" — never a silently-wrong indicator.
 */
export function validateSpec(spec: CalcSpec, columnsBySource: Record<string, string[]>): SpecIssue[] {
  const issues: SpecIssue[] = [];

  if (!spec.fonte) issues.push({ path: "fonte", message: "Selecione a fonte." });

  const cols = spec.fonte ? columnsBySource[spec.fonte] : undefined;

  if (spec.fonte && !cols) issues.push({ path: "fonte", message: "Fonte não registrada no app." });

  const checkMeasure = (m: Medida | undefined, path: string, label: string) => {
    if (!m) {
      issues.push({ path, message: `${label}: medida obrigatória.` });

      return;
    }

    const hasCol = !!m.coluna?.trim();
    const hasExpr = !!m.expressao?.trim();

    if (!hasCol && !hasExpr) issues.push({ path, message: `${label}: informe uma coluna ou expressão.` });

    if (hasCol && hasExpr) issues.push({ path, message: `${label}: use coluna OU expressão, não ambas.` });

    if (hasExpr && m.agregacao !== "soma")
      issues.push({ path, message: `${label}: expressão só é suportada com Soma.` });

    if (hasCol && cols && !cols.includes(m.coluna!.trim()))
      issues.push({ path, message: `${label}: coluna "${m.coluna}" não existe na fonte.` });

    if (hasExpr) {
      if (hasInvalidExprChars(m.expressao!))
        issues.push({ path, message: `${label}: expressão só pode ter colunas e + - * / ( ).` });
      else if (cols)
        for (const c of expressionColumns(m.expressao!))
          if (!cols.includes(c))
            issues.push({ path, message: `${label}: coluna "${c}" não existe na fonte.` });
    }

    checkGrupo(m.filtros, `${label} · filtros`, cols, issues);
  };

  if (spec.forma === "razao") {
    checkMeasure(spec.numerador, "numerador", "Numerador");
    checkMeasure(spec.denominador, "denominador", "Denominador");
  } else {
    checkMeasure(spec.medida, "medida", "Medida");
  }

  checkGrupo(spec.filtros, "Filtros", cols, issues);

  return issues;
}

function checkGrupo(
  g: Grupo | undefined,
  label: string,
  cols: string[] | undefined,
  issues: SpecIssue[],
): void {
  if (!g) return;

  g.itens.forEach((n, i) => {
    if (n.tipo === "grupo") checkGrupo(n, `${label} › grupo ${i + 1}`, cols, issues);
    else checkCondicao(n, `${label} › ${i + 1}`, cols, issues);
  });
}

function checkCondicao(c: Condicao, label: string, cols: string[] | undefined, issues: SpecIssue[]): void {
  if (!c.coluna?.trim()) {
    issues.push({ path: label, message: `${label}: sem coluna.` });
  } else if (cols && !cols.includes(c.coluna.trim())) {
    issues.push({ path: label, message: `${label}: coluna "${c.coluna}" não existe na fonte.` });
  }

  if (operadorSemValor(c.operador)) return; // nulo / não nulo dispensam valor

  const raw = Array.isArray(c.valor) ? c.valor.join(",") : String(c.valor ?? "");

  if (!raw.trim()) issues.push({ path: label, message: `${label}: sem valor.` });
}
