// The HC Zerado source table and the SQL fragments every screen in the module
// derives from. Read-only: period dates are laundered through `safeIsoDate`
// before being inlined as DATE literals and every dimension value is bound as
// an ordinal `?` parameter.

import { getDataClient } from "../client";

/**
 * Part of the cache key. Constant in production (ADR 0002 unchanged); in dev it
 * is re-evaluated on every recompile, so editing an aggregation invalidates what
 * the previous version of it cached without needing a manual version bump.
 */
export const HC_ADAPTER_BUILD = process.env.NODE_ENV === "production" ? "prod" : String(Date.now());

const CAT = process.env.DATABRICKS_CITIES_CATALOG ?? "gdb_brisanet_comunidade_dev";
const SCHEMA = process.env.DATABRICKS_HC_SCHEMA ?? "projeto_brisa_performance";

/**
 * The materialized table, NOT `vw_producao_hc_zero_venda`. The view rebuilds a
 * long CTE chain (waves + 5G + renovação FULL OUTER JOINed against the payroll
 * snapshot) on every read — the same one-month aggregate takes ~8s through the
 * view and ~0s through the table. Same 44 columns, same totals; the table trails
 * the view by a refresh cycle.
 */
export const SOURCE = `\`${CAT}\`.\`${SCHEMA}\`.\`${process.env.DATABRICKS_HC_TABLE ?? "tb_producao_hc_zero_venda"}\``;

/**
 * The module's two app-owned tables — the only ones it writes (ADR 0005, and
 * [[app-crud-write-path-allowed]]): the justifications themselves and the single
 * row that defines what counts as a sale when deciding "zerado". They live
 * alongside the `tb_*` identity tables, not under `DATABRICKS_HC_SCHEMA`, because
 * the justification join reaches `tb_usuarios` for the author's name.
 */
const APP_SCHEMA = process.env.DATABRICKS_CITIES_SCHEMA ?? "projeto_brisa_performance";

export const JUSTIFICATIVAS = `\`${CAT}\`.\`${APP_SCHEMA}\`.\`justificativas_hc_zerado\``;
export const REGRAS = `\`${CAT}\`.\`${APP_SCHEMA}\`.\`regras_justificativa_hc\``;

/**
 * Stable identity of one HC. `documento_hc` is the source's own key; the
 * matrícula fallback covers the rows where it is blank. When neither exists the
 * key is NULL and the row drops out of the DISTINCT counts instead of collapsing
 * every anonymous row into a single fake person — the original used two
 * different fallback prefixes (`CPF-` / `MAT-`) in different blocks, which meant
 * the same person could be counted twice across blocks.
 */
export const HC_KEY = `CASE
  WHEN documento_hc IS NOT NULL AND TRIM(documento_hc) <> '' THEN TRIM(documento_hc)
  WHEN matricula IS NOT NULL THEN CONCAT('MAT-', CAST(matricula AS STRING))
END`;

/** The original accepted three spellings of "active". */
export const ATIVO = `CASE WHEN UPPER(TRIM(situacao)) IN ('ATIVO','ATIVOS','ACTIVE') THEN 1 ELSE 0 END`;

/**
 * The seller's city, as a group label.
 *
 * `cidade_vendedor` is stored as `CIDADE/UF` and a slice of the rows lost the
 * city half — `/CE`, `//GO`, `/`. Those are not cities and must not become
 * groups of their own; anything that starts with a slash, or is blank, is
 * unknown. Fewer than ten people in a twelve-month window, but each one used to
 * open its own row.
 */
export const CIDADE = `CASE
  WHEN TRIM(cidade_vendedor) <> '' AND TRIM(cidade_vendedor) NOT LIKE '/%'
  THEN TRIM(cidade_vendedor) ELSE 'Sem Cidade'
END`;

export const FERIADO = `CASE WHEN UPPER(TRIM(flag_feriado)) LIKE 'SIM%' THEN 1 ELSE 0 END`;

export const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function q<T>(sql: string, params: unknown[]): Promise<T[]> {
  return getDataClient().query<T>(sql, params);
}

// Asked for once per screen per render for a source that only advances hourly.
const WM_TTL_MS = 60_000;
const gWm = globalThis as unknown as { __hcWatermark?: { value: string; at: number } };

export async function databricksHcWatermark(): Promise<string> {
  const memo = gWm.__hcWatermark;

  if (memo && Date.now() - memo.at < WM_TTL_MS) return memo.value;

  try {
    const r = await q<{ wm: string }>(`SELECT CAST(MAX(data) AS STRING) wm FROM ${SOURCE}`, []);
    const value = r[0]?.wm ?? "unknown";

    gWm.__hcWatermark = { value, at: Date.now() };

    return value;
  } catch {
    return "unknown";
  }
}
