// Domain types for the Cities screen (Tela 1).
//
// Field names and taxonomies follow the REAL Databricks sources
// (`indicadores_cidades` + `indicadores_cidades_5g` joined with
// `organograma_cidades`), per our decision "visual = prototype, data = docs".
// The prototype's simplified `CityRecord` (empresa, Capital/Interior) is NOT used.
//
// Business rule: "Banda Larga" = FTTH + FWA (virtual aggregate). 5G is an
// independent base and is NEVER summed into Banda Larga.

export type Tecnologia = "FTTH" | "FWA" | "5G";
export type TecnologiaFiltro = Tecnologia | "Banda Larga";

/** Service-availability class of a city (real taxonomy, see CONTEXT.md). */
export type TipoCidade = "ONLY" | "HÍBRIDA" | "FTTH";

export interface CityIndicatorRecord {
  /** Reference month, first day (real column: `data`, yyyy-MM-01). */
  competencia: string;
  /** Synthetic per-month city+tech identity used across compute (stable). */
  id_cidade: string;
  /** Raw source `id_cidade` (month-prefixed, e.g. "052026CIDADEUF") — joins to metas_cidades. */
  id_cidade_src: string;
  /** "Cidade / UF". */
  cidade: string;
  uf: string;
  // Org hierarchy (from organograma_cidades).
  gerencia: string;
  coordenacao: string;
  tipo_cidade: TipoCidade;
  tecnologia: Tecnologia;

  // Base & growth.
  base_ativa: number;
  /** Previous-month active base (5G source column; 0 for FTTH/FWA). */
  base_ativa_anterior: number;
  crescimento: number;
  fechados: number;
  fechado_problema_tecnico: number;
  bloqueados: number;
  desativado_auto: number;
  desativado_s: number;
  reativacoes_bloqueados: number;
  reativacoes_total: number;

  // Cancellations.
  cancelamentos: number;
  cancelamentos_voluntarios: number;
  cancelamentos_involuntarios: number;
  cancelamentos_com_consumo: number; // 5G
  cancelamentos_sem_consumo: number; // 5G
  ativacao_mes: number; // 5G
  chips_combo: number; // 5G — chips ativados em combo

  // Sales funnel.
  vendas_criadas: number;
  vendas_efetivadas: number;
  vendas_instaladas: number;

  // Churn safra cohort — the cohort installed 4 months ago and its cancellations.
  instalados_4_mes: number;
  cancelados_4_mes: number;

  // Ticket / faturamento (fonte: waves_consolidado_orcamento p/ FTTH/FWA;
  // consolidado_5g_pedido — deduplicado por n_do_pedido — p/ 5G). "entrada" =
  // valor com desconto/promocional; "oferta" = valor cheio. `ticket_qtd` é o nº
  // de pedidos, denominador do ticket médio (compute "avg").
  ticket_entrada_sum: number;
  ticket_oferta_sum: number;
  ticket_qtd: number;

  // Churn safra 5G com bloqueio (fonte: churn_vendedor_5g). CA10 =
  // (bloqueados + cancelados) / entrantes. Só 5G; 0 para FTTH/FWA.
  churn_entrantes: number;
  churn_cancelados: number;
  churn_bloqueados: number;

  // Ativações 5G oficiais (fonte: consolidado_5g_pedido, distinct n_do_pedido).
  // `ativacao_oficial` = VE04 oficial; `ativacao_avulso` = VE51 (combo = 'NAO').
  ativacao_oficial: number;
  ativacao_avulso: number;

  // Coverage.
  total_de_hp: number;

  // Targets (metas) — conceptually a separate dataset (see ADR 0002); mocked
  // here for v1 and joined from the real source on access.
  meta_crescimento: number;
  meta_base_ativa: number;
  meta_vendas_criadas: number;
  meta_vendas_efetivadas: number;
  meta_vendas_instaladas: number;
  meta_ativacao: number;
}

/**
 * Long-format target row from `metas_cidades`, one per
 * (id_indicador, servico, cidade, competência). The realizado lives in the
 * wide indicator tables; this only carries the target.
 */
export interface CityMetaRecord {
  competencia: string;
  cidade: string;
  /** Raw source `id_cidade` — join key against CityIndicatorRecord.id_cidade_src. */
  id_cidade: string;
  id_indicador: string;
  /** "Banda Larga" | "FTTH" | "FWA" | "5G". */
  servico: string;
  meta: number;
}

export interface CityDataset {
  records: CityIndicatorRecord[];
  /** Targets from metas_cidades, joined per indicator/servico/cidade/mês. */
  metaRecords: CityMetaRecord[];
  /** Selectable competências (yyyy-MM-01), ascending. */
  months: string[];
  /** Source freshness signal (see ADR 0002). */
  watermark: string;
}

export interface Filters {
  competencia: string;
  gerencia: string;
  coordenacao: string;
  tipoCidade: string;
  cidade: string;
  tecnologia: string; // "" = all; "Banda Larga" = FTTH+FWA
}

export interface FilterOptions {
  meses: string[];
  gerencias: string[];
  coordenacoes: string[];
  tiposCidade: string[];
  cidades: string[];
  tecnologias: TecnologiaFiltro[];
}
