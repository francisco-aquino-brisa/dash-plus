/**
 * Registered sources for the indicator engine/builder (client-safe). The `fonte`
 * stored in `especificacao_calculo` is the real Databricks view name (technical,
 * no friendly dictionary) — all live in `projeto_brisa_performance`. Column lists
 * are fetched at runtime (see source-columns.ts) so the builder stays accurate.
 */

export const SOURCES: string[] = [
  "vw_indicadores_cidades",
  "vw_indicadores_cidades_5g",
  "vw_vendas_waves",
  "vw_vendas_5g",
  "vw_churn_4m_vendedor_5g",
  "vw_portabilidade_5g",
];

export function sourceOptions(): { value: string; label: string }[] {
  return SOURCES.map((t) => ({ value: t, label: t }));
}

/**
 * Per-source metadata the preview engine needs but the catalog can't express:
 * the competência column (verified against the warehouse). Client-safe.
 */
export interface SourceMeta {
  competencia: string;
}

/** Basic preview filters + result (client-safe types, shared with the engine). */
export interface PreviewFilters {
  competencia?: string;
}

export interface PreviewResult {
  valor: number | null;
  competencia: string | null;
  meses: string[];
}

export const SOURCE_META: Record<string, SourceMeta> = {
  vw_indicadores_cidades: { competencia: "data" },
  vw_indicadores_cidades_5g: { competencia: "data" },
  vw_vendas_waves: { competencia: "data" },
  vw_vendas_5g: { competencia: "data_assinatura" },
  vw_churn_4m_vendedor_5g: { competencia: "data_churn" },
  vw_portabilidade_5g: { competencia: "data" },
};
