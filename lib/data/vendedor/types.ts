// Domain types for the Dashboard Vendedor screen (Tela 4).
//
// A drill-down of ONE vendedor, keyed by `matricula` (the join key shared by
// desempenho_hc + vw_hc_zerado_vendedor). Sources (validated 2026-06-30):
//   - desempenho_hc         → profile, per-tech funnel, renovação, ranking, mix
//   - vw_hc_zerado_vendedor → official PDU + NDU (dias úteis) per serviço
// Per-vendedor metas do not exist → Meta/%/Falta/Quintil render under a flag.
// df_waves_vendas (orçamento grain) is frozen in 2025 → Pendências stays a
// placeholder. See docs/pending-data-checklist.md.

/** Service buckets shown as cards (Banda = BL = FTTH + FWA combined). */
export type ServicoKey = "FTTH" | "FWA" | "5G" | "Banda";

export interface VendedorFilters {
  /** Selected vendedor. "" = none selected yet (empty state). */
  matricula: string;
  /** Reference month as yyyy-MM. "" = latest available competência. */
  competencia: string;
}

/** Identity/header block for the selected vendedor. */
export interface VendedorProfile {
  matricula: number;
  nome: string;
  cidade: string; // "Cidade / UF" or "—"
  uf: string;
  canal: string;
  gerente: string;
  coordenacao: string;
  gerencia: string;
  supervisao: string;
  nicho: string;
  nivel: string;
  situacao: string; // ATIVO / FERIAS / INSS / ...
  tipoCidade: string;
  tempoEmpresa: string; // e.g. "0 anos 6 meses"
  admissao: string; // yyyy-MM-dd or ""
}

/** A single indicator line inside a service card. */
export interface ServicoIndicador {
  label: string;
  realizado: number;
  /** null → no per-vendedor meta (renders as "—" under the flag). */
  meta: number | null;
}

export interface ServicoCard {
  key: ServicoKey;
  label: string;
  /** Total realizado in the service (funnel "instalado" grain). */
  realizado: number;
  /** Official PDU (produção / dia útil) — pdu_acumulada_hc_ativo, per vendedor. */
  pdu: number;
  /** NDU = accumulated dias úteis (dias_uteis_acumulado). */
  ndu: number;
  criado: number;
  efetivado: number;
  instalado: number;
  /** Real indicators we can show for this service. */
  indicadores: ServicoIndicador[];
  /** Labels grouped under "outros indicadores aguardando meta/fonte". */
  aguardando: string[];
  /** false → Meta/%/Falta/Quintil disabled ("aguardando meta por vendedor"). */
  metaAvailable: boolean;
}

/** Per-day state for the Dias Zerados calendar. */
export type DiaStatus = "zerado" | "com_venda" | "feriado" | "futuro" | "sem_dado";

export interface DiaZerado {
  dia: number; // 1..31
  status: DiaStatus;
}

export interface DiasZeradosView {
  ano: number;
  mes: number; // 1..12
  /** Day-of-month "today" when competência is the current month, else null. */
  hoje: number | null;
  /** Count of zeroed days per service (+ "Todos"). */
  resumo: { servico: ServicoKey | "Todos"; dias: number }[];
  /** Zeroed day numbers per service key (and "Todos"). */
  zeradosPorServico: Record<string, number[]>;
  /** Days that had at least one sale, per service key (and "Todos"). */
  comVendaPorServico: Record<string, number[]>;
}

export interface RankingEscopo {
  escopo: "cidade" | "coordenacao" | "gerencia" | "geral";
  label: string;
  contexto: string; // e.g. the city/coordenação name, or "Brisanet"
  /** Position of the vendedor, or null when the scope is unknown. */
  posicao: number | null;
  total: number;
}

export interface RankingView {
  available: boolean;
  /** Metric the ranking is computed on (helper copy). */
  metrica: string;
  escopos: RankingEscopo[];
}

export type StatusVenda = "Criado" | "Efetivado" | "Instalado";

export interface MixItem {
  servico: ServicoKey | "Renovação";
  status: StatusVenda;
  vendas: number;
}

export interface VendedorView {
  source: "mock" | "databricks";
  filters: VendedorFilters;
  competenciaLabel: string; // "Junho 2026"
  /** null → no vendedor selected, or matricula not found in the competência. */
  profile: VendedorProfile | null;
  servicos: ServicoCard[];
  diasZerados: DiasZeradosView;
  ranking: RankingView;
  mix: MixItem[];
  /** Pendências source (df_waves_vendas) is frozen in 2025 → always false. */
  pendenciasAvailable: boolean;
  watermark: string;
}

export interface VendedorOption {
  matricula: number;
  nome: string;
  cidade: string;
}

export interface VendedorFilterOptions {
  vendedores: VendedorOption[];
  /** Available competências as yyyy-MM, newest first. */
  competencias: string[];
}

export const SERVICOS: { key: ServicoKey; label: string; chart: string }[] = [
  { key: "FTTH", label: "FTTH", chart: "chart-1" },
  { key: "FWA", label: "FWA", chart: "chart-2" },
  { key: "5G", label: "5G", chart: "chart-3" },
  { key: "Banda", label: "Banda", chart: "chart-4" },
];

/** Indicators with no accessible source/meta, grouped per service. */
export const AGUARDANDO_POR_SERVICO: Record<ServicoKey, string[]> = {
  FTTH: ["Ticket Médio Oferta", "Churn Safra"],
  FWA: ["Ticket Médio Entrada", "Churn Safra"],
  "5G": ["% Portabilidade", "Churn Safra c/ Bloqueio", "Ticket Médio 5G", "Chip pago/grátis"],
  Banda: ["Ticket Médio Entrada", "Churn Safra"],
};
