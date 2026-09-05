// Databricks-backed Cities dataset. Active when DATA_SOURCE=databricks.
//
// Mapped to the REAL schema verified against the warehouse (read-only):
//   - FTTH/FWA rows come from `indicadores_cidades`
//   - 5G rows come from `indicadores_cidades_5g`
// The two have different columns, so we run two reads and merge in JS (the data
// is small — ~78k + ~16k rows total — so the broad-fetch + JS approach holds,
// see ADR 0002).
//
// Real-schema notes / gaps:
//   - Sales funnel real names: orcamentos → Vendas Criadas, orcamentos_efetivados
//     → Vendas Efetivadas, instalacoes → Vendas Instaladas. Metas for these live
//     IN `indicadores_cidades` (meta_orcamento / meta_orcamentos_efetivados /
//     meta_instalacao / meta_crescimento) — no separate metas table needed.
//   - `indicadores_cidades` has NO meta_base_ativa → proxied as base_ativa +
//     meta_crescimento (TODO: confirm real target source).
//   - `indicadores_cidades_5g` has NO meta columns (incl. meta_ativacao) → 0.
//   - `id_cidade` is unstable (month-prefixed in cities, month-only in 5g), so we
//     use `cidade` ("Cidade / UF") as the per-month city identity.
//   - `gestao` (AGILITY / BRISANET) is the partner/company dimension.

import { getDataClient } from "../client";
import { num } from "../_shared";
import type { CityDataset, CityIndicatorRecord, CityMetaRecord, Tecnologia, TipoCidade } from "./types";

const CATALOG = process.env.DATABRICKS_CITIES_CATALOG ?? "gdb_brisanet_comunidade_dev";
const SCHEMA = process.env.DATABRICKS_CITIES_SCHEMA ?? "projeto_brisa_performance";
// All sources now live in `projeto_brisa_performance` as `vw_*` views (the data
// team consolidated the commercial-intelligence tables here and added
// `revan_cidade_id` to each). The old ICM schema references are retired.
const MONTHS_WINDOW = 12;
const FQ = (t: string) => `\`${CATALOG}\`.\`${SCHEMA}\`.\`${t}\``;
const WINDOW = `add_months(date_trunc('MM', current_date()), -${MONTHS_WINDOW - 1})`;

function str(v: unknown): string {
  return v == null ? "" : String(v);
}

function ufFrom(cidade: string): string {
  const parts = cidade.split("/");

  return parts.length > 1 ? parts[parts.length - 1].trim() : "";
}

/**
 * Canonical "Cidade / UF" spacing for the display/filter name. The cube and
 * waves use "MARACANAU / CE" (spaces around the slash); indicadores_cidades_5g,
 * consolidado_5g_pedido and churn_vendedor_5g use "MARACANAU/CE". Collapsing the
 * spacing keeps ONE option per city and makes the exact-match city filter hit
 * every source (otherwise the 5G-format entry filters to 5G rows only). Case is
 * preserved — the cube stores upper-case names.
 */
function cityName(cidade: unknown): string {
  return str(cidade)
    .replace(/\s*\/\s*/g, " / ")
    .trim();
}

function normTipo(v: unknown): TipoCidade {
  const s = str(v).toUpperCase();

  if (s.includes("ONLY") || s === "5G") return "ONLY";

  if (s.includes("HIB") || s.includes("HÍB")) return "HÍBRIDA";

  return "FTTH";
}

/** Cheap freshness probe — latest competência in the main table. */
export async function databricksWatermark(): Promise<string> {
  const rows = await getDataClient().query<{ wm: string }>(
    `SELECT CAST(MAX(data) AS STRING) AS wm FROM ${FQ("vw_indicadores_cidades")}`,
  );

  return rows[0]?.wm ?? "unknown";
}

async function fetchCitiesFTTHFWA(): Promise<CityIndicatorRecord[]> {
  const sql = `
    SELECT
      date_format(data, 'yyyy-MM-01') AS competencia,
      id_cidade, revan_cidade_id, cidade, gerencia, coordenacao, tipo_cidade, gestao, tecnologia,
      base_ativa, crescimento, fechados, fechado_problema_tecnico, bloqueados,
      desativado_auto, desativado_s, reativacoes_bloqueados, reativacoes_total,
      cancelamentos, cancelamentos_voluntarios, cancelamentos_involuntarios,
      orcamentos, orcamentos_efetivados, instalacoes,
      instalados_4_mes, cancelados_4_mes,
      meta_crescimento, meta_orcamento, meta_orcamentos_efetivados, meta_instalacao,
      total_de_hp
    FROM ${FQ("vw_indicadores_cidades")}
    WHERE data >= ${WINDOW}
      AND upper(tecnologia) IN ('FTTH', 'FWA')
  `;
  // NOTE: cities with no gerência ('-') and rows with an empty/'/' cidade name are
  // kept — the official panel counts them when no filter is applied. The Gerência
  // dropdown filters placeholders out separately (see buildFilterOptions).
  const raw = await getDataClient().query<Record<string, unknown>>(sql);

  return raw.map((r) => {
    const cidade = cityName(r.cidade);
    const tec = str(r.tecnologia).toUpperCase() as Tecnologia;
    const baseAtiva = num(r.base_ativa);

    return {
      competencia: str(r.competencia),
      id_cidade: `${str(r.competencia)}|${cidade}`,
      id_cidade_src: str(r.id_cidade),
      revan_cidade_id: str(r.revan_cidade_id),
      cidade,
      uf: ufFrom(cidade),
      gerencia: str(r.gerencia),
      coordenacao: str(r.coordenacao),
      tipo_cidade: normTipo(r.tipo_cidade),
      tecnologia: tec === "FWA" ? "FWA" : "FTTH",
      base_ativa: baseAtiva,
      base_ativa_anterior: 0, // not in indicadores_cidades; prev-month join used instead
      crescimento: num(r.crescimento),
      fechados: num(r.fechados),
      fechado_problema_tecnico: num(r.fechado_problema_tecnico),
      bloqueados: num(r.bloqueados),
      desativado_auto: num(r.desativado_auto),
      desativado_s: num(r.desativado_s),
      reativacoes_bloqueados: num(r.reativacoes_bloqueados),
      reativacoes_total: num(r.reativacoes_total),
      cancelamentos: num(r.cancelamentos),
      cancelamentos_voluntarios: num(r.cancelamentos_voluntarios),
      cancelamentos_involuntarios: num(r.cancelamentos_involuntarios),
      cancelamentos_com_consumo: 0,
      cancelamentos_sem_consumo: 0,
      ativacao_mes: 0,
      chips_combo: 0,
      vendas_criadas: num(r.orcamentos),
      vendas_efetivadas: num(r.orcamentos_efetivados),
      vendas_instaladas: num(r.instalacoes),
      instalados_4_mes: num(r.instalados_4_mes),
      cancelados_4_mes: num(r.cancelados_4_mes),
      // Enriched below from waves_consolidado_orcamento (per cidade/mês/tecnologia).
      ticket_entrada_sum: 0,
      ticket_oferta_sum: 0,
      ticket_qtd: 0,
      churn_entrantes: 0,
      churn_cancelados: 0,
      churn_bloqueados: 0,
      ativacao_oficial: 0,
      ativacao_avulso: 0,
      portab_concluida: 0, // só 5G
      portab_pendente: 0,
      portab_solicitada: 0,
      total_de_hp: num(r.total_de_hp),
      meta_crescimento: num(r.meta_crescimento),
      // No meta_base_ativa column → proxy (TODO: confirm real target source).
      meta_base_ativa: baseAtiva + num(r.meta_crescimento),
      meta_vendas_criadas: num(r.meta_orcamento),
      meta_vendas_efetivadas: num(r.meta_orcamentos_efetivados),
      meta_vendas_instaladas: num(r.meta_instalacao),
      meta_ativacao: 0,
    };
  });
}

async function fetch5G(): Promise<CityIndicatorRecord[]> {
  const sql = `
    SELECT
      date_format(data, 'yyyy-MM-01') AS competencia,
      id_cidade, revan_cidade_id, cidade, gerencia, coordenacao, tipo_cidade,
      base_ativa, base_ativa_anterior, crescimento, ativacao_mes, cancelamento_mes,
      cancel_com_consumo, cancel_sem_consumo, chips_combo,
      instalacoes_4_mes, cancelamentos_4_mes
    FROM ${FQ("vw_indicadores_cidades_5g")}
    WHERE data >= ${WINDOW}
  `;
  // Cities with no gerência and rows with an empty/'/' cidade name are kept
  // (counted when no filter is applied).
  const raw = await getDataClient().query<Record<string, unknown>>(sql);

  return raw.map((r) => {
    const cidade = cityName(r.cidade);
    const canc = num(r.cancelamento_mes);

    return {
      competencia: str(r.competencia),
      id_cidade: `${str(r.competencia)}|${cidade}|5G`,
      id_cidade_src: str(r.id_cidade),
      revan_cidade_id: str(r.revan_cidade_id),
      cidade,
      uf: ufFrom(cidade),
      gerencia: str(r.gerencia),
      coordenacao: str(r.coordenacao),
      tipo_cidade: normTipo(r.tipo_cidade),
      tecnologia: "5G",
      base_ativa: num(r.base_ativa),
      base_ativa_anterior: num(r.base_ativa_anterior),
      crescimento: num(r.crescimento),
      fechados: canc,
      fechado_problema_tecnico: 0,
      bloqueados: 0,
      desativado_auto: 0,
      desativado_s: 0,
      reativacoes_bloqueados: 0,
      reativacoes_total: 0,
      cancelamentos: canc,
      cancelamentos_voluntarios: 0,
      cancelamentos_involuntarios: 0,
      cancelamentos_com_consumo: num(r.cancel_com_consumo),
      cancelamentos_sem_consumo: num(r.cancel_sem_consumo),
      ativacao_mes: num(r.ativacao_mes),
      chips_combo: num(r.chips_combo),
      vendas_criadas: 0,
      vendas_efetivadas: 0,
      vendas_instaladas: 0,
      instalados_4_mes: num(r.instalacoes_4_mes),
      cancelados_4_mes: num(r.cancelamentos_4_mes),
      // Enriched below from consolidado_5g_pedido + churn_vendedor_5g (per cidade/mês).
      ticket_entrada_sum: 0,
      ticket_oferta_sum: 0,
      ticket_qtd: 0,
      churn_entrantes: 0,
      churn_cancelados: 0,
      churn_bloqueados: 0,
      ativacao_oficial: 0,
      ativacao_avulso: 0,
      // Enriched below from portabilidade (per cidade/mês).
      portab_concluida: 0,
      portab_pendente: 0,
      portab_solicitada: 0,
      total_de_hp: 0,
      meta_crescimento: 0,
      meta_base_ativa: 0,
      meta_vendas_criadas: 0,
      meta_vendas_efetivadas: 0,
      meta_vendas_instaladas: 0,
      // No meta columns in the 5g table (TODO: confirm real 5G activation target).
      meta_ativacao: 0,
    };
  });
}

/**
 * Long-format targets from `metas_cidades`. Only active rows; the meta value is
 * stored per (id_indicador, servico, cidade, competência) — percentages as
 * fractions, matching the compute layer's expectation.
 */
async function fetchMetas(): Promise<CityMetaRecord[]> {
  const sql = `
    SELECT
      date_format(data, 'yyyy-MM-01') AS competencia,
      id_cidade, cidade, id_indicador, servico, meta
    FROM ${FQ("vw_metas_cidades")}
    WHERE data >= ${WINDOW}
      AND upper(coalesce(stutus, '')) = 'ATIVO'
      AND coalesce(id_indicador, '') <> ''
      AND coalesce(id_cidade, '') <> ''
  `;
  const raw = await getDataClient().query<Record<string, unknown>>(sql);

  return raw.map((r) => ({
    competencia: str(r.competencia),
    cidade: cityName(r.cidade),
    id_cidade: str(r.id_cidade),
    id_indicador: str(r.id_indicador),
    servico: str(r.servico),
    meta: num(r.meta),
  }));
}

/** Ticket/faturamento + funil per (competência, cidade, tecnologia) from waves. */
interface TicketAgg {
  entrada: number;
  oferta: number;
  qtd: number;
  // Funil oficial (fonte de verdade do time de dados): distinct orcamento_id,
  // status cumulativo. Criadas = todos; Efetivadas = EFETIVADO+INSTALADO;
  // Instaladas = INSTALADO. Mês pela coluna `data`. Reconcilia ~3% com o cubo.
  criadas: number;
  efetivadas: number;
  instaladas: number;
}

/**
 * FTTH/FWA ticket, faturamento e FUNIL (Vendas Criadas/Efetivadas/Instaladas) de
 * `waves_consolidado_orcamento`. Só orders não-corporativos INTERNET (→FTTH) /
 * FWA. "entrada" = valor com desconto, "oferta" = valor cheio; o funil deduplica
 * por orcamento_id. Keyed by "competência|cidade|tecnologia".
 */
async function fetchWavesTickets(): Promise<Map<string, TicketAgg>> {
  const sql = `
    SELECT
      date_format(data, 'yyyy-MM-01') AS competencia,
      revan_cidade_id,
      CASE WHEN upper(servico) = 'INTERNET' THEN 'FTTH' ELSE 'FWA' END AS tecnologia,
      SUM(try_cast(nullif(lower(trim(valor_com_desconto)), 'nan') AS DOUBLE)) AS entrada,
      SUM(try_cast(nullif(lower(trim(valor)), 'nan') AS DOUBLE)) AS oferta,
      COUNT(*) AS qtd,
      COUNT(DISTINCT orcamento_id) AS criadas,
      COUNT(DISTINCT CASE WHEN upper(status_venda) IN ('EFETIVADO', 'INSTALADO') THEN orcamento_id END) AS efetivadas,
      COUNT(DISTINCT CASE WHEN upper(status_venda) = 'INSTALADO' THEN orcamento_id END) AS instaladas
    FROM ${FQ("vw_vendas_waves")}
    WHERE data >= ${WINDOW}
      AND upper(corporativo) = 'NAO'
      AND upper(servico) IN ('INTERNET', 'FWA')
      AND revan_cidade_id IS NOT NULL
    GROUP BY 1, 2, 3
  `;
  const raw = await getDataClient().query<Record<string, unknown>>(sql);
  const map = new Map<string, TicketAgg>();

  for (const r of raw) {
    const key = `${str(r.competencia)}|${str(r.revan_cidade_id)}|${str(r.tecnologia)}`;

    map.set(key, {
      entrada: num(r.entrada),
      oferta: num(r.oferta),
      qtd: num(r.qtd),
      criadas: num(r.criadas),
      efetivadas: num(r.efetivadas),
      instaladas: num(r.instaladas),
    });
  }

  return map;
}

/** 5G ticket/faturamento + VE04/VE51 per (competência, cidade). */
interface PedidoAgg {
  entrada: number;
  oferta: number;
  qtd: number;
  ve04: number;
  ve51: number;
}

/**
 * 5G orders from `consolidado_5g_pedido`, deduplicated by n_do_pedido (a pedido
 * may span rows). "entrada" = preço promocional, "oferta" = preço de oferta
 * (comma decimals, DD/MM/YYYY dates). VE04 = distinct pedidos; VE51 = distinct
 * pedidos fora de combo (combo_ftth_5g = 'NAO'). Keyed by "competência|cidade".
 */
async function fetch5gPedidos(): Promise<Map<string, PedidoAgg>> {
  const sql = `
    WITH ped AS (
      SELECT
        date_format(to_date(data_assinatura, 'dd/MM/yyyy'), 'yyyy-MM-01') AS competencia,
        revan_cidade_id,
        n_do_pedido,
        MAX(try_cast(nullif(replace(lower(trim(preco_promocional)), ',', '.'), 'nan') AS DOUBLE)) AS entrada,
        MAX(try_cast(nullif(replace(lower(trim(preco_oferta)), ',', '.'), 'nan') AS DOUBLE)) AS oferta,
        MAX(upper(trim(combo_ftth_5g))) AS combo
      FROM ${FQ("vw_vendas_5g")}
      WHERE to_date(data_assinatura, 'dd/MM/yyyy') >= ${WINDOW}
        AND revan_cidade_id IS NOT NULL
        AND n_do_pedido IS NOT NULL
      GROUP BY 1, 2, 3
    )
    SELECT
      competencia, revan_cidade_id,
      SUM(entrada) AS entrada,
      SUM(oferta) AS oferta,
      COUNT(*) AS qtd,
      COUNT(*) AS ve04,
      COUNT(CASE WHEN combo = 'NAO' THEN 1 END) AS ve51
    FROM ped
    WHERE competencia IS NOT NULL
    GROUP BY 1, 2
  `;
  const raw = await getDataClient().query<Record<string, unknown>>(sql);
  const map = new Map<string, PedidoAgg>();

  for (const r of raw) {
    const key = `${str(r.competencia)}|${str(r.revan_cidade_id)}`;

    map.set(key, {
      entrada: num(r.entrada),
      oferta: num(r.oferta),
      qtd: num(r.qtd),
      ve04: num(r.ve04),
      ve51: num(r.ve51),
    });
  }

  return map;
}

/** 5G churn-safra components per (competência, cidade) from churn_vendedor_5g. */
interface ChurnAgg {
  entrantes: number;
  cancelados: number;
  bloqueados: number;
}

async function fetchChurn5g(): Promise<Map<string, ChurnAgg>> {
  const sql = `
    SELECT
      date_format(data_churn, 'yyyy-MM-01') AS competencia,
      revan_cidade_id,
      SUM(entrantes) AS entrantes,
      SUM(cancelados) AS cancelados,
      SUM(bloqueados) AS bloqueados
    FROM ${FQ("vw_churn_4m_vendedor_5g")}
    WHERE data_churn >= ${WINDOW}
      AND revan_cidade_id IS NOT NULL
    GROUP BY 1, 2
  `;
  const raw = await getDataClient().query<Record<string, unknown>>(sql);
  const map = new Map<string, ChurnAgg>();

  for (const r of raw) {
    const key = `${str(r.competencia)}|${str(r.revan_cidade_id)}`;

    map.set(key, {
      entrantes: num(r.entrantes),
      cancelados: num(r.cancelados),
      bloqueados: num(r.bloqueados),
    });
  }

  return map;
}

/** Portabilidade 5G concluída/pendente/solicitada per (competência, cidade). */
interface PortabAgg {
  concluida: number;
  pendente: number;
  solicitada: number;
}

/**
 * Portabilidade 5G from `portabilidade`, deduplicada por N_do_pedido (a tabela
 * espelha cada pedido em várias linhas — SOLICITADO + PORTADO, com/sem detalhe de
 * linha). Cada pedido é atribuído à competência do seu evento mais recente e
 * marcado como concluído se tiver qualquer linha PORTADO. VE32 = concluídas
 * (PORTADO); VE33 = pendentes (solicitado sem portar); solicitada = total (VE35).
 * Keyed by "competência|cidade".
 */
async function fetchPortabilidade(): Promise<Map<string, PortabAgg>> {
  const sql = `
    WITH ped AS (
      SELECT
        N_do_pedido AS pedido,
        MAX(revan_cidade_id) AS revan_cidade_id,
        date_format(MAX(to_date(data)), 'yyyy-MM-01') AS competencia,
        MAX(CASE WHEN upper(trim(STATUS)) = 'PORTADO' THEN 1 ELSE 0 END) AS portado
      FROM ${FQ("vw_portabilidade_5g")}
      WHERE N_do_pedido IS NOT NULL
        AND revan_cidade_id IS NOT NULL
        AND to_date(data) >= ${WINDOW}
      GROUP BY N_do_pedido
    )
    SELECT
      competencia, revan_cidade_id,
      SUM(portado) AS concluida,
      SUM(1 - portado) AS pendente,
      COUNT(*) AS solicitada
    FROM ped
    WHERE competencia IS NOT NULL
    GROUP BY 1, 2
  `;
  const raw = await getDataClient().query<Record<string, unknown>>(sql);
  const map = new Map<string, PortabAgg>();

  for (const r of raw) {
    const key = `${str(r.competencia)}|${str(r.revan_cidade_id)}`;

    map.set(key, {
      concluida: num(r.concluida),
      pendente: num(r.pendente),
      solicitada: num(r.solicitada),
    });
  }

  return map;
}

/** .catch handler for an isolated enrich source: log and yield an empty Map. */
function emptyMapOnError<T>(label: string) {
  return (e: unknown): T => {
    console.warn(`[cities] ${label} indisponível:`, (e as Error).message);

    return new Map() as T;
  };
}

export async function databricksCityDataset(): Promise<CityDataset> {
  const watermark = await databricksWatermark();

  // Banda Larga is the core source (propagates on failure). Everything else is
  // isolated: if a source is missing/errors, that indicator degrades to empty
  // (0 / "sem acesso") instead of taking the whole screen down. Never mock.
  const [ftthFwa, fiveG, metaRecords, tickets, pedidos, churn, portab] = await Promise.all([
    fetchCitiesFTTHFWA(),
    fetch5G().catch((e) => {
      console.warn("[cities] 5G indisponível (fonte ausente no Databricks):", (e as Error).message);

      return [] as CityIndicatorRecord[];
    }),
    fetchMetas().catch((e) => {
      console.warn("[cities] metas indisponíveis (fonte ausente no Databricks):", (e as Error).message);

      return [] as CityMetaRecord[];
    }),
    fetchWavesTickets().catch(emptyMapOnError<Map<string, TicketAgg>>("tickets")),
    fetch5gPedidos().catch(emptyMapOnError<Map<string, PedidoAgg>>("pedidos 5G")),
    fetchChurn5g().catch(emptyMapOnError<Map<string, ChurnAgg>>("churn 5G")),
    fetchPortabilidade().catch(emptyMapOnError<Map<string, PortabAgg>>("portabilidade 5G")),
  ]);

  // Enrich each record with the ticket/faturamento/churn/ativação aggregates
  // joined on (competência, revan_cidade_id[, tecnologia]) — the stable numeric
  // city id replaces the old name-based join that broke on spelling divergence.
  // The FTTH/FWA funnel (Vendas Criadas/Efetivadas/Instaladas) becomes the
  // official one from waves — but ONLY when that source actually loaded, so a
  // transient failure falls back to the cube funnel instead of zeroing it.
  const wavesLoaded = tickets.size > 0;

  for (const r of ftthFwa) {
    const t = tickets.get(`${r.competencia}|${r.revan_cidade_id}|${r.tecnologia}`);

    if (t) {
      r.ticket_entrada_sum = t.entrada;
      r.ticket_oferta_sum = t.oferta;
      r.ticket_qtd = t.qtd;
    }

    // Official funnel from waves (0 for a cidade/mês with no waves orders).
    if (wavesLoaded) {
      r.vendas_criadas = t?.criadas ?? 0;
      r.vendas_efetivadas = t?.efetivadas ?? 0;
      r.vendas_instaladas = t?.instaladas ?? 0;
    }
  }

  for (const r of fiveG) {
    const key = `${r.competencia}|${r.revan_cidade_id}`;
    const p = pedidos.get(key);

    if (p) {
      r.ticket_entrada_sum = p.entrada;
      r.ticket_oferta_sum = p.oferta;
      r.ticket_qtd = p.qtd;
      r.ativacao_oficial = p.ve04;
      r.ativacao_avulso = p.ve51;
    }

    const c = churn.get(key);

    if (c) {
      r.churn_entrantes = c.entrantes;
      r.churn_cancelados = c.cancelados;
      r.churn_bloqueados = c.bloqueados;
    }

    const pt = portab.get(key);

    if (pt) {
      r.portab_concluida = pt.concluida;
      r.portab_pendente = pt.pendente;
      r.portab_solicitada = pt.solicitada;
    }
  }

  const records = [...ftthFwa, ...fiveG];
  const months = Array.from(new Set(records.map((r) => r.competencia)))
    .filter(Boolean)
    .sort();

  return { records, metaRecords, months, watermark };
}
