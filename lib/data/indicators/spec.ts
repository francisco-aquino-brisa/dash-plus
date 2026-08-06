/**
 * The `especificacao_calculo` contract — client-safe types, vocabulary and a
 * pure validator. Mirrors docs/solicitacao-time-de-dados-indicadores-dinamicos.md
 * (Parte A): all keys and values are in Portuguese, like the warehouse.
 *
 * The `forma` carries the aggregation semantics (not `formato`): `simples` sums
 * the measure, `razao` recomputes Σnum ÷ Σden, `variacao_mensal` is mês − mês−1.
 */

export type Forma = "simples" | "razao" | "variacao_mensal";
export type Agregacao = "soma" | "contagem" | "contagem_distinta";
export type Formato = "inteiro" | "percentual" | "moeda" | "decimal";
export type Polaridade = "maior_melhor" | "menor_melhor";
export type Periodo = "atual" | "mes_anterior";
export type Operador =
  "igual" | "diferente" | "em" | "nao_em" | "maior" | "maior_igual" | "menor" | "menor_igual";

export interface Filtro {
  coluna: string;
  operador?: Operador;
  /** In the builder state this is always a string; serialization arrays it for `em`/`nao_em`. */
  valor: string | string[];
}

export interface Medida {
  agregacao: Agregacao;
  coluna?: string;
  expressao?: string;
  filtros?: Filtro[];
  periodo?: Periodo;
}

export interface CalcSpec {
  forma: Forma;
  fonte: string;
  medida?: Medida;
  numerador?: Medida;
  denominador?: Medida;
  filtros?: Filtro[];
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
];

// ── Constructors ──────────────────────────────────────────────────────────────

export function emptyMedida(): Medida {
  return { agregacao: "soma", coluna: "" };
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

// ── Parse / serialize ───────────────────────────────────────────────────────

/** Parse stored JSON into an editable spec (arrays of `valor` joined for editing). */
export function parseSpec(json: string | null | undefined): CalcSpec | null {
  if (!json || !json.trim()) return null;

  try {
    const raw = JSON.parse(json) as CalcSpec;
    const inMedida = (m?: Medida): Medida | undefined => m && { ...m, filtros: m.filtros?.map(inFiltro) };

    return {
      ...raw,
      medida: inMedida(raw.medida),
      numerador: inMedida(raw.numerador),
      denominador: inMedida(raw.denominador),
      filtros: raw.filtros?.map(inFiltro),
    };
  } catch {
    return null;
  }
}

function inFiltro(f: Filtro): Filtro {
  return { ...f, valor: Array.isArray(f.valor) ? f.valor.join(", ") : String(f.valor ?? "") };
}

/** Serialize the editable spec to canonical JSON — prunes empties, arrays list values. */
export function serializeSpec(spec: CalcSpec): string {
  const out: Record<string, unknown> = { forma: spec.forma, fonte: spec.fonte };

  if (spec.forma === "razao") {
    out.numerador = outMedida(spec.numerador);
    out.denominador = outMedida(spec.denominador);
  } else {
    out.medida = outMedida(spec.medida);
  }

  if (spec.filtros?.length) out.filtros = spec.filtros.map(outFiltro);

  out.formato = spec.formato;
  out.polaridade = spec.polaridade;

  return JSON.stringify(out, null, 2);
}

function outMedida(m?: Medida): Record<string, unknown> | undefined {
  if (!m) return undefined;

  const o: Record<string, unknown> = { agregacao: m.agregacao };

  if (m.expressao?.trim()) o.expressao = m.expressao.trim();
  else if (m.coluna?.trim()) o.coluna = m.coluna.trim();

  if (m.filtros?.length) o.filtros = m.filtros.map(outFiltro);

  if (m.periodo && m.periodo !== "atual") o.periodo = m.periodo;

  return o;
}

function outFiltro(f: Filtro): Record<string, unknown> {
  const op = f.operador && f.operador !== "igual" ? f.operador : undefined;
  const isList = op === "em" || op === "nao_em";
  const raw = Array.isArray(f.valor) ? f.valor.join(", ") : String(f.valor ?? "");
  const valor = isList
    ? raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : raw;
  const o: Record<string, unknown> = { coluna: f.coluna };

  if (op) o.operador = op;

  o.valor = valor;

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

    (m.filtros ?? []).forEach((f, i) => checkFilter(f, `${label} · filtro ${i + 1}`, cols, issues));
  };

  if (spec.forma === "razao") {
    checkMeasure(spec.numerador, "numerador", "Numerador");
    checkMeasure(spec.denominador, "denominador", "Denominador");
  } else {
    checkMeasure(spec.medida, "medida", "Medida");
  }

  (spec.filtros ?? []).forEach((f, i) => checkFilter(f, `Filtro ${i + 1}`, cols, issues));

  return issues;
}

function checkFilter(f: Filtro, label: string, cols: string[] | undefined, issues: SpecIssue[]): void {
  if (!f.coluna?.trim()) {
    issues.push({ path: label, message: `${label}: sem coluna.` });
  } else if (cols && !cols.includes(f.coluna.trim())) {
    issues.push({ path: label, message: `${label}: coluna "${f.coluna}" não existe na fonte.` });
  }

  const raw = Array.isArray(f.valor) ? f.valor.join(",") : String(f.valor ?? "");

  if (!raw.trim()) issues.push({ path: label, message: `${label}: sem valor.` });
}
