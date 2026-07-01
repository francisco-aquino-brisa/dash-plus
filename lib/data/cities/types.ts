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
  id_cidade: string;
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
  cancelamentos_com_consumo: number; // 5G
  cancelamentos_sem_consumo: number; // 5G
  ativacao_mes: number; // 5G

  // Sales funnel.
  vendas_criadas: number;
  vendas_efetivadas: number;
  vendas_instaladas: number;

  // Churn safra cohort — the cohort installed 4 months ago and its cancellations.
  instalados_4_mes: number;
  cancelados_4_mes: number;

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

export interface CityDataset {
  records: CityIndicatorRecord[];
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
