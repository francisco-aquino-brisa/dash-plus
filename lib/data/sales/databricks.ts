// Databricks adapter for the Sales · Channels screen (real, read-only, aggregated
// in SQL — ADR 0002). Sources (all accessible):
//   - desempenho_hc        → funnel per vendedor/day (criado/efetivado/instalado
//                            per service + 5g_ativacao) + canal/nicho/hierarchy
//   - vw_hc_zerado_vendedor → official PDU (total_realizado / hc_ativos / dias úteis)
//
// Blocked/unavailable (official current source denied): Ticket de Entrada,
// Churn Safra, % Portabilidade, Churn Safra 5G c/ bloqueio, chip pago/grátis
// → rendered as "sem acesso" (see docs/pending-data-checklist.md).
//
// Dates are app-generated ISO strings (safe to inline); dimension filter values
// are parameterized.

import { getDataClient } from "../client";
import { FUNNEL_COLS, blocked, num, pct } from "../_shared";
import { formatMonth } from "../../format";
import { resolvePeriod } from "./dates";
import type { CanalDelta, FreeIndicator, KpiBlock, PduPoint, SalesFilters, SalesFilterOptions, SalesView } from "./types";

const CAT = process.env.DATABRICKS_SALES_CATALOG ?? "gdb_brisanet_comunidade_dev";
const DBX = `\`${CAT}\`.\`${process.env.DATABRICKS_SALES_SCHEMA ?? "diego_barros_inteligencia_comercial_e_mercado"}\``;
const VW = `\`${CAT}\`.\`projeto_brisa_performance\`.\`vw_hc_zerado_vendedor\``;
const DH = `${DBX}.\`desempenho_hc\``;

/** Dimension WHERE for desempenho_hc. Pushes params; returns SQL fragment. */
function dimWhereDH(f: SalesFilters, params: unknown[], opts: { skipCanal?: boolean; skipNicho?: boolean } = {}): string {
  const cl: string[] = [];
  if (f.gerente) (cl.push("GERENTE_CANAL = ?"), params.push(f.gerente));
  if (f.canal && !opts.skipCanal) (cl.push("canal_waves = ?"), params.push(f.canal));
  if (f.nicho && !opts.skipNicho) (cl.push("nicho = ?"), params.push(f.nicho));
  if (f.uf) (cl.push("UF = ?"), params.push(f.uf));
  if (f.cidade) (cl.push("cidade_atuacao_jwas = ?"), params.push(f.cidade));
  if (f.tipo) (cl.push("TIPO_CIDADE = ?"), params.push(f.tipo));
  return cl.length ? ` AND ${cl.join(" AND ")}` : "";
}

export async function databricksSalesWatermark(): Promise<string> {
  try {
    const r = await getDataClient().query<{ wm: string }>(`SELECT CAST(MAX(data) AS STRING) wm FROM ${DH}`);
    return r[0]?.wm ?? "unknown";
  } catch {
    return "unknown";
  }
}

async function funnelKpis(f: SalesFilters): Promise<{ bl: KpiBlock[]; g5: KpiBlock[] }> {
  const p = resolvePeriod(f);
  const scope = f.servico === "INTERNET" ? "INTERNET" : f.servico === "FWA" ? "FWA" : "BL";
  const [cC, cE, cI] = FUNNEL_COLS[scope];
  const tag = scope === "BL" ? "Banda Larga (INTERNET + FWA)" : scope;

  const params: unknown[] = [];
  const win = (col: string, from: string, to: string) => `SUM(CASE WHEN data BETWEEN DATE'${from}' AND DATE'${to}' THEN ${col} END)`;
  const sql = `
    SELECT
      ${win(cC, p.from, p.to)} cur_c, ${win(cC, p.prevFrom, p.prevTo)} prev_c,
      ${win(cE, p.from, p.to)} cur_e, ${win(cE, p.prevFrom, p.prevTo)} prev_e,
      ${win(cI, p.from, p.to)} cur_i, ${win(cI, p.prevFrom, p.prevTo)} prev_i,
      ${win("`5g_ativacao`", p.from, p.to)} cur_g, ${win("`5g_ativacao`", p.prevFrom, p.prevTo)} prev_g
    FROM ${DH}
    WHERE data BETWEEN DATE'${p.prevFrom}' AND DATE'${p.to}'${dimWhereDH(f, params)}
  `;
  const r = (await getDataClient().query<Record<string, unknown>>(sql, params))[0] ?? {};
  const cri = num(r.cur_c), efe = num(r.cur_e), ins = num(r.cur_i), g5 = num(r.cur_g);
  const efetXCri = cri ? ((efe / cri) * 100).toFixed(1).replace(".", ",") : "0";
  const instXEfe = efe ? ((ins / efe) * 100).toFixed(1).replace(".", ",") : "0";

  return {
    bl: [
      { label: "Vendas Criadas", value: cri, meta: 0, delta: pct(cri, num(r.prev_c)), available: true, helper: tag },
      { label: "Vendas Efetivadas", value: efe, meta: 0, delta: pct(efe, num(r.prev_e)), available: true, helper: `Efetivados x Criados: ${efetXCri}%` },
      { label: "Vendas Instaladas", value: ins, meta: 0, delta: pct(ins, num(r.prev_i)), available: true, helper: `Instalados x Efetivados: ${instXEfe}%` },
      blocked("Ticket de Entrada"),
      blocked("Churn Safra"),
    ],
    g5: [
      { label: "Vendas Ativadas 5G", value: g5, meta: 0, delta: pct(g5, num(r.prev_g)), available: true, helper: "Chip pago/grátis: sem acesso" },
      blocked("% Portabilidade (Concluída x Ativ.)"),
      blocked("% Portabilidade (Concluída x Solic.)"),
      blocked("Ticket Médio Entrada 5G"),
      blocked("Churn Safra 5G c/ Bloqueio"),
    ],
  };
}

/**
 * Official PDU = total_realizado / HC ativo / dias úteis, by tecnologia, by month.
 * The PDU source (vw_hc_zerado_vendedor) is currently absent from the warehouse,
 * so this is isolated: on any error it returns an empty series (PDU shows as
 * unavailable) instead of taking the whole screen down. NOT a mock fallback —
 * the rest of the screen still serves real data. See docs/data-map.md.
 */
async function pduSeries(f: SalesFilters): Promise<PduPoint[]> {
  try {
    const params: unknown[] = [];
    const cl: string[] = [];
    if (f.gerente) (cl.push("gerente_cidade = ?"), params.push(f.gerente));
    if (f.canal) (cl.push("canal = ?"), params.push(f.canal));
    if (f.nicho) (cl.push("nicho = ?"), params.push(f.nicho));
    if (f.uf) (cl.push("UF = ?"), params.push(f.uf));
    if (f.cidade) (cl.push("cidade_atuacao = ?"), params.push(f.cidade));
    if (f.tipo) (cl.push("tipo_cidade = ?"), params.push(f.tipo));
    const dim = cl.length ? ` AND ${cl.join(" AND ")}` : "";

    const sql = `
      SELECT date_format(data, 'yyyy-MM') ym, servico,
        SUM(total_realizado)
          / NULLIF(COUNT(DISTINCT CASE WHEN situacao_hc = 'ATIVO' THEN matricula END), 0)
          / NULLIF(MAX(dias_uteis_acumulado), 0) AS pdu
      FROM ${VW}
      WHERE servico IN ('FTTH', 'FWA', '5G')
        AND data >= add_months(date_trunc('MM', current_date()), -11)${dim}
      GROUP BY 1, 2 ORDER BY 1
    `;
    const rows = await getDataClient().query<Record<string, unknown>>(sql, params);
    const byMonth = new Map<string, PduPoint>();
    for (const r of rows) {
      const ym = String(r.ym);
      if (!byMonth.has(ym)) byMonth.set(ym, { mes: formatMonth(ym), FTTH: 0, FWA: 0, "5G": 0 });
      const point = byMonth.get(ym)!;
      const svc = String(r.servico);
      const val = +num(r.pdu).toFixed(2);
      if (svc === "FTTH") point.FTTH = val;
      else if (svc === "FWA") point.FWA = val;
      else if (svc === "5G") point["5G"] = val;
    }
    return Array.from(byMonth.values());
  } catch (e) {
    console.warn("[sales] PDU indisponível (fonte ausente no Databricks):", (e as Error).message);
    return [];
  }
}

// Channel/niche momentum. The channel attribution (canal_waves) lags by ~1 month
// — the current month is often unattributed — so we anchor all windows to the
// latest date that actually has the metric under attribution (per dimension),
// not current_date(). This keeps the table meaningful regardless of the period
// filter (it's a "recent momentum" view, not period-bound).
async function canalAnalysis(f: SalesFilters, metricCol: string, dimCol: "canal_waves" | "nicho"): Promise<CanalDelta[]> {
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
  "Vendas Criadas - FTTH", "Vendas Criadas - FWA", "Vendas Criadas - Banda Larga",
  "Vendas Efetivadas - FTTH", "Vendas Efetivadas - FWA",
  "Vendas Instaladas - FTTH", "Vendas Instaladas - FWA",
  "Efetivados x Criados - Banda Larga", "Instalados x Efetivados - Banda Larga",
  "Vendas Ativadas - 5G", "% Portabilidade - 5G", "Ticket Médio Entrada - 5G",
  "Churn Safra - Banda Larga", "Churn Safra c/ Bloqueio - 5G",
  "Combo 1 Chip - FTTH", "Combo 2 Chip - FTTH", "Combo 3+ Chip - FTTH",
];

async function freeData(f: SalesFilters): Promise<{ indicators: FreeIndicator[]; series: Record<string, { mes: string; valor: number }[]> }> {
  const available = Object.keys(FREE_COL);
  const params: unknown[] = [];
  const sums = available.map((nome) => `SUM(${FREE_COL[nome]}) AS \`${nome}\``).join(", ");
  const sql = `
    SELECT date_format(data, 'yyyy-MM') ym, ${sums}
    FROM ${DH}
    WHERE data >= add_months(date_trunc('MM', current_date()), -11)${dimWhereDH(f, params)}
    GROUP BY 1 ORDER BY 1
  `;
  const rows = await getDataClient().query<Record<string, unknown>>(sql, params);
  const series: Record<string, { mes: string; valor: number }[]> = {};
  for (const nome of available) series[nome] = [];
  for (const r of rows) {
    const mes = formatMonth(String(r.ym));
    for (const nome of available) series[nome].push({ mes, valor: num(r[nome]) });
  }
  return {
    indicators: FREE_LIST.map((nome) => ({ nome, available: !!FREE_COL[nome] })),
    series,
  };
}

export async function databricksSalesView(filters: SalesFilters): Promise<SalesView> {
  const [{ bl, g5 }, pdu, canalBL, canal5G, nichoBL, nicho5G, free, watermark] = await Promise.all([
    funnelKpis(filters),
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
    meses: pdu.map((p) => p.mes),
    kpisBL: bl,
    kpis5G: g5,
    pdu,
    canais: { canal: { bl: canalBL, g5: canal5G }, nicho: { bl: nichoBL, g5: nicho5G } },
    freeIndicators: free.indicators,
    freeSeries: free.series,
    watermark,
  };
}

export async function databricksSalesFilterOptions(): Promise<Partial<SalesFilterOptions>> {
  const distinct = async (col: string): Promise<string[]> => {
    try {
      const rows = await getDataClient().query<Record<string, unknown>>(
        `SELECT DISTINCT ${col} v FROM ${DH} WHERE ${col} IS NOT NULL AND ${col} <> '' ORDER BY 1 LIMIT 100`,
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
         WHERE UF IS NOT NULL AND cidade_atuacao_jwas IS NOT NULL AND cidade_atuacao_jwas <> ''
         ORDER BY 1, 2 LIMIT 3000`,
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
