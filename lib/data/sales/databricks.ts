// Databricks adapter for the Sales · Channels screen (real, read-only, aggregated
// in SQL — ADR 0002). Sources:
//   - Selectable blocks (Banda Larga + 5G): the indicator catalog (catalog-blocks.ts).
//   - PDU / Análise por Canal / Seleção Livre: desempenho_hc (+ the absent PDU view).
//
// Dates are app-generated ISO strings (safe to inline); dimension filter values
// are parameterized.

import { anchorPredicate, type ScopeAnchor, type ScopeFilter } from "../scope-sql";
import { getDataClient } from "../client";
import { num, pct } from "../_shared";
import { formatMonth } from "../../format";
import { resolvePeriod } from "./dates";
import type {
  CanalDelta,
  FreeIndicator,
  PduPoint,
  SalesFilters,
  SalesFilterOptions,
  SalesView,
} from "./types";

import { pduMonth } from "../hc-zerado/databricks";
import { parseHcFilters } from "../hc-zerado/filters";
import type { HcFilters } from "../hc-zerado/types";
import { buildSalesCatalogBlocks } from "./catalog-blocks";

const CAT = process.env.DATABRICKS_SALES_CATALOG ?? "gdb_brisanet_comunidade_dev";
const DBX = `\`${CAT}\`.\`${process.env.DATABRICKS_SALES_SCHEMA ?? "diego_barros_inteligencia_comercial_e_mercado"}\``;
const DH = `${DBX}.\`desempenho_hc\``;

/**
 * How each source identifies the person, for the data scope. Declared next to
 * the table rather than at the query, so adding a source forces the question
 * "who is the person in this table?" to be answered once, visibly.
 *
 * Always the CPF, never a hash. `vw_hierarquia.hash_cpf` is SHA-1 (40 chars)
 * and every commercial source hashes with MD5 (32) — including this one's
 * `hash_user_jwas` — so a hash join silently matches NOTHING and the screen
 * renders zeros that look like a quiet month. Only `tb_producao_hc_zero_venda`
 * shares the SHA-1 convention. Verified set/26: `CPF` matches 47.174 of 48.081
 * rows here; `hash_user_jwas` matched 0.
 */
const DH_ANCHOR: ScopeAnchor = { column: "CPF", on: "cpf" };

/** Dimension WHERE for desempenho_hc. Pushes params; returns SQL fragment. */
function dimWhereDH(
  f: SalesFilters,
  params: unknown[],
  opts: { skipCanal?: boolean; skipNicho?: boolean } = {},
): string {
  const cl: string[] = [];
  // Every `desempenho_hc` query goes through here, so the scope rides along
  // with the dimensions — there is nothing to remember at the call sites.
  const sc = anchorPredicate(f.scope, DH_ANCHOR);

  if (f.gerente) {
    cl.push("GERENTE_CANAL = ?");
    params.push(f.gerente);
  }

  if (f.canal && !opts.skipCanal) {
    cl.push("canal_waves = ?");
    params.push(f.canal);
  }

  if (f.nicho && !opts.skipNicho) {
    cl.push("nicho = ?");
    params.push(f.nicho);
  }

  if (f.uf) {
    cl.push("UF = ?");
    params.push(f.uf);
  }

  if (f.cidade) {
    cl.push("cidade_atuacao_jwas = ?");
    params.push(f.cidade);
  }

  if (f.tipo) {
    cl.push("TIPO_CIDADE = ?");
    params.push(f.tipo);
  }

  params.push(...sc.params);

  return (cl.length ? ` AND ${cl.join(" AND ")}` : "") + sc.where;
}

export async function databricksSalesWatermark(): Promise<string> {
  try {
    const r = await getDataClient().query<{ wm: string }>(`SELECT CAST(MAX(data) AS STRING) wm FROM ${DH}`);

    return r[0]?.wm ?? "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * PDU per technology, by the rule the board confirmed for HC Zerado (`pduMonth`,
 * docs/data-map.md): Σ sales of the active HC ÷ Σ `dias_trabalhado` of the active HC.
 * Each technology's line is its share of the numerator over the same days, so
 * the lines add up to the total PDU (minus renovações).
 *
 * The HC table has no channel-manager column, so Gerente does not narrow it.
 * Its `cidade_vendedor` is "CIDADE/UF" where this screen's is "CIDADE / UF".
 * Null = the source failed; the block then shows "sem acesso".
 */
async function pduSeries(f: SalesFilters): Promise<PduPoint[] | null> {
  const perfil = ["FTTH", "HIBRIDA", "ONLY"].includes(f.tipo) ? (f.tipo as HcFilters["perfilCidade"]) : "";
  const hc: HcFilters = {
    ...parseHcFilters({}),
    to: resolvePeriod(f).to,
    canal: f.canal ? [f.canal] : [],
    nicho: f.nicho ? [f.nicho] : [],
    cidade: f.cidade ? [f.cidade.replace(/\s*\/\s*/g, "/")] : [],
    uf: f.uf ? [f.uf] : [],
    perfilCidade: perfil,
    scope: f.scope,
  };

  try {
    const months = await pduMonth(hc);

    return months.map((m) => {
      const per = (v: number) => (m.diasTrabalhados > 0 ? +(v / m.diasTrabalhados).toFixed(2) : 0);

      return { mes: m.month, FTTH: per(m.ftth), FWA: per(m.fwa), "5G": per(m.chips5g) };
    });
  } catch (e) {
    console.warn("[sales] PDU indisponível:", (e as Error).message);

    return null;
  }
}

// Channel/niche momentum. The channel attribution (canal_waves) lags by ~1 month
// — the current month is often unattributed — so we anchor all windows to the
// latest date that actually has the metric under attribution (per dimension),
// not current_date(). This keeps the table meaningful regardless of the period
// filter (it's a "recent momentum" view, not period-bound).
async function canalAnalysis(
  f: SalesFilters,
  metricCol: string,
  dimCol: "canal_waves" | "nicho",
): Promise<CanalDelta[]> {
  const params: unknown[] = [];
  const dim = dimWhereDH(f, params, { skipCanal: dimCol === "canal_waves", skipNicho: dimCol === "nicho" });
  const sql = `
    WITH base AS (
      SELECT ${dimCol} dim, GERENTE_CANAL gerente, data, ${metricCol} m
      FROM ${DH}
      WHERE ${dimCol} IS NOT NULL
        AND data >= add_months(date_trunc('MM', current_date()), -4)${dim}
    ),
    anc AS (SELECT MAX(data) a FROM base WHERE m > 0)
    SELECT b.dim, MAX(b.gerente) gerente,
      SUM(CASE WHEN b.data > date_sub(anc.a, 30) THEN b.m END) cur30,
      SUM(CASE WHEN date_trunc('MM', b.data) = date_trunc('MM', anc.a) THEN b.m END) m_cur,
      SUM(CASE WHEN date_trunc('MM', b.data) = date_trunc('MM', add_months(anc.a, -1)) THEN b.m END) m_prev,
      SUM(CASE WHEN b.data > date_sub(anc.a, 7) THEN b.m END) w_cur,
      SUM(CASE WHEN b.data > date_sub(anc.a, 14) AND b.data <= date_sub(anc.a, 7) THEN b.m END) w_prev
    FROM base b CROSS JOIN anc
    GROUP BY b.dim ORDER BY cur30 DESC NULLS LAST LIMIT 15
  `;

  try {
    const rows = await getDataClient().query<Record<string, unknown>>(sql, params);

    return rows
      .filter((r) => r.dim && num(r.cur30) > 0)
      .map((r) => ({
        canal: String(r.dim),
        gerente: String(r.gerente ?? "—"),
        mediaDia: Math.round(num(r.cur30) / 30),
        vsMesAnterior: pct(num(r.m_cur), num(r.m_prev)),
        vsSemanaAnterior: pct(num(r.w_cur), num(r.w_prev)),
      }));
  } catch (e) {
    // Isolated like every other source: a failure degrades this table, not the
    // whole screen (never a mock fallback).
    console.warn(`[sales] análise por ${dimCol} indisponível:`, (e as Error).message);

    return [];
  }
}

const FREE_COL: Record<string, string> = {
  "Vendas Criadas - FTTH": "criado_ftth",
  "Vendas Criadas - FWA": "criado_fwa",
  "Vendas Criadas - Banda Larga": "criado_bl",
  "Vendas Efetivadas - FTTH": "efetivado_ftth",
  "Vendas Efetivadas - FWA": "efetivado_fwa",
  "Vendas Instaladas - FTTH": "instalado_ftth",
  "Vendas Instaladas - FWA": "instalado_fwa",
  "Vendas Ativadas - 5G": "`5g_ativacao`",
};
const FREE_LIST = [
  "Vendas Criadas - FTTH",
  "Vendas Criadas - FWA",
  "Vendas Criadas - Banda Larga",
  "Vendas Efetivadas - FTTH",
  "Vendas Efetivadas - FWA",
  "Vendas Instaladas - FTTH",
  "Vendas Instaladas - FWA",
  "Efetivados x Criados - Banda Larga",
  "Instalados x Efetivados - Banda Larga",
  "Vendas Ativadas - 5G",
  "% Portabilidade - 5G",
  "Ticket Médio Entrada - 5G",
  "Churn Safra - Banda Larga",
  "Churn Safra c/ Bloqueio - 5G",
  "Combo 1 Chip - FTTH",
  "Combo 2 Chip - FTTH",
  "Combo 3+ Chip - FTTH",
];

async function freeData(
  f: SalesFilters,
): Promise<{ indicators: FreeIndicator[]; series: Record<string, { mes: string; valor: number }[]> }> {
  const available = Object.keys(FREE_COL);
  const params: unknown[] = [];
  const sums = available.map((nome) => `SUM(${FREE_COL[nome]}) AS \`${nome}\``).join(", ");
  const sql = `
    SELECT date_format(data, 'yyyy-MM') ym, ${sums}
    FROM ${DH}
    WHERE data >= add_months(date_trunc('MM', current_date()), -11)${dimWhereDH(f, params)}
    GROUP BY 1 ORDER BY 1
  `;
  const series: Record<string, { mes: string; valor: number }[]> = {};

  for (const nome of available) series[nome] = [];

  try {
    const rows = await getDataClient().query<Record<string, unknown>>(sql, params);

    for (const r of rows) {
      const mes = formatMonth(String(r.ym));

      for (const nome of available) series[nome].push({ mes, valor: num(r[nome]) });
    }
  } catch (e) {
    // Isolated: on failure the Seleção Livre degrades to empty series (its
    // indicators drop out), never the whole screen.
    console.warn("[sales] seleção livre indisponível:", (e as Error).message);
  }

  return {
    indicators: FREE_LIST.map((nome) => ({ nome, available: !!FREE_COL[nome] })),
    series,
  };
}

export async function databricksSalesView(filters: SalesFilters): Promise<SalesView> {
  const competencia = resolvePeriod(filters).to.slice(0, 7); // yyyy-MM do mês do período
  const [blocks, pdu, canalBL, canal5G, nichoBL, nicho5G, free, watermark] = await Promise.all([
    buildSalesCatalogBlocks(filters, competencia),
    pduSeries(filters),
    canalAnalysis(filters, "criado_bl", "canal_waves"),
    canalAnalysis(filters, "`5g_ativacao`", "canal_waves"),
    canalAnalysis(filters, "criado_bl", "nicho"),
    canalAnalysis(filters, "`5g_ativacao`", "nicho"),
    freeData(filters),
    databricksSalesWatermark(),
  ]);

  return {
    filters,
    source: "databricks",
    periodLabel: resolvePeriod(filters).label,
    competencia,
    meses: [],
    blocks,
    pdu,
    canais: { canal: { bl: canalBL, g5: canal5G }, nicho: { bl: nichoBL, g5: nicho5G } },
    freeIndicators: free.indicators,
    freeSeries: free.series,
    watermark,
  };
}

export async function databricksSalesFilterOptions(scope: ScopeFilter): Promise<Partial<SalesFilterOptions>> {
  // Same scope as the data: a dropdown offering a gerência the reader cannot see
  // is a list of names they are not entitled to, and picking one returns empty.
  const sc = anchorPredicate(scope, DH_ANCHOR);

  const distinct = async (col: string): Promise<string[]> => {
    try {
      const rows = await getDataClient().query<Record<string, unknown>>(
        `SELECT DISTINCT ${col} v FROM ${DH} WHERE ${col} IS NOT NULL AND ${col} <> ''${sc.where} ORDER BY 1 LIMIT 100`,
        sc.params,
      );

      return rows.map((r) => String(r.v)).filter(Boolean);
    } catch {
      return [];
    }
  };

  const cidadesByUfQuery = async (): Promise<Record<string, string[]>> => {
    try {
      const rows = await getDataClient().query<{ uf: unknown; c: unknown }>(
        `SELECT DISTINCT UF uf, cidade_atuacao_jwas c FROM ${DH}
         WHERE UF IS NOT NULL AND cidade_atuacao_jwas IS NOT NULL AND cidade_atuacao_jwas <> ''${sc.where}
         ORDER BY 1, 2 LIMIT 3000`,
        sc.params,
      );
      const map: Record<string, string[]> = {};

      for (const r of rows) (map[String(r.uf)] ??= []).push(String(r.c));

      return map;
    } catch {
      return {};
    }
  };

  const [gerentes, canais, nichos, ufs, cidades, tipos, cidadesByUf] = await Promise.all([
    distinct("GERENTE_CANAL"),
    distinct("canal_waves"),
    distinct("nicho"),
    distinct("UF"),
    distinct("cidade_atuacao_jwas"),
    distinct("TIPO_CIDADE"),
    cidadesByUfQuery(),
  ]);

  return { gerentes, canais, nichos, ufs, cidades, tipos, cidadesByUf };
}
