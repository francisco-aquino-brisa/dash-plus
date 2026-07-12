// Cities dashboard computation — KPIs, growth-by-tech, negative cities,
// quartiles, historic series. Ported from the prototype's `dashboard.ts`,
// adapted to the real schema and parameterized by `rows` (no module-level
// dataset) so the same logic runs over mock or Databricks data.
//
// Business rule: "Banda Larga" = FTTH + FWA. 5G is an independent base.

import type { CityIndicatorRecord, CityMetaRecord, Filters } from "./types";
import { computeIndicatorBlock, type IndicatorCardVM } from "./indicator-blocks";

export const DEFAULT_FILTERS: Omit<Filters, "competencia"> = {
  gerencia: "",
  coordenacao: "",
  tipoCidade: "",
  cidade: "",
  tecnologia: "",
};

export function applyFilters(rows: CityIndicatorRecord[], f: Filters): CityIndicatorRecord[] {
  return rows.filter((r) => {
    if (f.competencia && r.competencia !== f.competencia) return false;

    if (f.gerencia && r.gerencia !== f.gerencia) return false;

    if (f.coordenacao && r.coordenacao !== f.coordenacao) return false;

    if (f.tipoCidade && r.tipo_cidade !== f.tipoCidade) return false;

    if (f.cidade && r.cidade !== f.cidade) return false;

    if (f.tecnologia) {
      if (f.tecnologia === "Banda Larga") {
        if (r.tecnologia !== "FTTH" && r.tecnologia !== "FWA") return false;
      } else if (r.tecnologia !== f.tecnologia) {
        return false;
      }
    }

    return true;
  });
}

export function sum<T>(arr: T[], pick: (x: T) => number): number {
  return arr.reduce((acc, x) => acc + (pick(x) || 0), 0);
}

export function previousMonth(months: string[], competencia: string): string | null {
  const idx = months.indexOf(competencia);

  return idx > 0 ? months[idx - 1] : null;
}

/** Day-of-month projection: result * (daysInMonth / daysElapsed). */
export function projection(result: number, competencia: string): number {
  const [y, m] = competencia.split("-").map(Number);
  const now = new Date();
  const isCurrent = now.getFullYear() === y && now.getMonth() + 1 === m;

  if (!isCurrent) return result;

  const daysInMonth = new Date(y, m, 0).getDate();
  const dayOfMonth = Math.max(1, now.getDate());

  return Math.round(result * (daysInMonth / dayOfMonth));
}

export interface KpiValue {
  meta: number;
  resultado: number;
  atingimento: number; // %
  projecao: number;
  tendencia: number; // % vs prev month
  isPct?: boolean;
  inverse?: boolean; // lower is better (churn)
}

function mkKpi(
  meta: number,
  resultado: number,
  prev: number,
  competencia: string,
  opts: Partial<KpiValue> = {},
): KpiValue {
  const atingimento = meta === 0 ? 0 : (resultado / meta) * 100;
  const tendencia = prev === 0 ? 0 : ((resultado - prev) / Math.abs(prev)) * 100;

  return { meta, resultado, atingimento, projecao: projection(resultado, competencia), tendencia, ...opts };
}

export interface KpiSet {
  crescimentoBase: KpiValue;
  crescimentoBaseAtiva: KpiValue;
  baseFechada: KpiValue;
  reativacao: KpiValue;
  churnRate: KpiValue;
  churnSafra: KpiValue;
  vendasCriadas: KpiValue;
  vendasEfetivadas: KpiValue;
  vendasInstaladas: KpiValue;
  ativacoes5g: KpiValue;
  baseAtivaTotal: number;
  base5g: number;
  bloqueados: number;
  reativPct: number;
  scope: "5G" | "Banda Larga";
}

export type KpiKey =
  | "crescimentoBase"
  | "crescimentoBaseAtiva"
  | "baseFechada"
  | "reativacao"
  | "churnRate"
  | "churnSafra"
  | "vendasCriadas"
  | "vendasEfetivadas"
  | "vendasInstaladas"
  | "ativacoes5g";

export function computeKpis(rows: CityIndicatorRecord[], months: string[], filters: Filters): KpiSet {
  const currentAll = applyFilters(rows, filters);
  const prevMes = previousMonth(months, filters.competencia);
  const previousAll = prevMes ? applyFilters(rows, { ...filters, competencia: prevMes }) : [];

  // Without a technology filter the main KPIs consolidate Banda Larga only;
  // 5G shows in its own blocks. Filtering "5G" flips the main scope to 5G.
  const isFiveGScope = filters.tecnologia === "5G";
  const main = isFiveGScope
    ? currentAll.filter((r) => r.tecnologia === "5G")
    : currentAll.filter((r) => r.tecnologia !== "5G");
  const mainPrev = isFiveGScope
    ? previousAll.filter((r) => r.tecnologia === "5G")
    : previousAll.filter((r) => r.tecnologia !== "5G");

  const crescBaseAtual = sum(main, (r) => r.base_ativa) + sum(main, (r) => r.fechados);
  const crescBasePrev = sum(mainPrev, (r) => r.base_ativa) + sum(mainPrev, (r) => r.fechados);
  const crescBase = crescBaseAtual - crescBasePrev;
  const metaCrescBase = sum(main, (r) => r.meta_crescimento);

  const crescBaseAtiva = sum(main, (r) => r.crescimento);
  const crescBaseAtivaPrev = sum(mainPrev, (r) => r.crescimento);

  const fechados = sum(main, (r) => r.fechados);
  const fechadosPrev = sum(mainPrev, (r) => r.fechados);
  const baseAtivaTotal = sum(main, (r) => r.base_ativa);
  const churnRate = baseAtivaTotal === 0 ? 0 : (fechados / baseAtivaTotal) * 100;
  const baseAtivaPrev = sum(mainPrev, (r) => r.base_ativa);
  const churnRatePrev = baseAtivaPrev === 0 ? 0 : (fechadosPrev / baseAtivaPrev) * 100;

  const reativacoes = sum(main, (r) => r.reativacoes_bloqueados);
  const bloqueados = sum(main, (r) => r.bloqueados);
  const reativPrev = sum(mainPrev, (r) => r.reativacoes_bloqueados);
  const reativPct = bloqueados === 0 ? 0 : (reativacoes / bloqueados) * 100;
  const metaReativ = Math.round(bloqueados * 0.25);

  // Churn Safra = cancellations from the cohort installed 4 months ago, over the
  // total installs of that same cohort (real cohort columns).
  const safraInst = sum(main, (r) => r.instalados_4_mes);
  const safraCanc = sum(main, (r) => r.cancelados_4_mes);
  const churnSafra = safraInst === 0 ? 0 : (safraCanc / safraInst) * 100;

  const vCriadas = sum(main, (r) => r.vendas_criadas);
  const vEfet = sum(main, (r) => r.vendas_efetivadas);
  const vInst = sum(main, (r) => r.vendas_instaladas);
  const mCriadas = sum(main, (r) => r.meta_vendas_criadas);
  const mEfet = sum(main, (r) => r.meta_vendas_efetivadas);
  const mInst = sum(main, (r) => r.meta_vendas_instaladas);

  // 5G activations — always independent, even in the Banda Larga scope.
  const current5g = currentAll.filter((r) => r.tecnologia === "5G");
  const prev5g = previousAll.filter((r) => r.tecnologia === "5G");
  const ativ5g = sum(current5g, (r) => r.ativacao_mes);
  const ativ5gPrev = sum(prev5g, (r) => r.ativacao_mes);
  const metaAtiv5g = sum(current5g, (r) => r.meta_ativacao);
  const base5g = sum(current5g, (r) => r.base_ativa);

  const mes = filters.competencia;

  return {
    crescimentoBase: mkKpi(metaCrescBase, crescBase, crescBasePrev, mes),
    crescimentoBaseAtiva: mkKpi(metaCrescBase, crescBaseAtiva, crescBaseAtivaPrev, mes),
    baseFechada: mkKpi(Math.round(baseAtivaTotal * 0.018), fechados, fechadosPrev, mes, { inverse: true }),
    reativacao: mkKpi(metaReativ, reativacoes, reativPrev, mes),
    churnRate: mkKpi(2, churnRate, churnRatePrev, mes, { isPct: true, inverse: true }),
    churnSafra: mkKpi(3, churnSafra, 0, mes, { isPct: true, inverse: true }),
    vendasCriadas: mkKpi(
      mCriadas,
      vCriadas,
      sum(mainPrev, (r) => r.vendas_criadas),
      mes,
    ),
    vendasEfetivadas: mkKpi(
      mEfet,
      vEfet,
      sum(mainPrev, (r) => r.vendas_efetivadas),
      mes,
    ),
    vendasInstaladas: mkKpi(
      mInst,
      vInst,
      sum(mainPrev, (r) => r.vendas_instaladas),
      mes,
    ),
    ativacoes5g: mkKpi(metaAtiv5g, ativ5g, ativ5gPrev, mes),
    baseAtivaTotal,
    base5g,
    bloqueados,
    reativPct,
    scope: isFiveGScope ? "5G" : "Banda Larga",
  };
}

export interface GrowthByTech {
  tecnologia: TecFiltroLabel;
  baseClientes: number;
  cidadesAtivas: number;
  cidadesNeg: number;
  takeup?: number;
  hp?: number;
}
type TecFiltroLabel = "FTTH" | "FWA" | "Banda Larga" | "5G";

export function growthByTech(rows: CityIndicatorRecord[], filters: Filters): GrowthByTech[] {
  const techs: TecFiltroLabel[] = ["FTTH", "FWA", "Banda Larga", "5G"];

  return techs.map((t) => {
    const r = applyFilters(rows, { ...filters, tecnologia: t });
    const baseClientes = sum(r, (x) => x.base_ativa);
    const cidadesAtivas = new Set(r.filter((x) => x.crescimento >= 0).map((x) => x.id_cidade)).size;
    const cidadesNeg = new Set(r.filter((x) => x.crescimento < 0).map((x) => x.id_cidade)).size;
    const hp = sum(r, (x) => x.total_de_hp);
    const fechados = sum(r, (x) => x.fechados);
    const takeup = hp === 0 ? 0 : ((baseClientes + fechados) / hp) * 100;
    const showTakeup = t === "FTTH" || t === "Banda Larga";

    return {
      tecnologia: t,
      baseClientes,
      cidadesAtivas,
      cidadesNeg,
      takeup: showTakeup ? takeup : undefined,
      hp: showTakeup ? hp : undefined,
    };
  });
}

export interface NegativeCityRow {
  cidade: string;
  uf: string;
  gerencia: string;
  coordenacao: string;
  tecnologia: string;
  metaCrescimento: number;
  resultadoCrescimento: number;
  atingCresc: number;
  metaBaseAtiva: number;
  resultadoBaseAtiva: number;
  atingBaseAtiva: number;
  status: "Negativa Crescimento" | "Negativa Base Ativa" | "Ambas";
}

export function negativeCities(rows: CityIndicatorRecord[], filters: Filters): NegativeCityRow[] {
  const r = applyFilters(rows, filters);
  const map = new Map<string, NegativeCityRow>();
  for (const x of r) {
    const key = `${x.id_cidade}-${x.tecnologia}`;
    const negCresc = x.crescimento < 0 || x.crescimento < x.meta_crescimento * 0.5;
    const negBase = x.base_ativa < x.meta_base_ativa;

    if (!negCresc && !negBase) continue;

    const status: NegativeCityRow["status"] =
      negCresc && negBase ? "Ambas" : negCresc ? "Negativa Crescimento" : "Negativa Base Ativa";
    map.set(key, {
      cidade: x.cidade,
      uf: x.uf,
      gerencia: x.gerencia,
      coordenacao: x.coordenacao,
      tecnologia: x.tecnologia,
      metaCrescimento: x.meta_crescimento,
      resultadoCrescimento: x.crescimento,
      atingCresc: x.meta_crescimento === 0 ? 0 : (x.crescimento / x.meta_crescimento) * 100,
      metaBaseAtiva: x.meta_base_ativa,
      resultadoBaseAtiva: x.base_ativa,
      atingBaseAtiva: x.meta_base_ativa === 0 ? 0 : (x.base_ativa / x.meta_base_ativa) * 100,
      status,
    });
  }

  return Array.from(map.values()).sort((a, b) => a.atingCresc - b.atingCresc);
}

export interface QuartileBucket {
  label: string;
  range: string;
  count: number;
  pct: number;
  cidades: { cidade: string; atingimento: number; tecnologia: string }[];
}

export function quartiles(rows: CityIndicatorRecord[], filters: Filters): QuartileBucket[] {
  const r = applyFilters(rows, filters);
  const byKey = new Map<string, { cidade: string; tec: string; atin: number }>();
  for (const x of r) {
    const k = `${x.id_cidade}-${x.tecnologia}`;
    const atin = x.meta_crescimento === 0 ? 0 : (x.crescimento / x.meta_crescimento) * 100;
    byKey.set(k, { cidade: x.cidade, tec: x.tecnologia, atin });
  }
  const all = Array.from(byKey.values());
  const buckets: QuartileBucket[] = [
    { label: "Q1 — Acima da meta", range: ">= 100%", count: 0, pct: 0, cidades: [] },
    { label: "Q2 — Próximo da meta", range: "70% a 99%", count: 0, pct: 0, cidades: [] },
    { label: "Q3 — Abaixo da meta", range: "0% a 69%", count: 0, pct: 0, cidades: [] },
    { label: "Q4 — Negativa", range: "< 0%", count: 0, pct: 0, cidades: [] },
  ];
  for (const c of all) {
    let idx = 2;

    if (c.atin >= 100) idx = 0;
    else if (c.atin >= 70) idx = 1;
    else if (c.atin >= 0) idx = 2;
    else idx = 3;

    buckets[idx].count++;
    buckets[idx].cidades.push({ cidade: c.cidade, atingimento: c.atin, tecnologia: c.tec });
  }
  const total = all.length || 1;
  buckets.forEach((b) => (b.pct = (b.count / total) * 100));
  buckets.forEach((b) => b.cidades.sort((a, b) => b.atingimento - a.atingimento));

  return buckets;
}

export function historicSeries(
  rows: CityIndicatorRecord[],
  months: string[],
  filters: Filters,
  picker: (r: CityIndicatorRecord) => number,
): { mes: string; valor: number }[] {
  return months.map((m) => {
    const r = applyFilters(rows, { ...filters, competencia: m });

    return { mes: m, valor: sum(r, picker) };
  });
}

// ── Server-side view-model ───────────────────────────────────────────────────
// Everything the Cities screen needs, computed on the server over the cached
// dataset, so the client receives a few KB instead of all ~93k rows (ADR 0002).

export interface DashboardView {
  filters: Filters;
  months: string[];
  kpis: KpiSet;
  growth: GrowthByTech[];
  negatives: NegativeCityRow[];
  quartis: QuartileBucket[];
  history: { mes: string; valor: number }[];
  coverage: { totalCidades: number; totalBase: number; totalHP: number; takeup: number };
  churn5g: { churnRate: number; cancelamentos: number; comConsumo: number; semConsumo: number };
  desativados: { solicitados: number; automaticos: number };
  /** Per-KPI 12-month series + average, for the KPI detail modal. */
  modal: Record<KpiKey, { series: { mes: string; valor: number }[]; media: number }>;
  /** Selectable indicators per block; the client shows the user's chosen subset. */
  blocks: { bandaLarga: IndicatorCardVM[]; g5: IndicatorCardVM[] };
}

const KPI_KEYS: KpiKey[] = [
  "crescimentoBase",
  "crescimentoBaseAtiva",
  "baseFechada",
  "reativacao",
  "churnRate",
  "churnSafra",
  "vendasCriadas",
  "vendasEfetivadas",
  "vendasInstaladas",
  "ativacoes5g",
];

export function buildDashboardView(
  rows: CityIndicatorRecord[],
  metaRecords: CityMetaRecord[],
  months: string[],
  filters: Filters,
): DashboardView {
  // One KpiSet per month (12 passes), reused for both current KPIs and the
  // modal series — avoids recomputing per KPI.
  const monthlySets = months.map((m) => computeKpis(rows, months, { ...filters, competencia: m }));
  const curIdx = Math.max(0, months.indexOf(filters.competencia));
  const kpis = monthlySets[curIdx] ?? computeKpis(rows, months, filters);

  const modal = {} as DashboardView["modal"];
  for (const key of KPI_KEYS) {
    const series = months.map((m, i) => ({ mes: m, valor: monthlySets[i][key].resultado }));
    const media = series.reduce((a, s) => a + s.valor, 0) / (series.length || 1);
    modal[key] = { series, media };
  }

  const currentRows = applyFilters(rows, filters);
  const coverageRows =
    filters.tecnologia === "5G" ? currentRows : currentRows.filter((r) => r.tecnologia !== "5G");
  const totalCidades = new Set(currentRows.map((r) => r.id_cidade)).size;
  const totalBase = sum(coverageRows, (r) => r.base_ativa);
  const totalHP = sum(coverageRows, (r) => r.total_de_hp);
  const takeup = totalHP === 0 ? 0 : ((totalBase + sum(coverageRows, (r) => r.fechados)) / totalHP) * 100;

  const r5g = currentRows.filter((r) => r.tecnologia === "5G");
  const cancel5g = sum(r5g, (r) => r.cancelamentos);
  const base5g = sum(r5g, (r) => r.base_ativa);
  const nonFiveG = coverageRows.filter((r) => r.tecnologia !== "5G");

  return {
    filters,
    months,
    kpis,
    growth: growthByTech(rows, filters),
    negatives: negativeCities(rows, filters),
    quartis: quartiles(rows, filters),
    history: historicSeries(rows, months, filters, (r) => r.crescimento),
    coverage: { totalCidades, totalBase, totalHP, takeup },
    churn5g: {
      churnRate: base5g === 0 ? 0 : (cancel5g / base5g) * 100,
      cancelamentos: cancel5g,
      comConsumo: sum(r5g, (r) => r.cancelamentos_com_consumo),
      semConsumo: sum(r5g, (r) => r.cancelamentos_sem_consumo),
    },
    desativados: {
      solicitados: sum(nonFiveG, (r) => r.desativado_s),
      automaticos: sum(nonFiveG, (r) => r.desativado_auto),
    },
    modal,
    blocks: {
      bandaLarga: computeIndicatorBlock(rows, metaRecords, months, filters, "banda-larga"),
      g5: computeIndicatorBlock(rows, metaRecords, months, filters, "5g"),
    },
  };
}
