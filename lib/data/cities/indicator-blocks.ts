// Compute the selectable-indicator blocks (Banda Larga + 5G) for the cities
// screen. Runs on the server over the cached dataset; the client only filters
// which cards to show by the user's saved selection.
//
// Realizado is aggregated from the wide indicator tables (sum / ratio / growth).
// Meta comes only from metas_cidades: summed for Qtd, denominator-weighted for
// percentages (a per-city target % can't be summed). Cards with no meta show
// the value alone. See the grill decisions and CLAUDE.md.

import type { CityIndicatorRecord, CityMetaRecord, Filters } from "./types";
import {
  indicatorsForBlock,
  type IndicatorBlock,
  type IndicatorDef,
  type IndicatorUnit,
  type Polarity,
} from "./indicators";
import { applyFilters, previousMonth, sum } from "./compute";

export interface IndicatorCardVM {
  id: string;
  block: IndicatorBlock;
  label: string;
  unit: IndicatorUnit;
  polarity: Polarity;
  available: boolean;
  value: number;
  meta: number | null;
  atingimento: number | null;
  /** % change vs previous month (relative). */
  delta: number;
  description: string;
  /** 12-month series of the realizado, for the detail modal. */
  series: { mes: string; valor: number }[];
  media: number;
}

/**
 * Canonical city key for joining across tables whose "Cidade / UF" formatting
 * differs (indicadores_cidades uses " / ", metas_cidades uses "/"). Uppercase,
 * collapse whitespace, drop spaces around the slash.
 */
function canonCity(cidade: string): string {
  return cidade.toUpperCase().replace(/\s*\/\s*/g, "/").replace(/\s+/g, " ").trim();
}

/** Technologies in scope for a block, honoring the Tecnologia filter (BL only). */
function techScope(block: IndicatorBlock, tecnologia: string): CityIndicatorRecord["tecnologia"][] {
  if (block === "5g") return ["5G"];
  if (tecnologia === "FTTH") return ["FTTH"];
  if (tecnologia === "FWA") return ["FWA"];
  return ["FTTH", "FWA"];
}

/** metas_cidades.servico to join against, given the block + active Tec filter. */
function metaServicoFor(block: IndicatorBlock, tecnologia: string): string {
  if (block === "5g") return "5G";
  if (tecnologia === "FTTH") return "FTTH";
  if (tecnologia === "FWA") return "FWA";
  return "Banda Larga";
}

/** Rows of a month within the block's technology scope (Tec filter applied). */
function scopedRows(
  records: CityIndicatorRecord[],
  filters: Filters,
  competencia: string,
  block: IndicatorBlock,
): CityIndicatorRecord[] {
  const techs = new Set(techScope(block, filters.tecnologia));
  // Ignore the Tecnologia filter in applyFilters — the block controls tech itself.
  const base = applyFilters(records, { ...filters, competencia, tecnologia: "" });
  return base.filter((r) => techs.has(r.tecnologia));
}

function realizado(def: IndicatorDef, rows: CityIndicatorRecord[], prevRows: CityIndicatorRecord[]): number {
  const c = def.compute;
  if (!c) return 0;
  if (c.kind === "sum") return sum(rows, (r) => r[c.field] as number);
  if (c.kind === "ratio") {
    const den = sum(rows, (r) => r[c.den] as number);
    return den === 0 ? 0 : (sum(rows, (r) => r[c.num] as number) / den) * 100;
  }
  // growthBase
  const cur = sum(rows, (r) => r.base_ativa) + sum(rows, (r) => r.fechados);
  const prev = sum(prevRows, (r) => r.base_ativa) + sum(prevRows, (r) => r.fechados);
  return cur - prev;
}

/** Aggregate the meta for the scope. Percent metas are stored as fractions. */
function aggregateMeta(
  def: IndicatorDef,
  rows: CityIndicatorRecord[],
  metaRows: CityMetaRecord[],
  competencia: string,
  servico: string,
): number | null {
  if (!def.metaId) return null;
  const metas = metaRows.filter(
    (m) => m.id_indicador === def.metaId && m.servico === servico && m.competencia === competencia,
  );
  if (metas.length === 0) return null;
  const metaByCity = new Map(metas.map((m) => [canonCity(m.cidade), m.meta]));
  const factor = def.unit === "percent" ? 100 : 1; // fractions → percent points

  if (def.unit === "percent" && def.compute?.kind === "ratio") {
    // Weight each city's target % by that city's realizado denominator.
    const denField = def.compute.den;
    let weighted = 0;
    let weight = 0;
    const denByCity = new Map<string, number>();
    for (const r of rows) denByCity.set(canonCity(r.cidade), (denByCity.get(canonCity(r.cidade)) ?? 0) + (Number(r[denField]) || 0));
    for (const [cidade, meta] of metaByCity) {
      const den = denByCity.get(cidade);
      if (den === undefined) continue;
      weighted += meta * den;
      weight += den;
    }
    if (weight === 0) {
      // No denominator in scope → fall back to the simple mean of in-scope metas.
      const inScope = [...metaByCity].filter(([c]) => denByCity.has(c)).map(([, m]) => m);
      if (inScope.length === 0) return null;
      return (inScope.reduce((a, b) => a + b, 0) / inScope.length) * factor;
    }
    return (weighted / weight) * factor;
  }

  // Qtd / growthBase → sum the per-city targets over cities present in scope.
  const citiesInScope = new Set(rows.map((r) => canonCity(r.cidade)));
  let total = 0;
  let matched = 0;
  for (const [cidade, meta] of metaByCity) {
    if (!citiesInScope.has(cidade)) continue;
    total += meta;
    matched++;
  }
  return matched === 0 ? null : total * factor;
}

function relDelta(cur: number, prev: number): number {
  return prev === 0 ? 0 : ((cur - prev) / Math.abs(prev)) * 100;
}

export function computeIndicatorBlock(
  records: CityIndicatorRecord[],
  metaRecords: CityMetaRecord[],
  months: string[],
  filters: Filters,
  block: IndicatorBlock,
): IndicatorCardVM[] {
  const servico = metaServicoFor(block, filters.tecnologia);
  const comp = filters.competencia;
  const prevMes = previousMonth(months, comp);

  // Pre-scope rows per month once; reused across every indicator in the block.
  const rowsByMonth = new Map<string, CityIndicatorRecord[]>();
  for (const m of months) rowsByMonth.set(m, scopedRows(records, filters, m, block));
  const curRows = rowsByMonth.get(comp) ?? [];
  const prevRows = prevMes ? (rowsByMonth.get(prevMes) ?? []) : [];

  return indicatorsForBlock(block).map((def): IndicatorCardVM => {
    if (!def.available) {
      return {
        id: def.id, block: def.block, label: def.label, unit: def.unit, polarity: def.polarity,
        available: false, value: 0, meta: null, atingimento: null, delta: 0,
        description: def.description, series: [], media: 0,
      };
    }

    const value = realizado(def, curRows, prevRows);
    const prevValue = realizado(def, prevRows, []);
    const meta = aggregateMeta(def, curRows, metaRecords, comp, servico);
    const atingimento = meta === null || meta === 0 ? null : (value / meta) * 100;

    const series = months.map((m, i) => {
      const rows = rowsByMonth.get(m) ?? [];
      const pr = i > 0 ? (rowsByMonth.get(months[i - 1]) ?? []) : [];
      return { mes: m, valor: realizado(def, rows, pr) };
    });
    const media = series.reduce((a, s) => a + s.valor, 0) / (series.length || 1);

    return {
      id: def.id, block: def.block, label: def.label, unit: def.unit, polarity: def.polarity,
      available: true, value, meta, atingimento, delta: relDelta(value, prevValue),
      description: def.description, series, media,
    };
  });
}
