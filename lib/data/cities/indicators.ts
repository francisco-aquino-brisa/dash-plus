// Indicator catalog for the Performance Cidades blocks (Banda Larga + 5G).
//
// Source of truth for WHAT is selectable per block. Each id_indicador maps onto
// the wide `indicadores_cidades` / `indicadores_cidades_5g` columns the app
// already loads. Indicators whose realizado has no source column carry
// `available: false` and render as "Sem acesso aos dados" (mirrors the mockup).
//
// Metas come exclusively from `metas_cidades` (long-format), joined by
// (metaId, servico, cidade, competência). `metaId` is usually the same id; when
// undefined the card shows the realizado with no target/atingimento.
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
  /** (Σnum / Σden) × 100 — recomputed from summed components, never averaged. */
  | { kind: "ratio"; num: NumField; den: NumField }
  /** (base_ativa + fechados) − same of previous month. Needs prev-month rows. */
  | { kind: "growthBase" };

export interface IndicatorDef {
  id: string;
  block: IndicatorBlock;
  label: string;
  unit: IndicatorUnit;
  polarity: Polarity;
  available: boolean;
  /** Absent when `available` is false. */
  compute?: IndicatorCompute;
  /** id_indicador to look up in metas_cidades; absent → no meta. */
  metaId?: string;
  /** Which metas_cidades.servico row applies at the aggregate (block) level. */
  metaServico?: "Banda Larga" | "5G";
  /** Readable formula for the InfoHint tooltip. */
  description: string;
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
  { id: "BA01", block: "banda-larga", label: "Base Ativa", unit: "qtd", polarity: "up", available: true,
    compute: { kind: "sum", field: "base_ativa" },
    description: "Soma da base de clientes ativos no mês (Soma[base_ativa])." },
  { id: "BA02", block: "banda-larga", label: "Crescimento Base Ativa", unit: "qtd", polarity: "up", available: true,
    compute: { kind: "sum", field: "crescimento" },
    description: "Soma do crescimento de clientes ativos no mês (Soma[crescimento])." },
  { id: "BA03", block: "banda-larga", label: "Base Fechada", unit: "qtd", polarity: "down", available: true,
    compute: { kind: "sum", field: "fechados" }, metaId: "BA03", metaServico: "Banda Larga",
    description: "Soma de clientes fechados no mês (Soma[fechados]). Menor é melhor." },
  { id: "BA04", block: "banda-larga", label: "Crescimento Base", unit: "qtd", polarity: "up", available: true,
    compute: { kind: "growthBase" }, metaId: "BA04", metaServico: "Banda Larga",
    description: "(Base Ativa + Fechados) do mês − (Base Ativa + Fechados) do mês anterior." },
  { id: "BA10", block: "banda-larga", label: "Clientes Bloqueados", unit: "qtd", polarity: "down", available: true,
    compute: { kind: "sum", field: "bloqueados" },
    description: "Soma de clientes bloqueados no mês (Soma[bloqueados])." },
  { id: "BA11", block: "banda-larga", label: "Desativados Automáticos", unit: "qtd", polarity: "down", available: true,
    compute: { kind: "sum", field: "desativado_auto" },
    description: "Soma de clientes desativados automaticamente (Soma[desativado_auto])." },
  { id: "BA12", block: "banda-larga", label: "Desativados Solicitados", unit: "qtd", polarity: "down", available: true,
    compute: { kind: "sum", field: "desativado_s" },
    description: "Soma de clientes desativados a pedido do cliente (Soma[desativado_s])." },
  { id: "BA13", block: "banda-larga", label: "Reativação de Bloqueados", unit: "percent", polarity: "up", available: true,
    compute: { kind: "ratio", num: "reativacoes_bloqueados", den: "bloqueados" },
    description: "Reativações de bloqueados ÷ total de bloqueados × 100." },
  { id: "CA03", block: "banda-larga", label: "Churn Rate", unit: "percent", polarity: "down", available: true,
    compute: { kind: "ratio", num: "cancelamentos", den: "base_ativa" }, metaId: "CA03", metaServico: "Banda Larga",
    description: "Cancelamentos do mês ÷ base ativa × 100. Menor é melhor." },
  { id: "CA04", block: "banda-larga", label: "Churn Safra Cidade", unit: "percent", polarity: "down", available: true,
    compute: { kind: "ratio", num: "cancelados_4_mes", den: "instalados_4_mes" },
    description: "Cancelados ÷ instalações da safra instalada há 4 meses × 100. Menor é melhor." },
  { id: "VE01", block: "banda-larga", label: "Vendas Criadas", unit: "qtd", polarity: "up", available: true,
    compute: { kind: "sum", field: "vendas_criadas" }, metaId: "VE01", metaServico: "Banda Larga",
    description: "Contagem de pedidos criados no período (orcamentos)." },
  { id: "VE02", block: "banda-larga", label: "Vendas Efetivadas", unit: "qtd", polarity: "up", available: true,
    compute: { kind: "sum", field: "vendas_efetivadas" }, metaId: "VE02", metaServico: "Banda Larga",
    description: "Contagem de pedidos efetivados no período (orcamentos_efetivados)." },
  { id: "VE03", block: "banda-larga", label: "Vendas Instaladas", unit: "qtd", polarity: "up", available: true,
    compute: { kind: "sum", field: "vendas_instaladas" }, metaId: "VE03", metaServico: "Banda Larga",
    description: "Contagem de instalações concluídas no período (instalacoes)." },
  { id: "VE05", block: "banda-larga", label: "Efetivados x Criado", unit: "percent", polarity: "up", available: true,
    compute: { kind: "ratio", num: "vendas_efetivadas", den: "vendas_criadas" }, metaId: "VE05", metaServico: "Banda Larga",
    description: "Vendas Efetivadas ÷ Vendas Criadas × 100." },
  { id: "VE06", block: "banda-larga", label: "Instalados x Efetivados", unit: "percent", polarity: "up", available: true,
    compute: { kind: "ratio", num: "vendas_instaladas", den: "vendas_efetivadas" }, metaId: "VE06", metaServico: "Banda Larga",
    description: "Vendas Instaladas ÷ Vendas Efetivadas × 100." },
  BLOCKED("RE01", "banda-larga", "Ticket Médio Entrada", "currency", "up",
    "Ticket médio de entrada. Fonte de dados ainda não disponível no cubo de cidades."),
  BLOCKED("RE04", "banda-larga", "Faturamento de Entrada", "currency", "up",
    "Faturamento de entrada. Fonte de dados ainda não disponível no cubo de cidades."),
];

// ── 5G ───────────────────────────────────────────────────────────────────────
const CINCO_G: IndicatorDef[] = [
  { id: "BA02", block: "5g", label: "Crescimento Base Ativa", unit: "qtd", polarity: "up", available: true,
    compute: { kind: "sum", field: "crescimento" }, metaId: "BA02", metaServico: "5G",
    description: "Soma do crescimento da base ativa 5G no mês (Soma[crescimento])." },
  { id: "CA01", block: "5g", label: "Churn 5G — Com Consumo", unit: "qtd", polarity: "down", available: true,
    compute: { kind: "sum", field: "cancelamentos_com_consumo" },
    description: "Cancelamentos 5G do mês com consumo (Soma[cancel_com_consumo])." },
  { id: "CA02", block: "5g", label: "Churn 5G — Sem Consumo", unit: "qtd", polarity: "down", available: true,
    compute: { kind: "sum", field: "cancelamentos_sem_consumo" },
    description: "Cancelamentos 5G do mês sem consumo (Soma[cancel_sem_consumo])." },
  { id: "CA03", block: "5g", label: "Churn Rate", unit: "percent", polarity: "down", available: true,
    compute: { kind: "ratio", num: "cancelamentos", den: "base_ativa_anterior" }, metaId: "CA03", metaServico: "5G",
    description: "Cancelamentos 5G do mês ÷ base ativa do mês anterior × 100. Menor é melhor." },
  { id: "CA09", block: "5g", label: "Churn Safra Cidade", unit: "percent", polarity: "down", available: true,
    compute: { kind: "ratio", num: "cancelados_4_mes", den: "instalados_4_mes" },
    description: "Cancelados ÷ instalações da safra 5G instalada há 4 meses × 100. Menor é melhor." },
  { id: "VE04", block: "5g", label: "Vendas Ativadas", unit: "qtd", polarity: "up", available: true,
    compute: { kind: "sum", field: "ativacao_mes" }, metaId: "VE04", metaServico: "5G",
    description: "Contagem de ativações 5G no mês (Soma[ativacao_mes])." },
  { id: "VE27", block: "5g", label: "Vendas Ativadas Chip Combo", unit: "qtd", polarity: "up", available: true,
    compute: { kind: "sum", field: "chips_combo" },
    description: "Contagem de chips 5G ativados em combo (Soma[chips_combo])." },
  { id: "CA12", block: "5g", label: "Cancelamento Mês", unit: "qtd", polarity: "down", available: true,
    compute: { kind: "sum", field: "cancelamentos" }, metaId: "CA12", metaServico: "5G",
    description: "Total de cancelamentos 5G no mês (Soma[cancelamento_mes]). Menor é melhor." },
  BLOCKED("VE32", "5g", "Portabilidade", "qtd", "up",
    "Portabilidades 5G concluídas. Fonte portabilidade_5g ainda não integrada."),
  BLOCKED("VE33", "5g", "Portabilidade Pendente", "qtd", "down",
    "Portabilidades 5G pendentes. Fonte portabilidade_5g ainda não integrada."),
  BLOCKED("VE34", "5g", "% Portabilidade (Concluída x Ativações 5G)", "percent", "up",
    "Portabilidades concluídas ÷ ativações 5G × 100. Fonte portabilidade_5g ainda não integrada."),
  BLOCKED("VE35", "5g", "% Portabilidade (Concluída x Solicitada)", "percent", "up",
    "Portabilidades concluídas ÷ solicitadas × 100. Fonte portabilidade_5g ainda não integrada."),
  BLOCKED("RE01", "5g", "Ticket Médio Entrada", "currency", "up",
    "Ticket médio de entrada 5G. Fonte de dados ainda não disponível no cubo de cidades."),
  BLOCKED("RE02", "5g", "Ticket Médio Oferta", "currency", "up",
    "Ticket médio de oferta 5G. Fonte de dados ainda não disponível no cubo de cidades."),
  BLOCKED("RE04", "5g", "Faturamento de Entrada", "currency", "up",
    "Faturamento de entrada 5G. Fonte de dados ainda não disponível no cubo de cidades."),
  BLOCKED("RE05", "5g", "Faturamento de Oferta", "currency", "up",
    "Faturamento de oferta 5G. Fonte de dados ainda não disponível no cubo de cidades."),
  BLOCKED("CA10", "5g", "Churn Safra com Bloqueio", "percent", "down",
    "Churn safra 5G considerando bloqueios. Fonte churn_vendedor_5g ainda não integrada."),
  BLOCKED("VE51", "5g", "Ativação 5G Avulso", "qtd", "up",
    "Ativações 5G avulsas (fora de combo). Fonte de dados ainda não disponível no cubo de cidades."),
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
