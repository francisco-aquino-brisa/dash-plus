// Indicator definitions shown in the cards' info tooltip ("how is this computed").
//
// Source of truth: the data team's `ficha_indicadores` table (columns `metrica`/
// `descricao_indicador`) and the docs — NOT the prototype (see CLAUDE.md
// "Indicator definitions"). Formulas below are transcribed from `metrica` into
// readable PT-BR. Keyed by the exact card label each screen renders.

export interface IndicatorDef {
  /** Readable formula, transcribed from ficha_indicadores.metrica. */
  formula: string;
}

export const INDICATOR_DEFINITIONS: Record<string, IndicatorDef> = {
  // ── Performance Cidades (Tela 1) — fonte: indicadores_cidades ──────────────
  "Crescimento Base": {
    formula: "(Base Ativa + Fechados) do mês − (Base Ativa + Fechados) do mês anterior.",
  },
  "Crescimento Base Ativa": {
    formula: "Soma do crescimento de clientes com status Ativo no mês (Soma[crescimento]).",
  },
  "Base Fechada": {
    formula: "Soma de clientes fechados no mês (Soma[fechados]). Menor é melhor.",
  },
  "Reativação Bloqueados": {
    formula: "Reativações de bloqueados ÷ total de bloqueados (Soma[reativacoes_bloqueados] / Soma[bloqueados]).",
  },
  "Churn Rate": {
    formula: "Cancelamentos do mês ÷ (Base Ativa + Fechados do mês anterior) × 100. Menor é melhor.",
  },
  "Churn Safra": {
    formula:
      "Cancelados ÷ instalações da safra instalada há 4 meses (Soma[cancelados] / Soma[instalacoes]). Menor é melhor.",
  },
  Takeup: {
    formula: "(Base Ativa + Fechados) ÷ Home Passed × 100 — ocupação da base potencial.",
  },

  // ── Funil de vendas (compartilhado entre Tela 1 e Tela 3) ──────────────────
  "Vendas Criadas": {
    formula: "Contagem distinta de pedidos com status_venda = CRIADO no período.",
  },
  "Vendas Efetivadas": {
    formula:
      "Contagem distinta de pedidos com status_venda = EFETIVADO no período. Efetivados x Criados = Efetivadas ÷ Criadas.",
  },
  "Vendas Instaladas": {
    formula:
      "Contagem distinta de pedidos com status_venda = INSTALADO no período. Instalados x Efetivados = Instaladas ÷ Efetivadas.",
  },

  // ── 5G (Tela 1 e Tela 3) ───────────────────────────────────────────────────
  "Ativações 5G": {
    formula: "Contagem distinta de ativações 5G no mês (single + combos a partir do 2º chip + migração).",
  },
  "Vendas Ativadas 5G": {
    formula: "Contagem distinta de ativações 5G (combo FTTH+5G = NÃO, mais chips do 2º em diante e migração).",
  },
  "Churn Rate 5G": {
    formula: "Cancelamentos 5G do mês ÷ base ativa do mês anterior × 100. Menor é melhor.",
  },

  // ── Receita / Ticket (Tela 3) ───────────────────────────────────────────────
  "Ticket de Entrada": {
    formula: "Média do valor com desconto das vendas BL instaladas (corporativo = NÃO; serviço INTERNET/FWA).",
  },
  "Ticket Médio Entrada": {
    formula: "Média do valor com desconto das vendas BL instaladas (corporativo = NÃO; serviço INTERNET/FWA).",
  },
  "Ticket Médio Entrada 5G": {
    formula: "Média do preço promocional das vendas 5G instaladas (sem pedidos duplicados).",
  },

  // ── Portabilidade / Churn 5G (Tela 3) ──────────────────────────────────────
  "% Portabilidade (Concluída x Ativ.)": {
    formula: "Portabilidades concluídas no mês ÷ ativações 5G do mês.",
  },
  "% Portabilidade (Concluída x Solic.)": {
    formula: "Portabilidades concluídas ÷ portabilidades solicitadas no mês.",
  },
  "Churn Safra 5G c/ Bloqueio": {
    formula: "(Bloqueados + Cancelados) ÷ entrantes da safra de ativações de 4 meses atrás. Menor é melhor.",
  },

  // ── PDU (Tela 3) — fórmula oficial do CLAUDE.md / vw_hc_zerado_vendedor ─────
  PDU: {
    formula: "Produção realizada ÷ HC ativo ÷ MÁX(dias úteis acumulados), por tecnologia (FTTH/FWA/5G).",
  },

  // ── Seleção livre de indicadores (Tela 3) — nomes-base ──────────────────────
  "Efetivados x Criados": {
    formula: "Vendas efetivadas ÷ vendas criadas no período (taxa de conversão do funil).",
  },
  "Instalados x Efetivados": {
    formula: "Vendas instaladas ÷ vendas efetivadas no período (taxa de conclusão do funil).",
  },
  "Vendas Ativadas": {
    formula: "Contagem distinta de ativações 5G no período (single + combos a partir do 2º chip + migração).",
  },
  "% Portabilidade": {
    formula: "Portabilidades concluídas ÷ ativações (ou solicitações) 5G do mês.",
  },
  "Churn Safra c/ Bloqueio": {
    formula: "(Bloqueados + Cancelados) ÷ entrantes da safra de 4 meses atrás. Menor é melhor.",
  },
  "Combo 1 Chip": { formula: "% de vendas FTTH com combo de 1 chip 5G." },
  "Combo 2 Chip": { formula: "% de vendas FTTH com combo de 2 chips 5G." },
  "Combo 3+ Chip": { formula: "% de vendas FTTH com combo de 3 ou mais chips 5G." },
};

/** Lookup by card label, tolerant of a few known label variants. */
export function getIndicatorDef(label: string): IndicatorDef | undefined {
  if (INDICATOR_DEFINITIONS[label]) return INDICATOR_DEFINITIONS[label];
  // Funnel labels sometimes carry a scope suffix (e.g. "Vendas Criadas - FTTH").
  const base = label.split(" - ")[0].trim();
  return INDICATOR_DEFINITIONS[base];
}
