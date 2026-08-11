/**
 * Read-only, human-readable SQL rendering of a `CalcSpec` — feeds the "SQL" view
 * toggle next to the JSON editor/display (admin/indicadores). Client-safe: no
 * Databricks client, no server-only import. Literal values are embedded directly
 * (quoted, never parameterized) since this text is for reading, not execution.
 *
 * Deliberately simple: a single competência filter (no month-by-month date-cast
 * gymnastics or GROUP BY) so the AND/OR filter tree — the part that actually
 * defines the indicator — is what stands out.
 */

import { SOURCE_META } from "./sources";
import type { CalcSpec, Condicao, Grupo, Medida } from "./spec";

const OPS: Record<string, string> = {
  igual: "=",
  diferente: "<>",
  maior: ">",
  maior_igual: ">=",
  menor: "<",
  menor_igual: "<=",
};

function quote(v: string): string {
  return `'${v.replace(/'/g, "''")}'`;
}

function condToSql(c: Condicao): string {
  const col = c.coluna || "<coluna>";
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

    return `${col} ${op === "em" ? "IN" : "NOT IN"} (${vals.map(quote).join(", ")})`;
  }

  const raw = Array.isArray(c.valor) ? c.valor.join(",") : String(c.valor ?? "");

  return `${col} ${OPS[op] ?? "="} ${quote(raw)}`;
}

function grupoToSql(g?: Grupo): string | null {
  if (!g || g.itens.length === 0) return null;

  const parts = g.itens
    .map((n) => (n.tipo === "grupo" ? grupoToSql(n) : condToSql(n)))
    .filter((p): p is string => !!p);

  if (parts.length === 0) return null;

  const j = g.juncao === "ou" ? " OR " : " AND ";

  return `(${parts.join(j)})`;
}

function measureToSql(m: Medida | undefined, label: string): string {
  if (!m) return `NULL /* ${label} não definida */`;

  const cond = grupoToSql(m.filtros);

  if (m.agregacao === "contagem") return cond ? `COUNT(CASE WHEN ${cond} THEN 1 END)` : "COUNT(*)";

  if (m.agregacao === "contagem_distinta") {
    const key = m.coluna || "<coluna>";

    return cond ? `COUNT(DISTINCT CASE WHEN ${cond} THEN ${key} END)` : `COUNT(DISTINCT ${key})`;
  }

  // soma
  const operand = m.expressao?.trim() || m.coluna || "<coluna>";

  return `SUM(${cond ? `CASE WHEN ${cond} THEN ${operand} END` : operand})`;
}

/** Render the spec as a readable, simplified SQL SELECT — the filter tree is the focus. */
export function specToSql(spec: CalcSpec): string {
  if (!spec.fonte) return "-- selecione a fonte para gerar o SQL";

  const meta = SOURCE_META[spec.fonte];
  const competenciaCol = meta?.competencia ?? "<competencia>";
  const isRazao = spec.forma === "razao";

  const select = isRazao
    ? [
        `  ${measureToSql(spec.numerador, "numerador")} AS numerador,`,
        `  ${measureToSql(spec.denominador, "denominador")} AS denominador`,
      ]
    : [`  ${measureToSql(spec.medida, "medida")} AS valor`];

  const where = [`${competenciaCol} = 'AAAA-MM'  -- ou: BETWEEN 'AAAA-MM-01' AND 'AAAA-MM-31'`];
  const specCond = grupoToSql(spec.filtros);

  if (specCond) where.push(specCond);

  const lines = [
    "SELECT",
    select.join("\n"),
    `FROM projeto_brisa_performance.${spec.fonte}`,
    `WHERE ${where.join("\n  AND ")}`,
  ];

  const notes: string[] = [];

  if (isRazao) {
    notes.push("-- valor final = SUM(numerador) ÷ SUM(denominador)");

    if (spec.denominador?.periodo === "mes_anterior") {
      notes.push("-- denominador usa a competência do MÊS ANTERIOR (periodo: mes_anterior)");
    }
  } else if (spec.forma === "variacao_mensal") {
    notes.push("-- valor final = valor(competência) − valor(mês anterior)");
  }

  return notes.length ? `${lines.join("\n")}\n\n${notes.join("\n")}` : lines.join("\n");
}
