/**
 * View models for the indicator catalog (admin area). Mirror the real
 * `indicadores_gerais` / `indicadores_servicos` schema verified in the warehouse.
 * Note `status` maps the `stutus` column (a known typo — see the data-team doc);
 * we read it under the corrected name.
 */

/** One indicator × serviço row: the level that carries the formula. */
export interface IndicadorServico {
  /** Natural string id, e.g. `BA01FTTH`. */
  id: string;
  idIndicadorGeral: string;
  servico: string;
  indicadorServico: string;
  descricao: string | null;
  /** Origin docs (prose) — the source table and columns the formula reads. */
  tabela: string | null;
  colunas: string | null;
  formatoDado: string | null;
  polaridade: string | null;
  funcao: string | null;
  /** Human formula (prose) — documentation, not executable. */
  metrica: string | null;
  status: string | null;
  /** Machine-executable calc JSON (the dynamic-indicator contract). Null until set. */
  especificacaoCalculo: string | null;
}

/** The parent indicator, with its serviços grouped underneath. */
export interface IndicadorGeral {
  /** Natural string id, e.g. `BA04`. */
  id: string;
  categoria: string;
  nome: string;
  status: string | null;
  servicos: IndicadorServico[];
}
