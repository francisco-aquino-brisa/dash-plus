import "server-only";

import { DatabricksDataClient } from "@/lib/data/databricks";
import { SOURCE_META } from "./sources";
import type { CalcSpec } from "./spec";
import { measureAgg, sourceTable, tsExpr, ymExpr } from "./sql";
import type { MonthPartial } from "./values";

export interface BatchItem {
  key: string;
  spec: CalcSpec;
}

/**
 * How a screen narrows one source. Every column/expression here is code-owned;
 * request values only ever travel in `params`.
 */
export interface SourceScope {
  /** Extra GROUP BY columns, returned under their alias (e.g. the city id). */
  groupBy?: { alias: string; expr: string }[];
  where?: string[];
  params?: unknown[];
}

export interface BatchRow {
  ym: string;
  group: Record<string, string>;
  values: Map<string, MonthPartial>;
}

/** Months of history fetched: 12 on screen plus the one before, for deltas and `mes_anterior`. */
const MONTHS_BACK = 12;

/**
 * Every indicator of one source in a single SELECT: each spec becomes a
 * numerator (and denominator) column, grouped by month and the scope's columns.
 */
export function buildSourceBatch(
  fonte: string,
  items: BatchItem[],
  columns: string[],
  scope: SourceScope = {},
): { sql: string; params: unknown[] } {
  const meta = SOURCE_META[fonte];

  if (!meta) throw new Error(`fonte não registrada: ${fonte}`);

  const cols = new Set(columns);
  const params: unknown[] = [];
  const select: string[] = [];

  items.forEach((it, i) => {
    const { spec } = it;
    const numM = spec.forma === "razao" ? spec.numerador : spec.medida;

    if (!numM) throw new Error(`medida ausente: ${it.key}`);

    select.push(`${measureAgg(numM, params, cols, spec.filtros)} AS n${i}`);

    if (spec.forma === "razao" && spec.denominador) {
      select.push(`${measureAgg(spec.denominador, params, cols, spec.filtros)} AS d${i}`);
    }
  });

  const groupBy = scope.groupBy ?? [];
  const where = [
    `${tsExpr(meta.competencia)} >= add_months(date_trunc('MM', current_date()), -${MONTHS_BACK})`,
    ...(scope.where ?? []),
  ];
  const sql = `SELECT ${ymExpr(meta.competencia)} AS ym${groupBy.map((g) => `, ${g.expr} AS ${g.alias}`).join("")},
         ${select.join(",\n         ")}
    FROM ${sourceTable(fonte)}
   WHERE ${where.join(" AND ")}
   GROUP BY ${["1", ...groupBy.map((_, i) => String(i + 2))].join(", ")}`;

  return { sql, params: [...params, ...(scope.params ?? [])] };
}

export async function runSourceBatch(
  fonte: string,
  items: BatchItem[],
  columns: string[],
  scope: SourceScope = {},
): Promise<BatchRow[]> {
  const { sql, params } = buildSourceBatch(fonte, items, columns, scope);
  const groupBy = scope.groupBy ?? [];
  const rows = await new DatabricksDataClient().query<Record<string, unknown>>(sql, params);

  return rows
    .filter((r) => r.ym != null)
    .map((r) => {
      const values = new Map<string, MonthPartial>();

      items.forEach((it, i) => {
        const d = r[`d${i}`];

        values.set(it.key, { num: Number(r[`n${i}`] ?? 0) || 0, den: d == null ? null : Number(d) });
      });

      const group: Record<string, string> = {};

      for (const g of groupBy) group[g.alias] = r[g.alias] == null ? "" : String(r[g.alias]);

      return { ym: String(r.ym), group, values };
    });
}

/** Sum the per-group partials that `keep` admits into one series per item. */
export function sumPartials(
  rows: BatchRow[],
  keep: (group: Record<string, string>) => boolean = () => true,
): Map<string, Map<string, MonthPartial>> {
  const out = new Map<string, Map<string, MonthPartial>>();

  for (const r of rows) {
    if (!keep(r.group)) continue;

    for (const [key, v] of r.values) {
      let byMonth = out.get(key);

      if (!byMonth) out.set(key, (byMonth = new Map()));

      const acc = byMonth.get(r.ym);

      if (!acc) {
        byMonth.set(r.ym, { num: v.num, den: v.den });
      } else {
        acc.num += v.num;
        acc.den = acc.den == null && v.den == null ? null : (acc.den ?? 0) + (v.den ?? 0);
      }
    }
  }

  return out;
}
