// Domain types for the Commercial Productivity screen (Tela 2).
//
// Reuses KpiBlock + PduPoint from the sales screen (same shapes). Real data comes
// from desempenho_hc (funnel + 5G per vendedor) and vw_hc_zerado_vendedor (PDU).
// Blocked (no accessible source): Ticket Médio, Churn Safra, plano mix, and the
// TAM-by-meta quintiles (no per-vendedor meta) → rendered as "sem acesso".

import type { KpiBlock, PduPoint } from "../sales/types";

export type { KpiBlock, PduPoint } from "../sales/types";

/** Externas = field hierarchy; Canais = channel hierarchy. */
export type ManagementMode = "externas" | "canais";

export interface ProdFilters {
  from: string; // ISO yyyy-MM-dd
  to: string; // ISO yyyy-MM-dd
  mode: ManagementMode;
  servico: string; // "" = Todos (INTERNET | FWA | 5G)
  // Externas hierarchy
  gerencia: string;
  coordenacao: string;
  // Canais hierarchy
  gerente: string;
  nicho: string;
  // Common
  cidade: string;
}

export interface VendedorRow {
  nome: string;
  /** Channel (canais mode) or supervisão (externas mode) — context label. */
  grupo: string;
  cidade: string;
  criado: number;
  efetivado: number;
  instalado: number;
  ativ5g: number;
  efetVsCriado: number; // %
  instVsEfet: number; // %
}

export interface ProdFilterOptions {
  servicos: string[];
  // Externas
  gerencias: string[];
  coordenacoes: string[];
  // Canais
  gerentes: string[];
  nichos: string[];
  cidades: string[];
}

export interface ProdView {
  source: "mock" | "databricks";
  filters: ProdFilters;
  periodLabel: string;
  /** KPI cards (funnel + 5G real; ticket/churn blocked). */
  indicadores: KpiBlock[];
  /** Top vendedores by the funnel in the selected period. */
  ranking: VendedorRow[];
  /** Official PDU by technology, per month. */
  pdu: PduPoint[];
  /** TAM-by-meta quintiles need a per-vendedor meta we don't have access to. */
  tamAvailable: boolean;
  watermark: string;
}

export const MANAGEMENT_MODES: { key: ManagementMode; label: string }[] = [
  { key: "externas", label: "Vendas Externas" },
  { key: "canais", label: "Canais" },
];
