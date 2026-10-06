import "server-only";

import { DatabricksDataClient } from "@/lib/data/databricks";
import { SOURCE_META, type PreviewFilters, type PreviewResult } from "./sources";
import type { CalcSpec } from "./spec";
import { buildGrupo, measureAgg, sourceTable, tsExpr, ymExpr } from "./sql";
import { specValue, type MonthPartial } from "./values";

export type { PreviewFilters, PreviewResult };

/**
 * Admin preview: runs one spec over its source and returns the value per
 * competência. It applies the spec's own aggregation/filters only, so it shows
 * how the indicator behaves — the screens use the batch engine (batch.ts).
 */
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
  const specCond = buildGrupo(spec.filtros, params, cols);

  if (specCond) where.push(specCond);

  const sql = `SELECT ${ymExpr(meta.competencia)} AS ym, ${numSql} AS num, ${denSql} AS den
       FROM ${sourceTable(spec.fonte)}
      WHERE ${where.join(" AND ")}
      GROUP BY 1
      ORDER BY 1`;

  const rows = await new DatabricksDataClient().query<{ ym: unknown; num: unknown; den: unknown }>(
    sql,
    params,
  );
  const data = new Map<string, MonthPartial>();

  for (const r of rows) {
    const ym = String(r.ym ?? "");

    if (!ym || ym === "null") continue;

    data.set(ym, { num: r.num == null ? 0 : Number(r.num), den: r.den == null ? null : Number(r.den) });
  }

  const meses = [...data.keys()];
  // Respect an explicit pick (may have no data → value "—"); otherwise latest month.
  const target = pf.competencia ?? meses[meses.length - 1] ?? null;
  const valor = target ? specValue(spec, (m) => data.get(m), target) : null;

  return { valor, competencia: target, meses };
}
