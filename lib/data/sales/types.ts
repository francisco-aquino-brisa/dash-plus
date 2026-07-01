// Domain types for the Sales · Channels screen (Tela 3).
//
// Business rule: Banda Larga = INTERNET (FTTH) + FWA. 5G is independent.
// KPIs whose real source is blocked/missing carry `available: false` and render
// as "sem acesso aos dados" (see docs/pending-data-checklist.md).

export type Unit = "n" | "currency" | "percent";
export type StatusVenda = "criado" | "efetivado" | "instalado";

export interface KpiBlock {
  label: string;
  value: number;
  meta: number;
  unit?: Unit;
  delta: number; // % vs previous period
  helper?: string;
  /** false → data not accessible yet; card renders disabled. */
  available: boolean;
}

export interface CanalDelta {
  canal: string;
  gerente: string;
  mediaDia: number;
  vsMesAnterior: number;
  vsSemanaAnterior: number;
}

export interface PduPoint {
  mes: string;
  FTTH: number;
  FWA: number;
  "5G": number;
}

export interface FreeIndicator {
  nome: string;
  available: boolean;
}

export interface SalesFilters {
  /** Period preset key (see SalesFilterOptions.periods) or "custom". */
  period: string;
  from?: string; // ISO date, when period = "custom"
  to?: string;
  servico: string; // "" = Todos
  gerente: string;
  canal: string;
  nicho: string;
  uf: string;
  cidade: string;
  tipo: string;
}

export interface SalesFilterOptions {
  periods: { key: string; label: string }[];
  servicos: string[];
  gerentes: string[];
  canais: string[];
  nichos: string[];
  ufs: string[];
  cidades: string[];
  /** Cities grouped by UF, so the Cidade filter narrows to the selected state. */
  cidadesByUf: Record<string, string[]>;
  tipos: string[];
}

export interface SalesView {
  filters: SalesFilters;
  meses: string[];
  source: "mock" | "databricks";
  periodLabel: string;
  kpisBL: KpiBlock[];
  kpis5G: KpiBlock[];
  /** PDU (produção realizada / HC ativo / dia útil) by technology, per month. */
  pdu: PduPoint[];
  canais: {
    canal: { bl: CanalDelta[]; g5: CanalDelta[] };
    nicho: { bl: CanalDelta[]; g5: CanalDelta[] };
  };
  freeIndicators: FreeIndicator[];
  freeSeries: Record<string, { mes: string; valor: number }[]>;
  /** Source freshness signal (see ADR 0002). */
  watermark: string;
}

/** Indicators whose real source is blocked/missing → rendered as "sem acesso". */
export const BLOCKED_INDICATORS = new Set<string>([
  "% Portabilidade (Concluída x Ativ.)",
  "% Portabilidade (Concluída x Solic.)",
  "Churn Safra 5G c/ Bloqueio",
  "% Portabilidade - 5G",
  "Churn Safra c/ Bloqueio - 5G",
  "Combo 1 Chip - FTTH",
  "Combo 2 Chip - FTTH",
  "Combo 3+ Chip - FTTH",
]);

export const PERIODS = [
  { key: "mes_atual", label: "Mês atual" },
  { key: "mes_anterior", label: "Mês anterior" },
  { key: "7d", label: "Últimos 7 dias" },
  { key: "30d", label: "Últimos 30 dias" },
  { key: "90d", label: "Últimos 90 dias" },
  { key: "ano", label: "Ano" },
];
