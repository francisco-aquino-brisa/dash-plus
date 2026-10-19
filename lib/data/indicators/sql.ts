import "server-only";

import { expressionColumns, type Condicao, type Grupo, type Medida } from "./spec";

/**
 * SQL fragments shared by the admin preview and the screens' batch engine. Column
 * names are inlined only after being whitelisted against the source's real
 * columns; every filter value is pushed onto `params` as an ordinal `?`.
 */

export const CAT = process.env.DATABRICKS_CITIES_CATALOG ?? "gdb_brisanet_comunidade_dev";
export const SCHEMA = process.env.DATABRICKS_CITIES_SCHEMA ?? "projeto_brisa_performance";

export const sourceTable = (fonte: string) => `\`${CAT}\`.\`${SCHEMA}\`.\`${fonte}\``;

const OPS: Record<string, string> = {
  igual: "=",
  diferente: "<>",
  maior: ">",
  maior_igual: ">=",
  menor: "<",
  menor_igual: "<=",
};

// Type-agnostic competência handling: works for timestamp/date columns and for
// `dd/MM/yyyy` string columns without erroring under ANSI mode.
export const tsExpr = (col: string) =>
  `coalesce(try_cast(${col} as timestamp), try_to_timestamp(cast(${col} as string), 'dd/MM/yyyy'))`;
export const ymExpr = (col: string) => `date_format(${tsExpr(col)}, 'yyyy-MM')`;

const numCast = (op: string) => `try_cast(replace(cast(${op} as string), ',', '.') as double)`;

export function assertCol(col: string, cols: Set<string>): string {
  const c = col.trim();

  if (!cols.has(c)) throw new Error(`coluna desconhecida: ${col}`);

  return c;
}

function assertExpr(expr: string, cols: Set<string>): string {
  if (/[^a-zA-Z0-9_+\-*/().\s]/.test(expr)) throw new Error("expressão inválida");

  for (const c of expressionColumns(expr)) assertCol(c, cols);

  return expr;
}

function condSql(c: Condicao, params: unknown[], cols: Set<string>): string {
  const col = assertCol(c.coluna, cols);
  const op = c.operador ?? "igual";

  if (op === "nulo") return `${col} IS NULL`;

  if (op === "nao_nulo") return `${col} IS NOT NULL`;

  if (op === "em" || op === "nao_em") {
    const vals = Array.isArray(c.valor)
      ? c.valor
      : String(c.valor)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

    if (vals.length === 0) return "1=1";

    vals.forEach((v) => params.push(v));

    return `${col} ${op === "em" ? "IN" : "NOT IN"} (${vals.map(() => "?").join(", ")})`;
  }

  params.push(Array.isArray(c.valor) ? c.valor.join(",") : c.valor);

  return `${col} ${OPS[op] ?? "="} ?`;
}

/** A filter tree as SQL: each group is parenthesized and joined by its `juncao`. */
export function buildGrupo(g: Grupo | undefined, params: unknown[], cols: Set<string>): string | null {
  if (!g || g.itens.length === 0) return null;

  const parts = g.itens
    .map((n) => (n.tipo === "grupo" ? buildGrupo(n, params, cols) : condSql(n, params, cols)))
    .filter((p): p is string => !!p);

  if (parts.length === 0) return null;

  return `(${parts.join(g.juncao === "ou" ? " OR " : " AND ")})`;
}

/**
 * The aggregate for one measure. `outer` is the indicator-level filter, folded
 * into the measure's own CASE so several indicators can share one SELECT.
 */
export function measureAgg(m: Medida, params: unknown[], cols: Set<string>, outer?: Grupo): string {
  const conds = [buildGrupo(outer, params, cols), buildGrupo(m.filtros, params, cols)].filter(
    (c): c is string => !!c,
  );
  const cond = conds.length ? conds.join(" AND ") : null;

  if (m.agregacao === "contagem") return cond ? `COUNT(CASE WHEN ${cond} THEN 1 END)` : "COUNT(*)";

  if (m.agregacao === "contagem_distinta") {
    const key = assertCol(m.coluna ?? "", cols);

    return cond ? `COUNT(DISTINCT CASE WHEN ${cond} THEN ${key} END)` : `COUNT(DISTINCT ${key})`;
  }

  return `SUM(${operandSql(m, cond, cols)})`;
}

/**
 * Média is emitted as SUM plus this COUNT and divided only after the partials are
 * summed — an AVG per group cannot be rolled up across cities.
 */
export function measureCount(m: Medida, params: unknown[], cols: Set<string>, outer?: Grupo): string | null {
  if (m.agregacao !== "media") return null;

  const conds = [buildGrupo(outer, params, cols), buildGrupo(m.filtros, params, cols)].filter(
    (c): c is string => !!c,
  );

  return `COUNT(${operandSql(m, conds.length ? conds.join(" AND ") : null, cols)})`;
}

function operandSql(m: Medida, cond: string | null, cols: Set<string>): string {
  const operand = m.expressao?.trim() ? assertExpr(m.expressao, cols) : assertCol(m.coluna ?? "", cols);
  const casted = numCast(operand);

  return cond ? `CASE WHEN ${cond} THEN ${casted} END` : casted;
}
