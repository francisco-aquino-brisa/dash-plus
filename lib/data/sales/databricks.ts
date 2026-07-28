// Databricks adapter for the Sales · Channels screen (real, read-only, aggregated
// in SQL — ADR 0002). Sources:
//   - Selectable blocks (Banda Larga + 5G): the OFICIAL, channel-grained tables
//     named in indicators.ts (waves_consolidado_orcamento, consolidado_5g_pedido,
//     waves_churnsafra_consultor, churn_vendedor_5g) + channel metas
//     (meta_geral_canais, metas_canais_ticket_oferta). desempenho_hc is NOT used
//     for the blocks — it subconta the funnel/ativações vs the official counts the
//     metas are calibrated against (see indicators.ts).
//   - PDU / Análise por Canal / Seleção Livre: desempenho_hc (+ the absent PDU view).
//
// Indicators without a channel-grained source (churn por cidade, portabilidade 5G
// oficial) carry available:false in the catalog → "sem acesso". Dates are
// app-generated ISO strings (safe to inline); dimension filter values are
// parameterized. Each block source is isolated (failure → its cards degrade).

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

import {
  SALES_INDICATORS,
  buildSalesVM,
  type SalesBlock,
  type SalesIndicatorDef,
  type SalesIndicatorVM,
  type SalesSource,
} from "./indicators";

const CAT = process.env.DATABRICKS_SALES_CATALOG ?? "gdb_brisanet_comunidade_dev";
const DBX = `\`${CAT}\`.\`${process.env.DATABRICKS_SALES_SCHEMA ?? "diego_barros_inteligencia_comercial_e_mercado"}\``;
const VW = `\`${CAT}\`.\`projeto_brisa_performance\`.\`vw_hc_zerado_vendedor\``;
const DH = `${DBX}.\`desempenho_hc\``;

// Official, channel-grained sources for the selectable blocks (see indicators.ts
// and docs/data-map.md). All read-only; every formula validated vs the warehouse.
const ICM = `\`${CAT}\`.\`inteligencia_comercial_e_mercado\``;
const PBP = `\`${CAT}\`.\`projeto_brisa_performance\``;
const WAVES = `${ICM}.\`waves_consolidado_orcamento\``;
const CINCO_G_T = `${ICM}.\`consolidado_5g_pedido\``;
const CHURN_BL_T = `${ICM}.\`waves_churnsafra_consultor\``;
const CHURN_5G_T = `${ICM}.\`churn_vendedor_5g\``;
const META_CANAIS = `${PBP}.\`meta_geral_canais\``;
const TICKET_OFERTA = `${ICM}.\`metas_canais_ticket_oferta\``;

const q13 = "add_months(date_trunc('MM', current_date()), -11)"; // início da janela de 12 meses

// Portabilidade 5G: transacional, com várias linhas por pedido (SOLICITADO +
// PORTADO, com/sem detalhe de linha). Pré-agregamos por N_do_pedido → 1 linha por
// pedido (competência do evento mais recente; `portado` = teve alguma linha
// PORTADO), para que os valueExpr (SUM(portado), COUNT(*)) fiquem corretos.
const PORTAB_T = `(
  SELECT
    N_do_pedido AS pedido,
    date_format(MAX(to_date(data)), 'yyyy-MM') AS ym,
    MAX(CANAL_GERAL) AS canal,
    MAX(nicho) AS nicho,
    MAX(cidade_venda) AS cidade_venda,
    MAX(CASE WHEN upper(trim(STATUS)) = 'PORTADO' THEN 1 ELSE 0 END) AS portado
  FROM ${ICM}.\`portabilidade\`
  WHERE coalesce(N_do_pedido, '') <> ''
    AND coalesce(cidade_venda, '') <> ''
    AND to_date(data) >= ${q13}
  GROUP BY N_do_pedido
) p`;

/** Dimension WHERE for desempenho_hc. Pushes params; returns SQL fragment. */
function dimWhereDH(
  f: SalesFilters,
  params: unknown[],
  opts: { skipCanal?: boolean; skipNicho?: boolean } = {},
): string {
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

// ── Selectable indicator blocks (Banda Larga + 5G) ───────────────────────────
// One query per source returns, per month over the last 12, every indicator of
// that source (self-contained `valueExpr` from the catalog). Each source applies
// only the filter dimensions it actually carries — the ones it lacks are ignored
// for its cards (documented per source below). Sources are isolated: a failure
// drops its indicators to "sem acesso" for that render, never the whole screen.

interface SourceSpec {
  table: string;
  /** Source-level WHERE (besides the 12-month window); '' when none. */
  scope: string;
  /** Expression yielding the month key (yyyy-MM). */
  monthExpr: string;
  /** 12-month window predicate. */
  window: string;
  /** filter key → SQL column/expression it maps to on this source. */
  dims: Partial<Record<keyof SalesFilters, string>>;
}

const INC_MONTH = "date_format(to_date(incremento, 'dd-MM-yyyy'), 'yyyy-MM')";
const INC_WINDOW = `to_date(incremento, 'dd-MM-yyyy') >= ${q13}`;

const BLOCK_SOURCES: Record<SalesSource, SourceSpec> = {
  // waves cobre TODOS os filtros (canal/gerente/nicho/tipo/cidade/uf).
  waves: {
    table: WAVES,
    scope: "corporativo = 'NAO'", // servico é acrescido dinamicamente (INTERNET/FWA + filtro)
    monthExpr: INC_MONTH,
    window: INC_WINDOW,
    dims: {
      canal: "CANAL_GERAL",
      gerente: "GERENTE_CANAIS",
      nicho: "nicho",
      tipo: "TIPO_CIDADE",
      cidade: "cidade_venda",
      uf: "TRIM(RIGHT(cidade_venda, 2))",
    },
  },
  // churn_bl: só canal/gerente/nicho (não tem tipo/cidade/uf confiáveis).
  churn_bl: {
    table: CHURN_BL_T,
    scope: "servico IN ('INTERNET', 'FWA')",
    monthExpr: INC_MONTH,
    window: INC_WINDOW,
    dims: { canal: "canal_geral", gerente: "gerente_canais", nicho: "nicho" },
  },
  // cinco_g: canal_de_vendas é CÓDIGO (10/55/A1…) — incompatível com o dropdown;
  // ignoramos canal/gerente/tipo, escopamos por nicho/cidade/uf.
  cinco_g: {
    table: CINCO_G_T,
    scope: "",
    monthExpr: INC_MONTH,
    window: INC_WINDOW,
    dims: { nicho: "nicho", cidade: "cidade_venda", uf: "TRIM(RIGHT(cidade_venda, 2))" },
  },
  // churn_5g: só gerente casa com o dropdown; canal tem vocabulário próprio.
  churn_5g: {
    table: CHURN_5G_T,
    scope: "",
    monthExpr: "date_format(data_churn, 'yyyy-MM')",
    window: `data_churn >= ${q13}`,
    dims: { gerente: "GERENTE" },
  },
  // portab: derivada, já pré-agregada por pedido (janela aplicada dentro). Sem
  // gerente/tipo na fonte; canal (CANAL_GERAL) e nicho seguem o vocabulário waves.
  portab: {
    table: PORTAB_T,
    scope: "",
    monthExpr: "ym",
    window: "ym IS NOT NULL",
    dims: { canal: "canal", nicho: "nicho", cidade: "cidade_venda", uf: "TRIM(RIGHT(cidade_venda, 2))" },
  },
};

/** waves servico scope from the filter (BL = INTERNET + FWA). */
function wavesServico(f: SalesFilters): string {
  if (f.servico === "INTERNET") return "servico = 'INTERNET'";

  if (f.servico === "FWA") return "servico = 'FWA'";

  return "servico IN ('INTERNET', 'FWA')";
}

/** Run one source: Map<indicatorId, Map<yyyy-MM, value>>, or null on failure. */
async function sourceMonthly(
  source: SalesSource,
  defs: SalesIndicatorDef[],
  filters: SalesFilters,
): Promise<Map<string, Map<string, number>> | null> {
  const spec = BLOCK_SOURCES[source];
  const params: unknown[] = [];
  const where = [spec.window];

  if (spec.scope) where.push(spec.scope);

  if (source === "waves") where.push(wavesServico(filters));

  for (const [key, col] of Object.entries(spec.dims)) {
    const v = filters[key as keyof SalesFilters];

    if (v) (where.push(`${col} = ?`), params.push(v));
  }

  const cols = defs.map((d) => `${d.valueExpr} AS \`${d.id}\``).join(", ");
  const sql = `SELECT ${spec.monthExpr} ym, ${cols} FROM ${spec.table} WHERE ${where.join(" AND ")} GROUP BY 1 ORDER BY 1`;

  try {
    const rows = await getDataClient().query<Record<string, unknown>>(sql, params);
    const out = new Map<string, Map<string, number>>();

    for (const d of defs) out.set(d.id, new Map());

    for (const r of rows) {
      const ym = String(r.ym);

      for (const d of defs) out.get(d.id)!.set(ym, num(r[d.id]));
    }

    return out;
  } catch (e) {
    console.warn(`[sales] bloco: fonte indisponível (${spec.table}):`, (e as Error).message);

    return null;
  }
}

/** Funnel metas from meta_geral_canais: Map<indicador, Map<yyyy-MM, meta>>. */
async function funnelMetas(
  filters: SalesFilters,
  block: SalesBlock,
): Promise<Map<string, Map<string, number>>> {
  const out = new Map<string, Map<string, number>>();

  try {
    const servicos = block === "banda-larga" ? ["FTTH", "FWA"] : ["5G"];
    const params: unknown[] = [...servicos];
    const where = [
      `date_format(data, 'yyyy-MM') >= date_format(${q13}, 'yyyy-MM')`,
      `servico IN (${servicos.map(() => "?").join(", ")})`,
    ];

    if (filters.canal) (where.push("canal = ?"), params.push(filters.canal));

    if (filters.gerente) (where.push("gerente = ?"), params.push(filters.gerente));

    const sql = `SELECT date_format(data, 'yyyy-MM') ym, id_indicador, SUM(meta) meta FROM ${META_CANAIS} WHERE ${where.join(" AND ")} GROUP BY 1, 2`;
    const rows = await getDataClient().query<Record<string, unknown>>(sql, params);

    for (const r of rows) {
      const ind = String(r.id_indicador);

      if (!out.has(ind)) out.set(ind, new Map());

      out.get(ind)!.set(String(r.ym), num(r.meta));
    }
  } catch (e) {
    console.warn("[sales] metas de funil indisponíveis:", (e as Error).message);
  }

  return out;
}

/** Ticket-oferta metas (tipo GERAL) from metas_canais_ticket_oferta. */
async function ticketOfertaMetas(block: SalesBlock): Promise<Map<string, number>> {
  const out = new Map<string, number>();

  try {
    const servico = block === "banda-larga" ? "BANDA LARGA" : "5G";
    const sql = `SELECT date_format(data, 'yyyy-MM') ym, AVG(meta) meta FROM ${TICKET_OFERTA}
      WHERE indicador = 'TICKET OFERTA' AND tipo = 'GERAL' AND servico = ?
        AND date_format(data, 'yyyy-MM') >= date_format(${q13}, 'yyyy-MM') GROUP BY 1`;
    const rows = await getDataClient().query<Record<string, unknown>>(sql, [servico]);

    for (const r of rows) out.set(String(r.ym), num(r.meta));
  } catch (e) {
    console.warn("[sales] metas de ticket oferta indisponíveis:", (e as Error).message);
  }

  return out;
}

async function computeBlock(
  block: SalesBlock,
  filters: SalesFilters,
  competencia: string,
): Promise<SalesIndicatorVM[]> {
  const defs = SALES_INDICATORS[block];
  const bySource = new Map<SalesSource, SalesIndicatorDef[]>();

  for (const d of defs) {
    if (d.available && d.source) {
      if (!bySource.has(d.source)) bySource.set(d.source, []);

      bySource.get(d.source)!.push(d);
    }
  }

  const sources = [...bySource.keys()];
  const [results, funnel, ticket] = await Promise.all([
    Promise.all(sources.map((s) => sourceMonthly(s, bySource.get(s)!, filters))),
    funnelMetas(filters, block),
    ticketOfertaMetas(block),
  ]);
  const resBySource = new Map<SalesSource, Map<string, Map<string, number>> | null>();

  sources.forEach((s, i) => resBySource.set(s, results[i]));

  const empty = new Map<string, number>();

  // VE34 (5G) é cross-source: concluídas (portab VE32) ÷ ativações 5G (cinco_g VE04).
  const portConcl = resBySource.get("portab")?.get("VE32");
  const ativ5g = resBySource.get("cinco_g")?.get("VE04");
  const ve34Ok = !!portConcl && !!ativ5g;
  const ve34Real = new Map<string, number>();

  if (portConcl && ativ5g) {
    for (const [ym, c] of portConcl) {
      const a = ativ5g.get(ym) ?? 0;

      ve34Real.set(ym, a > 0 ? +((c / a) * 100).toFixed(1) : 0);
    }
  }

  return defs.map((d) => {
    if (d.id === "VE34" && d.block === "5g") {
      return buildSalesVM(ve34Ok ? d : { ...d, available: false }, ve34Real, empty, competencia);
    }

    if (!d.available || !d.source) return buildSalesVM(d, empty, empty, competencia);

    const res = resBySource.get(d.source);

    // Fonte falhou → degrada este card para "sem acesso" neste render.
    if (!res) return buildSalesVM({ ...d, available: false }, empty, empty, competencia);

    const real = res.get(d.id) ?? empty;
    const meta =
      d.meta?.kind === "funnel"
        ? (funnel.get(d.meta.indicador) ?? empty)
        : d.meta?.kind === "ticketOferta"
          ? ticket
          : empty;

    return buildSalesVM(d, real, meta, competencia);
  });
}

export async function databricksSalesView(filters: SalesFilters): Promise<SalesView> {
  const competencia = resolvePeriod(filters).to.slice(0, 7); // yyyy-MM do mês do período
  const [blocksBL, blocks5G, pdu, canalBL, canal5G, nichoBL, nicho5G, free, watermark] = await Promise.all([
    computeBlock("banda-larga", filters, competencia),
    computeBlock("5g", filters, competencia),
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
    meses: pdu.map((p) => p.mes),
    blocksBL,
    blocks5G,
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
