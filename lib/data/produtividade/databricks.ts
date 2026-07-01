// Databricks adapter for the Commercial Productivity screen (Tela 2). Read-only,
// aggregated in SQL (ADR 0002). Sources:
//   - desempenho_hc        → funnel + 5G per vendedor, hierarchy, cidade
//   - vw_hc_zerado_vendedor → official PDU by technology
// Blocked (no accessible source): Ticket Médio, Churn Safra, plano mix, and the
// TAM-by-meta quintiles → available:false / tamAvailable:false.
//
// Period dates are app-generated ISO (safe to inline); dimension filters are
// parameterized (`?`).

import { getDataClient } from "../client";
import { FUNNEL_COLS, blocked, num, pct, ratio } from "../_shared";
import { formatMonth } from "../../format";
import { resolveProdPeriod } from "./dates";
import type { KpiBlock, PduPoint, ProdFilters, ProdFilterOptions, ProdView, VendedorRow } from "./types";

const CAT = process.env.DATABRICKS_SALES_CATALOG ?? "gdb_brisanet_comunidade_dev";
const DBX = `\`${CAT}\`.\`${process.env.DATABRICKS_SALES_SCHEMA ?? "diego_barros_inteligencia_comercial_e_mercado"}\``;
const DH = `${DBX}.\`desempenho_hc\``;
const VW = `\`${CAT}\`.\`projeto_brisa_performance\`.\`vw_hc_zerado_vendedor\``;

/** Mode-aware dimension WHERE for desempenho_hc. */
function whereDH(f: ProdFilters, params: unknown[]): string {
  const cl: string[] = [];
  if (f.mode === "externas") {
    if (f.gerencia) (cl.push("GERENCIA = ?"), params.push(f.gerencia));
    if (f.coordenacao) (cl.push("COORDENACAO = ?"), params.push(f.coordenacao));
  } else {
    if (f.gerente) (cl.push("GERENTE_CANAL = ?"), params.push(f.gerente));
    if (f.nicho) (cl.push("nicho = ?"), params.push(f.nicho));
  }
  if (f.cidade) (cl.push("cidade_atuacao_jwas = ?"), params.push(f.cidade));
  return cl.length ? ` AND ${cl.join(" AND ")}` : "";
}

/** Mode-aware dimension WHERE for vw_hc_zerado_vendedor (PDU). */
function whereVW(f: ProdFilters, params: unknown[]): string {
  const cl: string[] = [];
  if (f.mode === "externas") {
    if (f.gerencia) (cl.push("gerencia_cidade = ?"), params.push(f.gerencia));
    if (f.coordenacao) (cl.push("coordenacao = ?"), params.push(f.coordenacao));
  } else {
    if (f.gerente) (cl.push("gerente_cidade = ?"), params.push(f.gerente));
    if (f.nicho) (cl.push("nicho = ?"), params.push(f.nicho));
  }
  if (f.cidade) (cl.push("cidade_atuacao = ?"), params.push(f.cidade));
  return cl.length ? ` AND ${cl.join(" AND ")}` : "";
}

export async function databricksProdWatermark(): Promise<string> {
  try {
    const r = await getDataClient().query<{ wm: string }>(`SELECT CAST(MAX(data) AS STRING) wm FROM ${DH}`);
    return r[0]?.wm ?? "unknown";
  } catch {
    return "unknown";
  }
}

async function indicadores(f: ProdFilters): Promise<KpiBlock[]> {
  const p = resolveProdPeriod(f);
  const scope = f.servico === "INTERNET" ? "INTERNET" : f.servico === "FWA" ? "FWA" : "BL";
  const [cC, cE, cI] = FUNNEL_COLS[scope];
  const tag = scope === "BL" ? "Banda Larga (INTERNET + FWA)" : scope;

  const params: unknown[] = [];
  const win = (col: string, from: string, to: string) =>
    `SUM(CASE WHEN data BETWEEN DATE'${from}' AND DATE'${to}' THEN ${col} END)`;
  const sql = `
    SELECT
      ${win(cC, p.from, p.to)} cur_c, ${win(cC, p.prevFrom, p.prevTo)} prev_c,
      ${win(cE, p.from, p.to)} cur_e, ${win(cE, p.prevFrom, p.prevTo)} prev_e,
      ${win(cI, p.from, p.to)} cur_i, ${win(cI, p.prevFrom, p.prevTo)} prev_i,
      ${win("`5g_ativacao`", p.from, p.to)} cur_g, ${win("`5g_ativacao`", p.prevFrom, p.prevTo)} prev_g
    FROM ${DH}
    WHERE data BETWEEN DATE'${p.prevFrom}' AND DATE'${p.to}'${whereDH(f, params)}
  `;
  const r = (await getDataClient().query<Record<string, unknown>>(sql, params))[0] ?? {};
  const cri = num(r.cur_c), efe = num(r.cur_e), ins = num(r.cur_i), g5 = num(r.cur_g);

  return [
    { label: "Vendas Criadas", value: cri, meta: 0, delta: pct(cri, num(r.prev_c)), available: true, helper: tag },
    { label: "Vendas Efetivadas", value: efe, meta: 0, delta: pct(efe, num(r.prev_e)), available: true, helper: `Efetivados x Criados: ${ratio(efe, cri).toFixed(1).replace(".", ",")}%` },
    { label: "Vendas Instaladas", value: ins, meta: 0, delta: pct(ins, num(r.prev_i)), available: true, helper: `Instalados x Efetivados: ${ratio(ins, efe).toFixed(1).replace(".", ",")}%` },
    { label: "Vendas Ativadas 5G", value: g5, meta: 0, delta: pct(g5, num(r.prev_g)), available: true, helper: "Chip pago/grátis: sem acesso" },
    blocked("Ticket Médio Entrada"),
    blocked("Ticket Médio Entrada 5G"),
    blocked("Churn Safra"),
  ];
}

async function ranking(f: ProdFilters): Promise<VendedorRow[]> {
  const p = resolveProdPeriod(f);
  const grupoCol = f.mode === "canais" ? "nicho" : "COORDENACAO";
  const params: unknown[] = [];
  const sql = `
    SELECT MAX(NOME) nome, MAX(${grupoCol}) grupo, MAX(cidade_atuacao_jwas) cidade,
      SUM(criado_bl) criado, SUM(efetivado_bl) efetivado, SUM(instalado_bl) instalado, SUM(\`5g_ativacao\`) ativ5g
    FROM ${DH}
    WHERE data BETWEEN DATE'${p.from}' AND DATE'${p.to}' AND NOME IS NOT NULL${whereDH(f, params)}
    GROUP BY MATRICULA
    HAVING SUM(criado_bl) + SUM(efetivado_bl) + SUM(instalado_bl) + SUM(\`5g_ativacao\`) > 0
    ORDER BY efetivado DESC NULLS LAST LIMIT 15
  `;
  const rows = await getDataClient().query<Record<string, unknown>>(sql, params);
  return rows.map((r) => {
    const criado = num(r.criado), efetivado = num(r.efetivado), instalado = num(r.instalado);
    return {
      nome: String(r.nome ?? "—"),
      grupo: String(r.grupo ?? "—"),
      cidade: String(r.cidade ?? "—"),
      criado,
      efetivado,
      instalado,
      ativ5g: num(r.ativ5g),
      efetVsCriado: ratio(efetivado, criado),
      instVsEfet: ratio(instalado, efetivado),
    };
  });
}

async function pduSeries(f: ProdFilters): Promise<PduPoint[]> {
  const params: unknown[] = [];
  const sql = `
    SELECT date_format(data, 'yyyy-MM') ym, servico,
      SUM(total_realizado)
        / NULLIF(COUNT(DISTINCT CASE WHEN situacao_hc = 'ATIVO' THEN matricula END), 0)
        / NULLIF(MAX(dias_uteis_acumulado), 0) AS pdu
    FROM ${VW}
    WHERE servico IN ('FTTH', 'FWA', '5G')
      AND data >= add_months(date_trunc('MM', current_date()), -11)${whereVW(f, params)}
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
}

export async function databricksProdView(filters: ProdFilters): Promise<ProdView> {
  const [inds, rank, pdu, watermark] = await Promise.all([
    indicadores(filters),
    ranking(filters),
    pduSeries(filters),
    databricksProdWatermark(),
  ]);
  return {
    source: "databricks",
    filters,
    periodLabel: resolveProdPeriod(filters).label,
    indicadores: inds,
    ranking: rank,
    pdu,
    tamAvailable: false, // TAM-by-meta needs a per-vendedor meta we cannot access yet
    watermark,
  };
}

export async function databricksProdFilterOptions(): Promise<Partial<ProdFilterOptions>> {
  const distinct = async (col: string): Promise<string[]> => {
    try {
      const rows = await getDataClient().query<Record<string, unknown>>(
        `SELECT DISTINCT ${col} v FROM ${DH} WHERE ${col} IS NOT NULL AND ${col} <> '' ORDER BY 1 LIMIT 200`,
      );
      return rows.map((r) => String(r.v)).filter(Boolean);
    } catch {
      return [];
    }
  };
  const [gerencias, coordenacoes, gerentes, nichos, cidades] = await Promise.all([
    distinct("GERENCIA"),
    distinct("COORDENACAO"),
    distinct("GERENTE_CANAL"),
    distinct("nicho"),
    distinct("cidade_atuacao_jwas"),
  ]);
  return { gerencias, coordenacoes, gerentes, nichos, cidades };
}
