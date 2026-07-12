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

function normTipo(v: unknown): TipoCidade {
  const s = str(v).toUpperCase();

  if (s.includes("ONLY") || s === "5G") return "ONLY";

  if (s.includes("HIB") || s.includes("HÍB")) return "HÍBRIDA";

  return "FTTH";
}

/** Cheap freshness probe — latest competência in the main table. */
export async function databricksWatermark(): Promise<string> {
  const rows = await getDataClient().query<{ wm: string }>(
    `SELECT CAST(MAX(data) AS STRING) AS wm FROM ${FQ("indicadores_cidades")}`,
  );

  return rows[0]?.wm ?? "unknown";
}

async function fetchCitiesFTTHFWA(): Promise<CityIndicatorRecord[]> {
  const sql = `
    SELECT
      date_format(data, 'yyyy-MM-01') AS competencia,
      id_cidade, cidade, gerencia, coordenacao, tipo_cidade, gestao, tecnologia,
      base_ativa, crescimento, fechados, fechado_problema_tecnico, bloqueados,
      desativado_auto, desativado_s, reativacoes_bloqueados, reativacoes_total,
      cancelamentos, cancelamentos_voluntarios,
      orcamentos, orcamentos_efetivados, instalacoes,
      instalados_4_mes, cancelados_4_mes,
      meta_crescimento, meta_orcamento, meta_orcamentos_efetivados, meta_instalacao,
      total_de_hp
    FROM ${FQ("indicadores_cidades")}
    WHERE data >= ${WINDOW}
      AND upper(tecnologia) IN ('FTTH', 'FWA')
      AND coalesce(cidade, '') <> ''
  `;
  // NOTE: cities with no gerência ('-') are kept — the official panel counts them
  // when no filter is applied. The Gerência dropdown filters '-' out separately.
  const raw = await getDataClient().query<Record<string, unknown>>(sql);

  return raw.map((r) => {
    const cidade = str(r.cidade);
    const tec = str(r.tecnologia).toUpperCase() as Tecnologia;
    const baseAtiva = num(r.base_ativa);

    return {
      competencia: str(r.competencia),
      id_cidade: `${str(r.competencia)}|${cidade}`,
      id_cidade_src: str(r.id_cidade),
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
      cancelamentos_com_consumo: 0,
      cancelamentos_sem_consumo: 0,
      ativacao_mes: 0,
      chips_combo: 0,
      vendas_criadas: num(r.orcamentos),
      vendas_efetivadas: num(r.orcamentos_efetivados),
      vendas_instaladas: num(r.instalacoes),
      instalados_4_mes: num(r.instalados_4_mes),
      cancelados_4_mes: num(r.cancelados_4_mes),
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
      id_cidade, cidade, gerencia, coordenacao, tipo_cidade,
      base_ativa, base_ativa_anterior, crescimento, ativacao_mes, cancelamento_mes,
      cancel_com_consumo, cancel_sem_consumo, chips_combo,
      instalacoes_4_mes, cancelamentos_4_mes
    FROM ${FQ("indicadores_cidades_5g")}
    WHERE data >= ${WINDOW}
      AND trim(coalesce(cidade, '')) NOT IN ('', '/')
  `;
  // Cities with no gerência are kept (counted when no filter is applied).
  const raw = await getDataClient().query<Record<string, unknown>>(sql);

  return raw.map((r) => {
    const cidade = str(r.cidade);
    const canc = num(r.cancelamento_mes);

    return {
      competencia: str(r.competencia),
      id_cidade: `${str(r.competencia)}|${cidade}|5G`,
      id_cidade_src: str(r.id_cidade),
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
      cancelamentos_com_consumo: num(r.cancel_com_consumo),
      cancelamentos_sem_consumo: num(r.cancel_sem_consumo),
      ativacao_mes: num(r.ativacao_mes),
      chips_combo: num(r.chips_combo),
      vendas_criadas: 0,
      vendas_efetivadas: 0,
      vendas_instaladas: 0,
      instalados_4_mes: num(r.instalacoes_4_mes),
      cancelados_4_mes: num(r.cancelamentos_4_mes),
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
    FROM ${FQ("metas_cidades")}
    WHERE data >= ${WINDOW}
      AND upper(coalesce(stutus, '')) = 'ATIVO'
      AND coalesce(id_indicador, '') <> ''
      AND coalesce(id_cidade, '') <> ''
  `;
  const raw = await getDataClient().query<Record<string, unknown>>(sql);

  return raw.map((r) => ({
    competencia: str(r.competencia),
    cidade: str(r.cidade),
    id_cidade: str(r.id_cidade),
    id_indicador: str(r.id_indicador),
    servico: str(r.servico),
    meta: num(r.meta),
  }));
}

export async function databricksCityDataset(): Promise<CityDataset> {
  const watermark = await databricksWatermark();
  // Banda Larga is the core source (propagates on failure). 5G and metas are
  // isolated: if their source is missing/errors, the block degrades to "sem
  // acesso" (empty) instead of taking the whole screen down. Never mock.
  const [ftthFwa, fiveG, metaRecords] = await Promise.all([
    fetchCitiesFTTHFWA(),
    fetch5G().catch((e) => {
      console.warn("[cities] 5G indisponível (fonte ausente no Databricks):", (e as Error).message);

      return [] as CityIndicatorRecord[];
    }),
    fetchMetas().catch((e) => {
      console.warn("[cities] metas indisponíveis (fonte ausente no Databricks):", (e as Error).message);

      return [] as CityMetaRecord[];
    }),
  ]);
  const records = [...ftthFwa, ...fiveG];
  const months = Array.from(new Set(records.map((r) => r.competencia)))
    .filter(Boolean)
    .sort();

  return { records, metaRecords, months, watermark };
}
