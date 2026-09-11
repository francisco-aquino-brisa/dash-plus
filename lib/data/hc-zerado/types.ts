// View-models for the HC Zerado module (ported from the Brisa Radar app).
//
// The screens are a port of `dashboard_zero_venda`, whose single source is the
// view `vw_producao_hc_zero_venda`. The original loaded that whole view into the
// browser and computed every block in JS; here the aggregation runs in SQL and
// only the view-model crosses the wire (ADR 0006).

/** Sale status charged by the "Status da Venda" filter. */
export type StatusVenda = "CRIADO" | "EFETIVADO" | "INSTALADO";

/** "Agilidade do processo": same-day confirmation / same-day install. */
export type Agilidade = "" | "efetivado" | "instalado";

/** Service-availability class of the seller's city. */
export type PerfilCidade = "" | "FTTH" | "HIBRIDA" | "5G ONLY";

/** Employment-experience cut. Values are the ones the source actually stores. */
export type Experiencia = "" | "Em Exp." | "Efetivo";

/**
 * Click-to-filter state. In the original these were client-side only; here they
 * travel in the URL so the server can narrow the aggregation the same way.
 */
export interface HcCrossFilters {
  vendedor: string;
  gerencia: string;
  coordenacao: string;
  canal: string;
  cidade: string;
  servico: string;
}

/** The shared filter panel, identical in shape to the original FilterState. */
export interface HcFilters {
  from: string;
  to: string;
  gerente: string[];
  coordenacao: string[];
  supervisao: string[];
  lider: string[];
  cidade: string[];
  consultor: string[];
  canal: string[];
  nicho: string[];
  servico: string[];
  indicador: string[];
  experiencia: Experiencia;
  statusVenda: StatusVenda;
  agilidade: Agilidade;
  perfilCidade: PerfilCidade;
  cross: HcCrossFilters;
}

/** One distinct attribute combination in the period — what the dropdowns cascade over. */
export interface HcFilterTuple {
  gerente: string;
  coordenacao: string;
  supervisao: string;
  lider: string;
  cidade: string;
  matricula: string;
  consultor: string;
  canal: string;
  nicho: string;
  servico: string;
  indicador: string;
  perfil: string;
  experiencia: string;
}

export interface HcFilterOptions {
  gerentes: string[];
  coordenacoes: string[];
  supervisoes: string[];
  lideres: string[];
  cidades: string[];
  consultores: string[];
  canais: string[];
  nichos: string[];
  servicos: string[];
  indicadores: string[];
}

/** Bloco 1 — headcount composition on the last day of the filtered range. */
export interface QuadroGeralItem {
  id: string;
  label: string;
  count: number;
  pct: number;
}

export interface QuadroGeral {
  total: number;
  /** The day the snapshot refers to (`yyyy-MM-dd`), or null when empty. */
  refDate: string | null;
  items: QuadroGeralItem[];
}

/** Bloco 2 — production totals for the period, by service. */
export interface Totalizadores {
  ftth: number;
  fwa: number;
  chips5g: number;
  /**
   * Renovações. The source carries no `RENOVAÇÃO` service today, so this is
   * always null — rendered as "sem dado na fonte", never as a silent zero.
   */
  renovacoes: number | null;
}

/** Bloco 3 — one bar per day: active HC, zeroed HC and the idleness rate. */
export interface ZeradoDay {
  data: string;
  label: string;
  ativos: number;
  zerados: number;
  ativosRestantes: number;
  pctZerado: number;
  feriado: boolean;
}

/** Bloco 4 / Matriz Gerencial — one row per management group. */
export interface RegionalRow {
  id: string;
  nome: string;
  totalAtivo: number;
  totalWithSales: number;
  pctVendeu: number;
  totalZerado: number;
  pctZerado: number;
  countZeradoD0: number;
  countZeradoD1: number;
  d1Status: "melhora" | "piora" | "estavel";
  /** Zeroed count per day of the period, aligned with `HcDesempenhoView.dias`. */
  serieZerados: number[];
}

/** Bloco 5 — one row per seller. */
export interface VendedorRow {
  matricula: string;
  consultor: string;
  canal: string;
  cidade: string;
  gerente: string;
  coordenacao: string;
  situacao: string;
  ativo: boolean;
  totalVendas: number;
  diasComVenda: number;
  diasSemVenda: number;
  aproveitamento: number;
  projecao: number;
  /** Sales per day, aligned with `HcDesempenhoView.dias`. */
  vendasByDay: number[];
  /** True when the seller sold nothing on the reference day. */
  zeradoToday: boolean;
  /** First day the person appears in the period — the list's ordering key. */
  firstDay: string;
}

/** Bloco 6 — daily production matrix (group × service × day). */
export interface MatrizRow {
  id: string;
  nome: string;
  detalhe: string;
  servico: string;
  /** Sales per day, aligned with `HcDesempenhoView.dias`. */
  values: number[];
  total: number;
  /** "Total período": the subject's production across all services. */
  subjectTotal: number;
  /** Indicator breakdown per cell, keyed by the day's index in `dias`. Sparse —
   *  only days with production appear. */
  breakdown: Record<string, Array<{ indicador: string; value: number }>>;
}

/** Bloco 7 — daily cumulative PDU. */
export interface PduDay {
  label: string;
  pdu: number;
  producao: number;
}

/** Bloco 7 — closed-month PDU. */
export interface PduMonth {
  month: string;
  label: string;
  pdu: number;
  ftth: number;
  fwa: number;
  chips5g: number;
  renovacoes: number;
  total: number;
  hcAtivo: number;
  diasUteis: number;
}

/** One day of the selected range. */
export interface DayAxis {
  data: string;
  label: string;
  feriado: boolean;
  fimDeSemana: boolean;
}

export interface HcDesempenhoView {
  days: DayAxis[];
  quadroGeral: QuadroGeral;
  totalizadores: Totalizadores;
  zeradoByDay: ZeradoDay[];
  regional: { gerencia: RegionalRow[]; coordenacao: RegionalRow[]; cidade: RegionalRow[] };
  vendedores: VendedorRow[];
  matriz: { consultor: MatrizRow[]; gerencia: MatrizRow[]; coordenacao: MatrizRow[]; cidade: MatrizRow[] };
  pduDay: PduDay[];
  pduMonth: PduMonth[];
  diasUteisElapsed: number;
  refDate: string;
}

/* --------------------------------------------- Tela 2 — Análise de Produtividade */

/** Both tabs group by the same four dimensions, each with its own selector. */
export type ProdutividadeGrouping = "vendedor" | "gerencia" | "coordenacao" | "cidade";

/** One column of the 12-month analysis window. */
export interface MonthAxis {
  /** `yyyy-MM`. */
  month: string;
  /** `SET-2026`. */
  label: string;
}

/** Aba 1 — one subject, with its production per service and month. */
export interface ProdutividadeRow {
  id: string;
  nome: string;
  /** Canal for a seller; `N consultores` for a group. */
  detalhe: string;
  /** `Em Exp.` / `Efetivo`, empty for groups. */
  experiencia: string;
  /** Days left in the probation period, when the source carries them. */
  diasExperiencia: number | null;
  total: number;
  /** Serviço → production per month, aligned with `months`. Sparse. */
  values: Record<string, number[]>;
  /** Serviço → production across the window. Sparse. */
  totals: Record<string, number>;
  /**
   * `serviço|monthIndex` → the cell's top indicators as `[nome, valor]`. Sparse,
   * and a tuple rather than an object: named keys tripled this screen's payload,
   * which carries a breakdown for every seller in twelve months.
   */
  breakdown: Record<string, Array<[string, number]>>;
}

/**
 * Aba 2 — one subject's idleness per month.
 *
 * `values` means different things per grouping, exactly as in the origin: for a
 * seller it is the count of business days they sold nothing; for a group it is
 * the average headcount idle on a business day.
 */
export interface ZeradosRow {
  id: string;
  nome: string;
  detalhe: string;
  experiencia: string;
  diasExperiencia: number | null;
  /** Aligned with `months`. */
  values: number[];
  /** Share of the month's business days (seller) or of the team (group). */
  pcts: number[];
  consolidado: number;
  consolidadoPct: number;
}

export interface HcProdutividadeView {
  months: MonthAxis[];
  rows: ProdutividadeRow[];
}

export interface HcZeradosView {
  months: MonthAxis[];
  rows: ZeradosRow[];
}
