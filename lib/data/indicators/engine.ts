import "server-only";

import { DatabricksDataClient } from "@/lib/data/databricks";
import { SOURCE_META, type PreviewFilters, type PreviewResult } from "./sources";
import { expressionColumns, type CalcSpec, type Filtro, type Medida } from "./spec";

export type { PreviewFilters, PreviewResult };

/**
 * Preview engine: builds a bounded SQL query from an `especificacao_calculo` and
 * runs it against the source view, returning the computed value per competência.
 * READ-ONLY (SELECT). Column names are inlined only after being whitelisted against
 * the source's real columns; all filter values are bound as ordinal `?` params.
 *
 * Faithful enough to show "how the indicator behaves": it applies the spec's own
 * aggregation/filters, but does not reproduce source-specific dedup beyond what a
 * `contagem_distinta` measure expresses — so it's a preview, not the production number.
 */

const CAT = process.env.DATABRICKS_CITIES_CATALOG ?? "gdb_brisanet_comunidade_dev";
const SCHEMA = process.env.DATABRICKS_CITIES_SCHEMA ?? "projeto_brisa_performance";

const OPS: Record<string, string> = {
  igual: "=",
  diferente: "<>",
  maior: ">",
  maior_igual: ">=",
  menor: "<",
  menor_igual: "<=",
};

// Type-agnostic competência handling: works for timestamp/date columns and for
// `dd/MM/yyyy` string columns (vw_vendas_5g) without erroring under ANSI mode.
const tsExpr = (col: string) =>
  `coalesce(try_cast(${col} as timestamp), try_to_timestamp(cast(${col} as string), 'dd/MM/yyyy'))`;
const ymExpr = (col: string) => `date_format(${tsExpr(col)}, 'yyyy-MM')`;
const numCast = (op: string) => `try_cast(replace(cast(${op} as string), ',', '.') as double)`;

function assertCol(col: string, cols: Set<string>): string {
  const c = col.trim();

  if (!cols.has(c)) throw new Error(`coluna desconhecida: ${col}`);

  return c;
}

function assertExpr(expr: string, cols: Set<string>): string {
  if (/[^a-zA-Z0-9_+\-*/().\s]/.test(expr)) throw new Error("expressão inválida");

  for (const c of expressionColumns(expr)) assertCol(c, cols);

  return expr;
}

function filterCond(f: Filtro, params: unknown[], cols: Set<string>): string {
  const col = assertCol(f.coluna, cols);
  const op = f.operador ?? "igual";

  if (op === "em" || op === "nao_em") {
    const vals = Array.isArray(f.valor)
      ? f.valor
      : String(f.valor)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

    if (vals.length === 0) return "1=1";

    const ph = vals.map(() => "?").join(", ");

    vals.forEach((v) => params.push(v));

    return `${col} ${op === "em" ? "IN" : "NOT IN"} (${ph})`;
  }

  params.push(Array.isArray(f.valor) ? f.valor.join(",") : f.valor);

  return `${col} ${OPS[op] ?? "="} ?`;
}

function measureAgg(m: Medida, params: unknown[], cols: Set<string>): string {
  const conds = (m.filtros ?? []).map((f) => filterCond(f, params, cols));
  const cond = conds.length ? conds.join(" AND ") : null;

  if (m.agregacao === "contagem") return cond ? `COUNT(CASE WHEN ${cond} THEN 1 END)` : "COUNT(*)";

  if (m.agregacao === "contagem_distinta") {
    const key = assertCol(m.coluna ?? "", cols);

    return cond ? `COUNT(DISTINCT CASE WHEN ${cond} THEN ${key} END)` : `COUNT(DISTINCT ${key})`;
  }

  // soma
  const operand = m.expressao?.trim() ? assertExpr(m.expressao, cols) : assertCol(m.coluna ?? "", cols);
  const casted = numCast(operand);

  return `SUM(${cond ? `CASE WHEN ${cond} THEN ${casted} END` : casted})`;
}

function prevYm(ym: string): string {
  const [y, m] = ym.split("-").map(Number);

  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

interface Row {
  ym: string;
  num: number;
  den: number | null;
}

function computeValue(spec: CalcSpec, data: Row[], ym: string): number | null {
  const at = (m: string) => data.find((r) => r.ym === m);

  if (spec.forma === "simples") return at(ym)?.num ?? null;

  if (spec.forma === "variacao_mensal") return (at(ym)?.num ?? 0) - (at(prevYm(ym))?.num ?? 0);

  // razao
  const denMonth = spec.denominador?.periodo === "mes_anterior" ? prevYm(ym) : ym;
  const numv = at(ym)?.num ?? 0;
  const denv = at(denMonth)?.den ?? null;

  return denv ? numv / denv : null;
}

export async function runPreview(
  spec: CalcSpec,
  pf: PreviewFilters,
  columns: string[],
): Promise<PreviewResult> {
  const meta = SOURCE_META[spec.fonte];

  if (!meta) throw new Error("fonte não registrada");

  const cols = new Set(columns);
  const params: unknown[] = [];

  const numM = spec.forma === "razao" ? spec.numerador : spec.medida;
  const denM = spec.forma === "razao" ? spec.denominador : undefined;

  if (!numM) throw new Error("medida ausente");

  const numSql = measureAgg(numM, params, cols);
  const denSql = denM ? measureAgg(denM, params, cols) : "CAST(NULL AS DOUBLE)";

  const where: string[] = [`${tsExpr(meta.competencia)} >= add_months(current_date(), -12)`];

  for (const f of spec.filtros ?? []) where.push(filterCond(f, params, cols));

  const sql = `SELECT ${ymExpr(meta.competencia)} AS ym, ${numSql} AS num, ${denSql} AS den
       FROM \`${CAT}\`.\`${SCHEMA}\`.\`${spec.fonte}\`
      WHERE ${where.join(" AND ")}
      GROUP BY 1
      ORDER BY 1`;

  const rows = await new DatabricksDataClient().query<{ ym: unknown; num: unknown; den: unknown }>(
    sql,
    params,
  );

  const data: Row[] = rows
    .map((r) => ({
      ym: String(r.ym ?? ""),
      num: r.num == null ? 0 : Number(r.num),
      den: r.den == null ? null : Number(r.den),
    }))
    .filter((r) => r.ym && r.ym !== "null");

  const meses = data.map((r) => r.ym);
  // Respect an explicit pick (may have no data → value "—"); otherwise latest month.
  const target = pf.competencia ?? meses[meses.length - 1] ?? null;
  const valor = target ? computeValue(spec, data, target) : null;

  return { valor, competencia: target, meses };
}
