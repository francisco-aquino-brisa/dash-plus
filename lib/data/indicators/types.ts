/**
 * View models for the indicator catalog (admin area). Mirror the real
 * `indicadores_gerais` / `indicadores_servicos` schema verified in the warehouse
 * (the `stutus` typo from the legacy copy was fixed to `status` in this table).
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

/** Editable draft for a serviço row — client-safe, used by the create/edit forms. */
export interface ServicoDraft {
  id: string;
  servico: string;
  indicadorServico: string;
  formatoDado: string;
  polaridade: string;
  status: string;
  descricao: string;
  tabela: string;
  colunas: string;
  funcao: string;
  metrica: string;
}

export function emptyServicoDraft(): ServicoDraft {
  return {
    id: "",
    servico: "",
    indicadorServico: "",
    formatoDado: "Qtd",
    polaridade: "Maior melhor",
    status: "Ativo",
    descricao: "",
    tabela: "",
    colunas: "",
    funcao: "",
    metrica: "",
  };
}

export function servicoDraftFrom(s: IndicadorServico): ServicoDraft {
  return {
    id: s.id,
    servico: s.servico,
    indicadorServico: s.indicadorServico,
    formatoDado: s.formatoDado ?? "Qtd",
    polaridade: s.polaridade ?? "Maior melhor",
    status: s.status ?? "Ativo",
    descricao: s.descricao ?? "",
    tabela: s.tabela ?? "",
    colunas: s.colunas ?? "",
    funcao: s.funcao ?? "",
    metrica: s.metrica ?? "",
  };
}
