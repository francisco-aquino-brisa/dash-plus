// Domain types for the Dashboard Vendedor screen (Tela 4).
//
// A drill-down of ONE vendedor, keyed by `matricula`. Sources:
//   - desempenho_hc            → profile, per-tech funnel, ranking, mix, dias
//   - vw_hc_zerado_vendedor    → official PDU + NDU (dias úteis) per serviço
//   - metas_vendedores_canais  → the per-vendedor indicator catalog + metas
//     (indicador/servico/meta + formula metadata); realizado per indicator is
//     computed from the source tables named in that catalog (waves_consolidado_
//     orcamento, consolidado_5g_pedido, …), joined by `hash_user`. See
//     lib/data/vendedor/indicadores.ts and docs/data-map.md.
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

/** Display format for an indicator's value (from metas_vendedores_canais). */
export type IndicadorFormato = "qtd" | "R$" | "%";

/**
 * One indicator line inside a service card, driven by the vendor's catalog in
 * metas_vendedores_canais. `meta` is the catalog target; `realizado` is computed
 * from the indicator's source table via its formula (see indicadores.ts).
 */
export interface IndicadorVM {
  /** id_indicador (e.g. "VE03"). */
  id: string;
  /** Catalog label (`indicador`), e.g. "Vendas Instaladas - FTTH". */
  label: string;
  meta: number;
  realizado: number;
  /** Attainment % (realizado ÷ meta × 100). */
  atingimento: number;
  /** Remaining to the meta (0 when met or when "menor melhor"). */
  falta: number;
  formato: IndicadorFormato;
  /** "up" = maior melhor, "down" = menor melhor. */
  polaridade: "up" | "down";
  /** false → realizado not yet computable (deferred/blocked source) → shows "—". */
  disponivel: boolean;
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
  /** The vendor's catalog indicators for this service (meta × realizado). */
  indicadores: IndicadorVM[];
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

/** One sales offer (a `plano`) in the Mix de Vendas list. */
export interface MixOferta {
  /** Plan/offer name (`plano` from waves_consolidado_orcamento). */
  titulo: string;
  servico: "FTTH" | "FWA" | "5G";
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
  mix: MixOferta[];
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
