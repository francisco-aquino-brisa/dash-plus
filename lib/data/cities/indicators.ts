// Indicator catalog for the Performance Cidades blocks (Banda Larga + 5G).
//
// Source of truth for WHAT is selectable per block. Each id_indicador maps onto
// the wide `indicadores_cidades` / `indicadores_cidades_5g` columns the app
// already loads. Indicators whose realizado has no source column carry
// `available: false` and render as "Sem acesso aos dados" (mirrors the mockup).
//
// Metas come exclusively from `metas_cidades` (long-format), joined by
// (targetId, servico, cidade, competência). `targetId` is usually the same id; when
// undefined the card shows the realizado with no target/attainment.
//
// Business rule: Banda Larga = FTTH + FWA (servico "Banda Larga"); 5G is
// independent. See CONTEXT.md and CLAUDE.md "Indicator definitions".

import type { CityIndicatorRecord } from "./types";

export type IndicatorBlock = "banda-larga" | "5g";
export type IndicatorUnit = "qtd" | "percent" | "currency";
/** "up" = maior é melhor; "down" = menor é melhor (churn, cancelamentos). */
export type Polarity = "up" | "down";

/** Numeric fields of a record usable as a metric component. */
type NumField = {
  [K in keyof CityIndicatorRecord]: CityIndicatorRecord[K] extends number ? K : never;
}[keyof CityIndicatorRecord];

/** How to aggregate the realizado over a set of rows in scope. */
export type IndicatorCompute =
  | { kind: "sum"; field: NumField }
  /** (Σnum / Σden) × 100 — recomputed from summed components, never averaged.
   *  num/den may be a single field or several fields summed together. */
  | { kind: "ratio"; num: NumField | NumField[]; den: NumField | NumField[] }
  /** (base_ativa + fechados) − same of previous month. Needs prev-month rows. */
  | { kind: "growthBase" }
  /** Σ metas_cidades.meta for `targetId` over cities in scope (servico-aware). */
  | { kind: "metaSum"; targetId: string }
  /** Churn-target rate: Σmeta[numMetaId] / (Σ prevBaseFields[prev month] +
   *  Σmeta[denMetaId]) × 100. Used for the Churn Rate meta (CA12 / base geral). */
  | { kind: "cancelRate"; numMetaId: string; denMetaId: string; prevBaseFields: NumField[] };

/**
 * A slot in the card footer (the small columns under the value). "target",
 * "projection" and "attainment" are the built-in stats; a custom slot renders a
 * derived value with its own label (e.g. "% Fechados"). Order is preserved.
 */
export type FooterSlot =
  | "target"
  | "projection"
  | "attainment"
  | { label: string; compute: IndicatorCompute; unit?: IndicatorUnit; decimals?: number };

/** Default footer when a def doesn't override it. */
export const DEFAULT_FOOTER: FooterSlot[] = ["target", "projection", "attainment"];

export interface IndicatorDef {
  id: string;
  block: IndicatorBlock;
  label: string;
  unit: IndicatorUnit;
  polarity: Polarity;
  available: boolean;
  /** Override display decimals (default: 2 for percent/currency, 0 for qtd). */
  decimals?: number;
  /** Absent when `available` is false. */
  compute?: IndicatorCompute;
  /**
   * Meta computed directly (already in final unit), bypassing metas_cidades
   * per-city aggregation — e.g. Churn Rate's target is a ratio of two metas.
   */
  targetCompute?: IndicatorCompute;
  /** id_indicador to look up in metas_cidades; absent → no meta. */
  targetId?: string;
  /** Which metas_cidades.servico row applies at the aggregate (block) level. */
  targetService?: "Banda Larga" | "5G";
  /**
   * When the stored meta refers to a DERIVED value (not the card's main value),
   * with its own unit — e.g. Base Fechada shows a quantity but its meta is the
   * fechamento RATE (%). The attainment then compares this computed value to the
   * meta, and the Meta column is formatted with `unit`.
   */
  targetCompare?: { compute: IndicatorCompute; unit: IndicatorUnit };
  /** Footer columns for this card. Defaults to Meta · Projeção · Ating. */
  footer?: FooterSlot[];
  /** Extra values shown in the detail chart tooltip (e.g. the ratio components). */
  chartExtras?: { label: string; compute: IndicatorCompute; unit?: IndicatorUnit; decimals?: number }[];
  /** Secondary metrics shown in the detail modal (clickable → chart swaps). */
  related?: RelatedDef[];
  /** Readable formula for the InfoHint tooltip. */
  description: string;
}

/**
 * A related indicator shown inside the detail modal, below the main stats. Each
 * is a secondary metric derived from the same scoped rows; clicking its card
 * swaps the chart to this metric's 12-month series. No meta/attainment — these
 * are context, not targets.
 */
export interface RelatedDef {
  /** Stable id within the parent (its source column name). */
  id: string;
  label: string;
  unit: IndicatorUnit;
  polarity: Polarity;
  /** Override display decimals (default: 2 for percent/currency, 0 for qtd). */
  decimals?: number;
  compute: IndicatorCompute;
}

/** Composite key so ids shared across blocks (BA02, CA03, RE01) stay distinct. */
export function indicatorKey(block: IndicatorBlock, id: string): string {
  return `${block}:${id}`;
}

const BLOCKED = (
  id: string,
  block: IndicatorBlock,
  label: string,
  unit: IndicatorUnit,
  polarity: Polarity,
  description: string,
): IndicatorDef => ({ id, block, label, unit, polarity, available: false, description });

// ── Banda Larga (INTERNET + FWA) ─────────────────────────────────────────────
const BANDA_LARGA: IndicatorDef[] = [
  {
    id: "BA01",
    block: "banda-larga",
    label: "Base Ativa",
    unit: "qtd",
    polarity: "up",
    available: true,
    compute: { kind: "sum", field: "base_ativa" },
    description: "Soma da base de clientes ativos no mês (Soma[base_ativa]).",
  },
  {
    id: "BA02",
    block: "banda-larga",
    label: "Crescimento Base Ativa",
    unit: "qtd",
    polarity: "up",
    available: true,
    compute: { kind: "sum", field: "crescimento" },
    description: "Soma do crescimento de clientes ativos no mês (Soma[crescimento]).",
  },
  {
    id: "BA03",
    block: "banda-larga",
    label: "Base Fechada",
    unit: "qtd",
    polarity: "down",
    available: true,
    compute: { kind: "sum", field: "fechados" },
    targetId: "BA03",
    targetService: "Banda Larga",
    targetCompare: {
      compute: { kind: "ratio", num: "fechados", den: ["base_ativa", "fechados"] },
      unit: "percent",
    },
    footer: [
      "target",
      {
        label: "% Fechados",
        compute: { kind: "ratio", num: "fechados", den: ["base_ativa", "fechados"] },
        unit: "percent",
      },
      "attainment",
    ],
    related: [
      {
        id: "bloqueados",
        label: "Bloqueados",
        unit: "qtd",
        polarity: "down",
        compute: { kind: "sum", field: "bloqueados" },
      },
      {
        id: "desativado_auto",
        label: "Desativado Automático",
        unit: "qtd",
        polarity: "down",
        compute: { kind: "sum", field: "desativado_auto" },
      },
      {
        id: "desativado_s",
        label: "Desativado Solicitados",
        unit: "qtd",
        polarity: "down",
        compute: { kind: "sum", field: "desativado_s" },
      },
      {
        id: "fechado_problema_tecnico",
        label: "Fechados por Problema Técnico",
        unit: "qtd",
        polarity: "down",
        compute: { kind: "sum", field: "fechado_problema_tecnico" },
      },
    ],
    description:
      "Soma de clientes fechados no mês (Soma[fechados]). Meta = taxa de fechamento (metas_cidades). Menor é melhor.",
  },
  {
    id: "BA04",
    block: "banda-larga",
    label: "Crescimento Base",
    unit: "qtd",
    polarity: "up",
    available: true,
    compute: { kind: "growthBase" },
    targetId: "BA04",
    targetService: "Banda Larga",
    footer: ["target", "attainment"],
    description: "(Base Ativa + Fechados) do mês − (Base Ativa + Fechados) do mês anterior.",
  },
  {
    id: "BA10",
    block: "banda-larga",
    label: "Clientes Bloqueados",
    unit: "qtd",
    polarity: "down",
    available: true,
    compute: { kind: "sum", field: "bloqueados" },
    description: "Soma de clientes bloqueados no mês (Soma[bloqueados]).",
  },
  {
    id: "BA11",
    block: "banda-larga",
    label: "Desativados Automáticos",
    unit: "qtd",
    polarity: "down",
    available: true,
    compute: { kind: "sum", field: "desativado_auto" },
    description: "Soma de clientes desativados automaticamente (Soma[desativado_auto]).",
  },
  {
    id: "BA12",
    block: "banda-larga",
    label: "Desativados Solicitados",
    unit: "qtd",
    polarity: "down",
    available: true,
    compute: { kind: "sum", field: "desativado_s" },
    description: "Soma de clientes desativados a pedido do cliente (Soma[desativado_s]).",
  },
  {
    id: "BA13",
    block: "banda-larga",
    label: "Reativação de Bloqueados",
    unit: "percent",
    polarity: "up",
    available: true,
    compute: { kind: "ratio", num: "reativacoes_bloqueados", den: "bloqueados" },
    // No meta: show the raw quantities in place of Meta/Projeção.
    footer: [
      { label: "Bloqueios", compute: { kind: "sum", field: "bloqueados" }, unit: "qtd" },
      { label: "Reativação", compute: { kind: "sum", field: "reativacoes_bloqueados" }, unit: "qtd" },
    ],
    related: [
      {
        id: "pct_reativ_bloq",
        label: "% de Reativação de Bloqueados",
        unit: "percent",
        polarity: "up",
        compute: { kind: "ratio", num: "reativacoes_bloqueados", den: "bloqueados" },
      },
      {
        id: "bloqueados",
        label: "Clientes Bloqueados",
        unit: "qtd",
        polarity: "down",
        compute: { kind: "sum", field: "bloqueados" },
      },
      {
        id: "reativacoes_bloqueados",
        label: "Reativação de Bloqueados",
        unit: "qtd",
        polarity: "up",
        compute: { kind: "sum", field: "reativacoes_bloqueados" },
      },
      {
        id: "reativacoes_total",
        label: "Reativação Geral",
        unit: "qtd",
        polarity: "up",
        compute: { kind: "sum", field: "reativacoes_total" },
      },
    ],
    description: "Reativações de bloqueados ÷ total de bloqueados × 100.",
  },
  {
    id: "CA03",
    block: "banda-larga",
    label: "Churn Rate",
    unit: "percent",
    polarity: "down",
    available: true,
    // Churn = cancelamentos ÷ base geral (base_ativa + fechados) × 100.
    compute: { kind: "ratio", num: "cancelamentos", den: ["base_ativa", "fechados"] },
    // Meta = meta de cancelamento (CA12) ÷ base geral projetada (base geral do mês
    // anterior + meta de crescimento base BA04) × 100.
    targetCompute: {
      kind: "cancelRate",
      numMetaId: "CA12",
      denMetaId: "BA04",
      prevBaseFields: ["base_ativa", "fechados"],
    },
    footer: ["target", "attainment"],
    related: [
      {
        id: "meta_cancelamentos",
        label: "Meta de Cancelamentos",
        unit: "qtd",
        polarity: "down",
        compute: { kind: "metaSum", targetId: "CA12" },
      },
      {
        id: "cancelamentos",
        label: "Cancelamento Mês",
        unit: "qtd",
        polarity: "down",
        compute: { kind: "sum", field: "cancelamentos" },
      },
      {
        id: "cancel_vol",
        label: "% Cancelamento Voluntário",
        unit: "percent",
        polarity: "down",
        compute: { kind: "ratio", num: "cancelamentos_voluntarios", den: ["base_ativa", "fechados"] },
      },
      {
        id: "cancel_invol",
        label: "% Cancelamento Involuntário",
        unit: "percent",
        polarity: "down",
        compute: { kind: "ratio", num: "cancelamentos_involuntarios", den: ["base_ativa", "fechados"] },
      },
    ],
    description: "Cancelamentos do mês ÷ base geral (base ativa + fechados) × 100. Menor é melhor.",
  },
  {
    id: "CA04",
    block: "banda-larga",
    label: "Churn Safra",
    unit: "percent",
    polarity: "down",
    available: true,
    compute: { kind: "ratio", num: "cancelados_4_mes", den: "instalados_4_mes" },
    // Meta = média das metas CA09 ponderada por instalados_4_mes (metas_cidades).
    targetId: "CA09",
    targetService: "Banda Larga",
    footer: ["target", "attainment"],
    chartExtras: [
      { label: "Cancelados 4m", compute: { kind: "sum", field: "cancelados_4_mes" }, unit: "qtd" },
      { label: "Instalados 4m", compute: { kind: "sum", field: "instalados_4_mes" }, unit: "qtd" },
    ],
    related: [
      {
        id: "cancelados_4_mes",
        label: "Cancelamento de 4 Meses",
        unit: "qtd",
        polarity: "down",
        compute: { kind: "sum", field: "cancelados_4_mes" },
      },
      {
        id: "instalados_4_mes",
        label: "Instalação de 4 Meses",
        unit: "qtd",
        polarity: "up",
        compute: { kind: "sum", field: "instalados_4_mes" },
      },
    ],
    description: "Cancelados ÷ instalações da safra instalada há 4 meses × 100. Menor é melhor.",
  },
  {
    id: "VE01",
    block: "banda-larga",
    label: "Vendas Criadas",
    unit: "qtd",
    polarity: "up",
    available: true,
    compute: { kind: "sum", field: "vendas_criadas" },
    targetId: "VE01",
    targetService: "Banda Larga",
    description: "Contagem de pedidos criados no período (orcamentos).",
  },
  {
    id: "VE02",
    block: "banda-larga",
    label: "Vendas Efetivadas",
    unit: "qtd",
    polarity: "up",
    available: true,
    compute: { kind: "sum", field: "vendas_efetivadas" },
    targetId: "VE02",
    targetService: "Banda Larga",
    description: "Contagem de pedidos efetivados no período (orcamentos_efetivados).",
  },
  {
    id: "VE03",
    block: "banda-larga",
    label: "Vendas Instaladas",
    unit: "qtd",
    polarity: "up",
    available: true,
    compute: { kind: "sum", field: "vendas_instaladas" },
    targetId: "VE03",
    targetService: "Banda Larga",
    description: "Contagem de instalações concluídas no período (instalacoes).",
  },
  {
    id: "VE05",
    block: "banda-larga",
    label: "Efetivados x Criado",
    unit: "percent",
    polarity: "up",
    available: true,
    compute: { kind: "ratio", num: "vendas_efetivadas", den: "vendas_criadas" },
    targetId: "VE05",
    targetService: "Banda Larga",
    description: "Vendas Efetivadas ÷ Vendas Criadas × 100.",
  },
  {
    id: "VE06",
    block: "banda-larga",
    label: "Instalados x Efetivados",
    unit: "percent",
    polarity: "up",
    available: true,
    compute: { kind: "ratio", num: "vendas_instaladas", den: "vendas_efetivadas" },
    targetId: "VE06",
    targetService: "Banda Larga",
    description: "Vendas Instaladas ÷ Vendas Efetivadas × 100.",
  },
  BLOCKED(
    "RE01",
    "banda-larga",
    "Ticket Médio Entrada",
    "currency",
    "up",
    "Ticket médio de entrada. Fonte de dados ainda não disponível no cubo de cidades.",
  ),
  BLOCKED(
    "RE04",
    "banda-larga",
    "Faturamento de Entrada",
    "currency",
    "up",
    "Faturamento de entrada. Fonte de dados ainda não disponível no cubo de cidades.",
  ),
];

// ── 5G ───────────────────────────────────────────────────────────────────────
const CINCO_G: IndicatorDef[] = [
  {
    id: "BA02",
    block: "5g",
    label: "Crescimento Base Ativa",
    unit: "qtd",
    polarity: "up",
    available: true,
    compute: { kind: "sum", field: "crescimento" },
    targetId: "BA02",
    targetService: "5G",
    description: "Soma do crescimento da base ativa 5G no mês (Soma[crescimento]).",
  },
  {
    id: "CA01",
    block: "5g",
    label: "Churn 5G — Com Consumo",
    unit: "qtd",
    polarity: "down",
    available: true,
    compute: { kind: "sum", field: "cancelamentos_com_consumo" },
    description: "Cancelamentos 5G do mês com consumo (Soma[cancel_com_consumo]).",
  },
  {
    id: "CA02",
    block: "5g",
    label: "Churn 5G — Sem Consumo",
    unit: "qtd",
    polarity: "down",
    available: true,
    compute: { kind: "sum", field: "cancelamentos_sem_consumo" },
    description: "Cancelamentos 5G do mês sem consumo (Soma[cancel_sem_consumo]).",
  },
  {
    id: "CA03",
    block: "5g",
    label: "Churn Rate",
    unit: "percent",
    polarity: "down",
    available: true,
    compute: { kind: "ratio", num: "cancelamentos", den: "base_ativa_anterior" },
    targetId: "CA03",
    targetService: "5G",
    description: "Cancelamentos 5G do mês ÷ base ativa do mês anterior × 100. Menor é melhor.",
  },
  {
    id: "CA09",
    block: "5g",
    label: "Churn Safra Cidade",
    unit: "percent",
    polarity: "down",
    available: true,
    compute: { kind: "ratio", num: "cancelados_4_mes", den: "instalados_4_mes" },
    description: "Cancelados ÷ instalações da safra 5G instalada há 4 meses × 100. Menor é melhor.",
  },
  {
    id: "VE04",
    block: "5g",
    label: "Vendas Ativadas",
    unit: "qtd",
    polarity: "up",
    available: true,
    compute: { kind: "sum", field: "ativacao_mes" },
    targetId: "VE04",
    targetService: "5G",
    description: "Contagem de ativações 5G no mês (Soma[ativacao_mes]).",
  },
  {
    id: "VE27",
    block: "5g",
    label: "Vendas Ativadas Chip Combo",
    unit: "qtd",
    polarity: "up",
    available: true,
    compute: { kind: "sum", field: "chips_combo" },
    description: "Contagem de chips 5G ativados em combo (Soma[chips_combo]).",
  },
  {
    id: "CA12",
    block: "5g",
    label: "Cancelamento Mês",
    unit: "qtd",
    polarity: "down",
    available: true,
    compute: { kind: "sum", field: "cancelamentos" },
    targetId: "CA12",
    targetService: "5G",
    description: "Total de cancelamentos 5G no mês (Soma[cancelamento_mes]). Menor é melhor.",
  },
  BLOCKED(
    "VE32",
    "5g",
    "Portabilidade",
    "qtd",
    "up",
    "Portabilidades 5G concluídas. Fonte portabilidade_5g ainda não integrada.",
  ),
  BLOCKED(
    "VE33",
    "5g",
    "Portabilidade Pendente",
    "qtd",
    "down",
    "Portabilidades 5G pendentes. Fonte portabilidade_5g ainda não integrada.",
  ),
  BLOCKED(
    "VE34",
    "5g",
    "% Portabilidade (Concluída x Ativações 5G)",
    "percent",
    "up",
    "Portabilidades concluídas ÷ ativações 5G × 100. Fonte portabilidade_5g ainda não integrada.",
  ),
  BLOCKED(
    "VE35",
    "5g",
    "% Portabilidade (Concluída x Solicitada)",
    "percent",
    "up",
    "Portabilidades concluídas ÷ solicitadas × 100. Fonte portabilidade_5g ainda não integrada.",
  ),
  BLOCKED(
    "RE01",
    "5g",
    "Ticket Médio Entrada",
    "currency",
    "up",
    "Ticket médio de entrada 5G. Fonte de dados ainda não disponível no cubo de cidades.",
  ),
  BLOCKED(
    "RE02",
    "5g",
    "Ticket Médio Oferta",
    "currency",
    "up",
    "Ticket médio de oferta 5G. Fonte de dados ainda não disponível no cubo de cidades.",
  ),
  BLOCKED(
    "RE04",
    "5g",
    "Faturamento de Entrada",
    "currency",
    "up",
    "Faturamento de entrada 5G. Fonte de dados ainda não disponível no cubo de cidades.",
  ),
  BLOCKED(
    "RE05",
    "5g",
    "Faturamento de Oferta",
    "currency",
    "up",
    "Faturamento de oferta 5G. Fonte de dados ainda não disponível no cubo de cidades.",
  ),
  BLOCKED(
    "CA10",
    "5g",
    "Churn Safra com Bloqueio",
    "percent",
    "down",
    "Churn safra 5G considerando bloqueios. Fonte churn_vendedor_5g ainda não integrada.",
  ),
  BLOCKED(
    "VE51",
    "5g",
    "Ativação 5G Avulso",
    "qtd",
    "up",
    "Ativações 5G avulsas (fora de combo). Fonte de dados ainda não disponível no cubo de cidades.",
  ),
];

export const INDICATORS: IndicatorDef[] = [...BANDA_LARGA, ...CINCO_G];

export function indicatorsForBlock(block: IndicatorBlock): IndicatorDef[] {
  return INDICATORS.filter((i) => i.block === block);
}

/** First-visit selections, mirroring the "Modificação" mockup. */
export const DEFAULT_SELECTION: Record<IndicatorBlock, string[]> = {
  "banda-larga": ["VE01", "VE02", "VE03", "RE01", "CA04"],
  "5g": ["VE04", "VE34", "VE35", "RE01", "CA10"],
};

/** localStorage preference keys for the per-block selection. */
export const SELECTION_PREF_KEY: Record<IndicatorBlock, string> = {
  "banda-larga": "cidades.blocos.banda-larga.selecionados",
  "5g": "cidades.blocos.5g.selecionados",
};

// ── Detail modal: the top stat cards (add/remove) ────────────────────────────
/** Stat slots shown above the chart in the indicator detail modal. */
export type DetailStat = "current" | "target" | "attainment" | "average" | "delta";

export const DETAIL_STAT_LABELS: Record<DetailStat, string> = {
  current: "Atual",
  target: "Meta",
  attainment: "Atingimento",
  average: "Média 12m",
  delta: "Variação mês",
};

/** Canonical order for rendering + the picker. */
export const DETAIL_STAT_ORDER: DetailStat[] = ["current", "target", "attainment", "average", "delta"];

/** Default stat cards (the historical set). */
export const DEFAULT_DETAIL_STATS: DetailStat[] = ["current", "target", "attainment", "average"];

/** localStorage preference key for the detail-modal stat selection. */
export const DETAIL_STATS_PREF_KEY = "cidades.detalhe.stats";
