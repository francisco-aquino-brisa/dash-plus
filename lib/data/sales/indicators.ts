// Indicator catalog for the Vendas · Canais blocks (Banda Larga + 5G).
//
// Mirrors lib/data/cities/indicators.ts, but the sources are the OFFICIAL,
// channel-grained tables (not the city cubes), all verified read-only against the
// warehouse — see docs/data-map.md and the `indicadores_servicos` /
// `meta_geral_canais` catalogs:
//   - waves    → waves_consolidado_orcamento  (funil + receita/ticket BL)
//   - cinco_g  → consolidado_5g_pedido         (ativações/chip/avulso + receita 5G)
//   - churn_bl → waves_churnsafra_consultor    (Churn Safra BL)
//   - churn_5g → churn_vendedor_5g             (Churn Safra 5G c/ e s/ bloqueio)
//
// IMPORTANT: `desempenho_hc` (the previous funnel source) SUBCONTA — its BL funnel
// (~16.7k criadas, jun/2026) and `5g_ativacao` (~30k) are far below the official
// counts (waves 54.444; consolidado_5g VE04 80.642) that the channel metas
// (`meta_geral_canais`) are calibrated against. So blocks read the official
// sources; desempenho_hc stays only for the other sections (PDU/Análise/Livre).
//
// Each indicator declares a self-contained SQL aggregate (`valueExpr`) evaluated
// per month group over its source. Indicators sharing a source are batched into
// one query (see databricks.ts). Indicators without a channel-grained source
// (churn por cidade, portabilidade 5G oficial) carry `available: false` and render
// as "Sem acesso aos dados" — decision recorded with the data team.

export type SalesBlock = "banda-larga" | "5g";
export type SalesUnit = "qtd" | "percent" | "currency";
/** "up" = maior é melhor; "down" = menor é melhor (churn). */
export type Polarity = "up" | "down";
export type SalesSource = "waves" | "cinco_g" | "churn_bl" | "churn_5g" | "portab";

/** How the card's meta (and history-target line) is resolved. */
export type SalesMeta =
  /** meta_geral_canais, matched by id_indicador label + servico scope of the block. */
  | { kind: "funnel"; indicador: string }
  /** metas_canais_ticket_oferta (tipo GERAL), matched by servico scope. */
  | { kind: "ticketOferta" };

export interface SalesIndicatorDef {
  /** Catalog id (VE01, RE01, CA08 …). Unique within a block. */
  id: string;
  block: SalesBlock;
  label: string;
  categoria: "venda" | "receita" | "cancelamento";
  unit: SalesUnit;
  polarity: Polarity;
  /** false → no channel-grained source yet; renders disabled. */
  available: boolean;
  /** Source table key (absent when unavailable). */
  source?: SalesSource;
  /** SQL aggregate producing the value for a month group (absent when unavailable). */
  valueExpr?: string;
  /** Meta lookup (absent → card shows Real only, per the data-team rule). */
  meta?: SalesMeta;
  /** Readable formula for the InfoHint tooltip. */
  description: string;
}

/** Composite key so ids shared across blocks (RE01, RE04, CA09) stay distinct. */
export function indicatorKey(block: SalesBlock, id: string): string {
  return `${block}:${id}`;
}

export function decimalsFor(unit: SalesUnit): number {
  return unit === "qtd" ? 0 : unit === "percent" ? 1 : 2;
}

// ── Reusable SQL fragments ───────────────────────────────────────────────────
// waves: funil por status cumulativo, dedup por orçamento; receita = AVG/SUM
// sobre as linhas do mês (validado vs Cidades: ticket entrada R$87,61, fat.
// entrada R$11,16mi em jun/2026). Escopo de fonte (corp=NAO, INTERNET+FWA) é
// aplicado na query, não aqui.
const W_CRIADAS = "COUNT(DISTINCT orcamento_id)";
const W_EFET = "COUNT(DISTINCT CASE WHEN status_venda IN ('EFETIVADO','INSTALADO') THEN orcamento_id END)";
const W_INST = "COUNT(DISTINCT CASE WHEN status_venda = 'INSTALADO' THEN orcamento_id END)";
const ratioPct = (num: string, den: string) => `ROUND(${num} * 100.0 / NULLIF(${den}, 0), 1)`;
// 5G preços são decimais com vírgula.
const G5_PROMO = "CAST(replace(preco_promocional, ',', '.') AS DOUBLE)";
const G5_OFERTA = "CAST(replace(preco_oferta, ',', '.') AS DOUBLE)";
const dedup5g = (when: string) => `COUNT(DISTINCT CASE WHEN ${when} THEN n_do_pedido END)`;

// ── Banda Larga (INTERNET + FWA) ─────────────────────────────────────────────
export const BANDA_LARGA: SalesIndicatorDef[] = [
  {
    id: "VE01",
    block: "banda-larga",
    label: "Vendas Criadas",
    categoria: "venda",
    unit: "qtd",
    polarity: "up",
    available: true,
    source: "waves",
    valueExpr: W_CRIADAS,
    meta: { kind: "funnel", indicador: "Vendas Criadas" },
    description: "Contagem distinta de orçamentos no mês (corporativo = NÃO; serviço INTERNET/FWA).",
  },
  {
    id: "VE02",
    block: "banda-larga",
    label: "Vendas Efetivadas",
    categoria: "venda",
    unit: "qtd",
    polarity: "up",
    available: true,
    source: "waves",
    valueExpr: W_EFET,
    meta: { kind: "funnel", indicador: "Vendas Efetivadas" },
    description: "Orçamentos com status EFETIVADO ou INSTALADO (contagem distinta) no mês.",
  },
  {
    id: "VE03",
    block: "banda-larga",
    label: "Vendas Instaladas",
    categoria: "venda",
    unit: "qtd",
    polarity: "up",
    available: true,
    source: "waves",
    valueExpr: W_INST,
    meta: { kind: "funnel", indicador: "Vendas Instaladas" },
    description: "Orçamentos com status INSTALADO (contagem distinta) no mês.",
  },
  {
    id: "VE05",
    block: "banda-larga",
    label: "Efetivados x Criado",
    categoria: "venda",
    unit: "percent",
    polarity: "up",
    available: true,
    source: "waves",
    valueExpr: ratioPct(W_EFET, W_CRIADAS),
    description: "Vendas efetivadas ÷ vendas criadas no mês (conversão do funil).",
  },
  {
    id: "VE06",
    block: "banda-larga",
    label: "Instalados x Efetivados",
    categoria: "venda",
    unit: "percent",
    polarity: "up",
    available: true,
    source: "waves",
    valueExpr: ratioPct(W_INST, W_EFET),
    description: "Vendas instaladas ÷ vendas efetivadas no mês (conclusão do funil).",
  },
  {
    id: "RE01",
    block: "banda-larga",
    label: "Ticket Médio Entrada",
    categoria: "receita",
    unit: "currency",
    polarity: "up",
    available: true,
    source: "waves",
    valueExpr: "AVG(CAST(valor_com_desconto AS DOUBLE))",
    description: "Média do valor com desconto das vendas BL do mês (corporativo = NÃO; INTERNET/FWA).",
  },
  {
    id: "RE02",
    block: "banda-larga",
    label: "Ticket Médio Oferta",
    categoria: "receita",
    unit: "currency",
    polarity: "up",
    available: true,
    source: "waves",
    valueExpr: "AVG(CAST(valor AS DOUBLE))",
    meta: { kind: "ticketOferta" },
    description: "Média do valor de oferta (tabela) das vendas BL do mês.",
  },
  {
    id: "RE03",
    block: "banda-larga",
    label: "Ticket Médio Ponderada",
    categoria: "receita",
    unit: "currency",
    polarity: "up",
    available: true,
    source: "waves",
    valueExpr: "AVG(CAST(ticket_ponderado AS DOUBLE))",
    description: "Média do ticket ponderado das vendas BL do mês.",
  },
  {
    id: "RE04",
    block: "banda-larga",
    label: "Faturamento de Entrada",
    categoria: "receita",
    unit: "currency",
    polarity: "up",
    available: true,
    source: "waves",
    valueExpr: "SUM(CAST(valor_com_desconto AS DOUBLE))",
    description: "Soma do valor com desconto das vendas BL do mês.",
  },
  {
    id: "RE05",
    block: "banda-larga",
    label: "Faturamento de Oferta",
    categoria: "receita",
    unit: "currency",
    polarity: "up",
    available: true,
    source: "waves",
    valueExpr: "SUM(CAST(valor AS DOUBLE))",
    description: "Soma do valor de oferta (tabela) das vendas BL do mês.",
  },
  {
    id: "RE03f",
    block: "banda-larga",
    label: "Faturamento de Ponderado",
    categoria: "receita",
    unit: "currency",
    polarity: "up",
    available: true,
    source: "waves",
    valueExpr: "SUM(CAST(ticket_ponderado AS DOUBLE))",
    description: "Soma do ticket ponderado das vendas BL do mês.",
  },
  {
    id: "CA08",
    block: "banda-larga",
    label: "Churn Safra",
    categoria: "cancelamento",
    unit: "percent",
    polarity: "down",
    available: true,
    source: "churn_bl",
    valueExpr: "SUM(cancelamentos) * 100.0 / NULLIF(SUM(instalacoes), 0)",
    description: "Cancelamentos ÷ instalações da safra (waves_churnsafra_consultor). Menor é melhor.",
  },
  // ── Sem fonte no grão de canal (validado) → "sem acesso" ──
  {
    id: "VE07",
    block: "banda-larga",
    label: "Vendas criadas avulso",
    categoria: "venda",
    unit: "qtd",
    polarity: "up",
    available: false,
    description: "Vendas criadas avulsas (não-combo). Aguardando definição da flag de avulso.",
  },
  {
    id: "VE08",
    block: "banda-larga",
    label: "Vendas efetivadas avulso",
    categoria: "venda",
    unit: "qtd",
    polarity: "up",
    available: false,
    description: "Vendas efetivadas avulsas. Aguardando definição da flag de avulso.",
  },
  {
    id: "VE09",
    block: "banda-larga",
    label: "Vendas instaladas avulso",
    categoria: "venda",
    unit: "qtd",
    polarity: "up",
    available: false,
    description: "Vendas instaladas avulsas. Aguardando definição da flag de avulso.",
  },
  {
    id: "VE05c",
    block: "banda-larga",
    label: "Efetivados x Criado competência",
    categoria: "venda",
    unit: "percent",
    polarity: "up",
    available: false,
    description: "Conversão na competência de criação. Aguardando definição de competência por canal.",
  },
  {
    id: "VE06c",
    block: "banda-larga",
    label: "Instalados x Efetivados competência",
    categoria: "venda",
    unit: "percent",
    polarity: "up",
    available: false,
    description: "Conclusão na competência. Aguardando definição de competência por canal.",
  },
  {
    id: "CA03",
    block: "banda-larga",
    label: "Churn rate",
    categoria: "cancelamento",
    unit: "percent",
    polarity: "down",
    available: false,
    description: "Cancelamentos ÷ base ativa anterior. Só existe por cidade (sem grão de canal).",
  },
  {
    id: "CA09",
    block: "banda-larga",
    label: "Churn safra cidade",
    categoria: "cancelamento",
    unit: "percent",
    polarity: "down",
    available: false,
    description: "Churn da safra de 4 meses por cidade. Só existe por cidade (sem grão de canal).",
  },
];

// ── 5G ───────────────────────────────────────────────────────────────────────
export const CINCO_G: SalesIndicatorDef[] = [
  {
    id: "VE04",
    block: "5g",
    label: "Vendas Ativadas",
    categoria: "venda",
    unit: "qtd",
    polarity: "up",
    available: true,
    source: "cinco_g",
    valueExpr: "COUNT(DISTINCT n_do_pedido)",
    meta: { kind: "funnel", indicador: "Vendas Ativadas" },
    description: "Contagem distinta de pedidos 5G no mês (consolidado_5g_pedido).",
  },
  {
    id: "VE27",
    block: "5g",
    label: "Vendas Ativadas Chip Combo",
    categoria: "venda",
    unit: "qtd",
    polarity: "up",
    available: true,
    source: "cinco_g",
    valueExpr: dedup5g("combo_ftth_5g = 'SIM'"),
    description: "Pedidos 5G em combo com FTTH (combo_ftth_5g = SIM), contagem distinta.",
  },
  {
    id: "VE51",
    block: "5g",
    label: "Ativação 5G avulso",
    categoria: "venda",
    unit: "qtd",
    polarity: "up",
    available: true,
    source: "cinco_g",
    valueExpr: dedup5g("combo_ftth_5g = 'NAO'"),
    description: "Pedidos 5G avulsos (combo_ftth_5g = NÃO), contagem distinta.",
  },
  {
    id: "VE28",
    block: "5g",
    label: "Chip pago",
    categoria: "venda",
    unit: "qtd",
    polarity: "up",
    available: true,
    source: "cinco_g",
    valueExpr: dedup5g("tipo_chip = 'chip pago'"),
    description: "Pedidos 5G com chip pago (contagem distinta).",
  },
  {
    id: "VE29",
    block: "5g",
    label: "Chip gratis",
    categoria: "venda",
    unit: "qtd",
    polarity: "up",
    available: true,
    source: "cinco_g",
    valueExpr: dedup5g("tipo_chip = 'chip gratis'"),
    description: "Pedidos 5G com chip grátis (contagem distinta).",
  },
  {
    id: "RE01",
    block: "5g",
    label: "Ticket Médio Entrada",
    categoria: "receita",
    unit: "currency",
    polarity: "up",
    available: true,
    source: "cinco_g",
    valueExpr: `AVG(${G5_PROMO})`,
    description: "Média do preço promocional (entrada) dos pedidos 5G do mês.",
  },
  {
    id: "RE02",
    block: "5g",
    label: "Ticket Médio Oferta",
    categoria: "receita",
    unit: "currency",
    polarity: "up",
    available: true,
    source: "cinco_g",
    valueExpr: `AVG(${G5_OFERTA})`,
    meta: { kind: "ticketOferta" },
    description: "Média do preço de oferta dos pedidos 5G do mês.",
  },
  {
    id: "RE04",
    block: "5g",
    label: "Faturamento de Entrada",
    categoria: "receita",
    unit: "currency",
    polarity: "up",
    available: true,
    source: "cinco_g",
    valueExpr: `SUM(${G5_PROMO})`,
    description: "Soma do preço promocional (entrada) dos pedidos 5G do mês.",
  },
  {
    id: "RE05",
    block: "5g",
    label: "Faturamento de Oferta",
    categoria: "receita",
    unit: "currency",
    polarity: "up",
    available: true,
    source: "cinco_g",
    valueExpr: `SUM(${G5_OFERTA})`,
    description: "Soma do preço de oferta dos pedidos 5G do mês.",
  },
  {
    id: "CA10",
    block: "5g",
    label: "Churn Safra com Bloqueio",
    categoria: "cancelamento",
    unit: "percent",
    polarity: "down",
    available: true,
    source: "churn_5g",
    valueExpr: "(SUM(bloqueados) + SUM(cancelados)) * 100.0 / NULLIF(SUM(entrantes), 0)",
    description: "(Bloqueados + Cancelados) ÷ entrantes da safra (churn_vendedor_5g). Menor é melhor.",
  },
  {
    id: "CA09",
    block: "5g",
    label: "Churn Safra sem bloqueio",
    categoria: "cancelamento",
    unit: "percent",
    polarity: "down",
    available: true,
    source: "churn_5g",
    valueExpr: "SUM(cancelados) * 100.0 / NULLIF(SUM(entrantes) + SUM(bloqueados), 0)",
    description: "Cancelados ÷ (entrantes + bloqueados) da safra (churn_vendedor_5g). Menor é melhor.",
  },
  // ── Sem fonte no grão de canal (validado) → "sem acesso" ──
  {
    id: "CA03",
    block: "5g",
    label: "Churn rate",
    categoria: "cancelamento",
    unit: "percent",
    polarity: "down",
    available: false,
    description: "Cancelamentos ÷ base ativa anterior. Só existe por cidade (sem grão de canal).",
  },
  {
    id: "CA08c",
    block: "5g",
    label: "Churn safra cidade",
    categoria: "cancelamento",
    unit: "percent",
    polarity: "down",
    available: false,
    description: "Churn da safra de 4 meses por cidade. Só existe por cidade (sem grão de canal).",
  },
  {
    id: "CA01",
    block: "5g",
    label: "Churn 5G - Com consumo",
    categoria: "cancelamento",
    unit: "percent",
    polarity: "down",
    available: false,
    description: "Cancelamentos com consumo ÷ base ativa anterior. Só existe por cidade.",
  },
  {
    id: "CA02",
    block: "5g",
    label: "Churn 5G - Sem consumo",
    categoria: "cancelamento",
    unit: "percent",
    polarity: "down",
    available: false,
    description: "Cancelamentos sem consumo ÷ base ativa anterior. Só existe por cidade.",
  },
  {
    id: "VE32",
    block: "5g",
    label: "Portabilidade",
    categoria: "venda",
    unit: "qtd",
    polarity: "up",
    available: true,
    source: "portab",
    valueExpr: "SUM(portado)",
    description:
      "Portabilidades 5G concluídas no mês (STATUS PORTADO, deduplicado por N_do_pedido). Fonte: portabilidade.",
  },
  {
    id: "VE33",
    block: "5g",
    label: "Portabilidade Pendente",
    categoria: "venda",
    unit: "qtd",
    polarity: "down",
    available: true,
    source: "portab",
    valueExpr: "SUM(1 - portado)",
    description:
      "Portabilidades 5G solicitadas sem concluir a portagem (dedup por N_do_pedido). Menor é melhor. Fonte: portabilidade.",
  },
  {
    // Cross-source: concluídas (portabilidade) ÷ ativações 5G (VE04, consolidado_5g_pedido).
    // Sem source/valueExpr — a série é montada no adapter a partir de VE32 e VE04.
    id: "VE34",
    block: "5g",
    label: "% Portabilidade (Concluída x Ativações 5G)",
    categoria: "venda",
    unit: "percent",
    polarity: "up",
    available: true,
    description:
      "Portabilidades concluídas ÷ ativações 5G (VE04) × 100. Fonte: portabilidade + consolidado_5g_pedido.",
  },
  {
    id: "VE35",
    block: "5g",
    label: "% Portabilidade (Concluída x Solicitada)",
    categoria: "venda",
    unit: "percent",
    polarity: "up",
    available: true,
    source: "portab",
    valueExpr: ratioPct("SUM(portado)", "COUNT(*)"),
    description:
      "Portabilidades concluídas ÷ solicitadas × 100 (STATUS PORTADO ÷ total de pedidos). Fonte: portabilidade.",
  },
];

export const SALES_INDICATORS: Record<SalesBlock, SalesIndicatorDef[]> = {
  "banda-larga": BANDA_LARGA,
  "5g": CINCO_G,
};

/** Default visible cards per block (first visit) — só disponíveis. */
export const DEFAULT_SELECTION: Record<SalesBlock, string[]> = {
  "banda-larga": ["VE01", "VE02", "VE03", "RE01", "CA08"],
  "5g": ["VE04", "RE01", "RE04", "VE28", "CA10"],
};

/** localStorage keys for the per-block selection (see usePreference). */
export const SELECTION_PREF_KEY: Record<SalesBlock, string> = {
  "banda-larga": "vendas.blocos.banda-larga.selecionados",
  "5g": "vendas.blocos.5g.selecionados",
};

// ── View-model assembly (shared by the mock and Databricks paths) ─────────────

/** One point of the card's 12-month history (feeds HistoryChart directly). */
export interface SalesSeriesPoint {
  mes: string; // yyyy-MM (HistoryChart formats it)
  valor: number;
  target?: number | null;
}

/** A resolved indicator card: value + meta + 12-month Real×Meta history. */
export interface SalesIndicatorVM {
  id: string;
  block: SalesBlock;
  label: string;
  categoria: string;
  unit: SalesUnit;
  decimals: number;
  polarity: Polarity;
  available: boolean;
  value: number;
  meta: number | null;
  attainment: number | null;
  delta: number; // % vs mês anterior
  description: string;
  series: SalesSeriesPoint[];
}

/** % change of `cur` vs `prev` (prev 0 → 0), rounded to 1 decimal. */
function deltaPct(cur: number, prev: number): number {
  return prev === 0 ? 0 : +(((cur - prev) / Math.abs(prev)) * 100).toFixed(1);
}

/**
 * Build a card VM from a monthly Real series and a month→meta map. The headline
 * uses `competenciaYm` (the month of the selected period), the chart shows the
 * trailing series with the meta overlaid, and the delta is that month vs the
 * previous point. Unavailable indicators short-circuit to an empty card.
 */
export function buildSalesVM(
  def: SalesIndicatorDef,
  realByMonth: Map<string, number>,
  metaByMonth: Map<string, number>,
  competenciaYm: string,
): SalesIndicatorVM {
  const decimals = decimalsFor(def.unit);
  const base = {
    id: def.id,
    block: def.block,
    label: def.label,
    categoria: def.categoria,
    unit: def.unit,
    decimals,
    polarity: def.polarity,
    description: def.description,
  };

  if (!def.available) {
    return { ...base, available: false, value: 0, meta: null, attainment: null, delta: 0, series: [] };
  }

  const months = [...realByMonth.keys()].sort();
  const series: SalesSeriesPoint[] = months.map((mes) => ({
    mes,
    valor: realByMonth.get(mes) ?? 0,
    target: metaByMonth.get(mes) ?? null,
  }));

  const idx = months.indexOf(competenciaYm);
  const at = idx >= 0 ? idx : months.length - 1;
  const value = at >= 0 ? (realByMonth.get(months[at]) ?? 0) : 0;
  const prev = at > 0 ? (realByMonth.get(months[at - 1]) ?? 0) : 0;
  const meta = at >= 0 ? (metaByMonth.get(months[at]) ?? null) : null;
  const attainment = meta && meta > 0 ? +((value / meta) * 100).toFixed(1) : null;

  return { ...base, available: true, value, meta, attainment, delta: deltaPct(value, prev), series };
}
