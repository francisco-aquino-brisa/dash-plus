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
  DEFAULT_FOOTER,
  indicatorsForBlock,
  type FooterSlot,
  type IndicatorBlock,
  type IndicatorCompute,
  type IndicatorDef,
  type IndicatorUnit,
  type Polarity,
} from "./indicators";
import { applyFilters, previousMonth, projection, sum } from "./compute";
import { formatNumber, formatPct } from "@/lib/format";

/** A resolved footer column: label + formatted value + color tone. */
export interface FooterStatVM {
  label: string;
  display: string;
  tone: "good" | "warn" | "bad" | "default";
}

/** One point of a chart series. `meta`/`extras` power the detail-chart overlays. */
export interface SeriesPoint {
  mes: string;
  valor: number;
  /** Optional meta line value (same unit as `valor`). */
  meta?: number | null;
  /** Pre-formatted extra rows for the tooltip (e.g. ratio components). */
  extras?: { label: string; display: string }[];
}

/** A secondary metric shown in the detail modal; clicking it charts its series. */
export interface RelatedIndicatorVM {
  id: string;
  label: string;
  unit: IndicatorUnit;
  /** Decimal places for percent/currency display. */
  decimals: number;
  polarity: Polarity;
  value: number;
  /** % change vs previous month (relative). */
  delta: number;
  media: number;
  series: SeriesPoint[];
}

export interface IndicatorCardVM {
  id: string;
  block: IndicatorBlock;
  label: string;
  unit: IndicatorUnit;
  /** Decimal places for percent/currency display. */
  decimals: number;
  polarity: Polarity;
  available: boolean;
  value: number;
  meta: number | null;
  /** Unit of the meta (may differ from the value's unit, e.g. Base Fechada). */
  metaUnit: IndicatorUnit;
  atingimento: number | null;
  /** % change vs previous month (relative). */
  delta: number;
  description: string;
  /** Footer columns (Meta / Projeção / Ating. or custom), already resolved. */
  footer: FooterStatVM[];
  /** 12-month series of the realizado, for the detail modal. */
  series: SeriesPoint[];
  media: number;
  /** Related metrics for the detail modal (empty when none / unavailable). */
  related: RelatedIndicatorVM[];
}

/**
 * Default decimal places per unit — the data team presents rates/currency with
 * two decimals, so percent/currency default to 2 (a def may still override).
 */
export function defaultDecimals(unit: IndicatorUnit): number {
  return unit === "qtd" ? 0 : 2;
}

function fmtUnit(unit: IndicatorUnit, v: number, decimals = 1): string {
  if (unit === "currency") return `R$ ${v.toFixed(decimals).replace(".", ",")}`;

  if (unit === "percent") return formatPct(v, decimals);

  return formatNumber(v);
}

/** Sum one or several numeric fields across rows. */
function sumFields(rows: CityIndicatorRecord[], fields: NumFieldish): number {
  const list = Array.isArray(fields) ? fields : [fields];
  let total = 0;

  for (const r of rows) for (const f of list) total += Number(r[f]) || 0;

  return total;
}

type NumFieldish = keyof CityIndicatorRecord | (keyof CityIndicatorRecord)[];

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

/** Everything a compute may need for one month: scoped rows + that month's metas. */
interface ComputeCtx {
  rows: CityIndicatorRecord[];
  prevRows: CityIndicatorRecord[];
  metaRows: CityMetaRecord[];
  servico: string;
  /** id_cidade_src present in scope this month (meta join key). */
  idsInScope: Set<string>;
}

/** Σ metas_cidades.meta for one indicator over the cities in scope + servico. */
function sumMeta(ctx: ComputeCtx, metaId: string): number {
  let total = 0;

  for (const m of ctx.metaRows)
    if (m.id_indicador === metaId && m.servico === ctx.servico && ctx.idsInScope.has(m.id_cidade))
      total += m.meta;

  return total;
}

function computeValue(c: IndicatorCompute | undefined, ctx: ComputeCtx): number {
  if (!c) return 0;

  if (c.kind === "sum") return sum(ctx.rows, (r) => r[c.field] as number);

  if (c.kind === "ratio") {
    const den = sumFields(ctx.rows, c.den);

    return den === 0 ? 0 : (sumFields(ctx.rows, c.num) / den) * 100;
  }

  if (c.kind === "metaSum") return sumMeta(ctx, c.metaId);

  if (c.kind === "cancelRate") {
    const num = sumMeta(ctx, c.numMetaId);
    const den = sumFields(ctx.prevRows, c.prevBaseFields) + sumMeta(ctx, c.denMetaId);

    return den === 0 ? 0 : (num / den) * 100;
  }

  // growthBase
  const cur = sum(ctx.rows, (r) => r.base_ativa) + sum(ctx.rows, (r) => r.fechados);
  const prev = sum(ctx.prevRows, (r) => r.base_ativa) + sum(ctx.prevRows, (r) => r.fechados);

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

  // Join to the realizado by raw source id_cidade (month-prefixed), per the
  // data team: metas_cidades links on (id_cidade, id_indicador, servico).
  const metaById = new Map(metas.map((m) => [m.id_cidade, m.meta]));
  // The meta may describe a derived value (metaCompare) instead of the main one.
  const metaUnit = def.metaCompare ? def.metaCompare.unit : def.unit;
  const ratioForWeight = def.metaCompare?.compute ?? def.compute;
  const factor = metaUnit === "percent" ? 100 : 1; // fractions → percent points

  if (metaUnit === "percent" && ratioForWeight?.kind === "ratio") {
    // Weight each city's target % by that city's realizado denominator.
    const denFields = ratioForWeight.den;
    let weighted = 0;
    let weight = 0;
    const denById = new Map<string, number>();

    for (const r of rows)
      denById.set(r.id_cidade_src, (denById.get(r.id_cidade_src) ?? 0) + sumFields([r], denFields));

    for (const [id, meta] of metaById) {
      const den = denById.get(id);

      if (den === undefined) continue;

      weighted += meta * den;
      weight += den;
    }

    if (weight === 0) {
      // No denominator in scope → fall back to the simple mean of in-scope metas.
      const inScope = [...metaById].filter(([id]) => denById.has(id)).map(([, m]) => m);

      if (inScope.length === 0) return null;

      return (inScope.reduce((a, b) => a + b, 0) / inScope.length) * factor;
    }

    return (weighted / weight) * factor;
  }

  // Qtd / growthBase → sum the per-city targets over cities present in scope.
  const idsInScope = new Set(rows.map((r) => r.id_cidade_src));
  let total = 0;
  let matched = 0;

  for (const [id, meta] of metaById) {
    if (!idsInScope.has(id)) continue;

    total += meta;
    matched++;
  }

  return matched === 0 ? null : total * factor;
}

function relDelta(cur: number, prev: number): number {
  return prev === 0 ? 0 : ((cur - prev) / Math.abs(prev)) * 100;
}

/** 12-month series of a compute, each month resolved through its own context. */
function buildSeries(
  compute: IndicatorCompute | undefined,
  months: string[],
  ctxFor: (m: string) => ComputeCtx,
): { mes: string; valor: number }[] {
  return months.map((m) => ({ mes: m, valor: computeValue(compute, ctxFor(m)) }));
}

function seriesMean(series: { valor: number }[]): number {
  return series.reduce((a, s) => a + s.valor, 0) / (series.length || 1);
}

interface FooterCtx {
  meta: number | null;
  atingimento: number | null;
  projecao: number;
  compute: ComputeCtx;
}

/** Resolve the card footer columns (built-in stats + custom slots). */
function resolveFooter(def: IndicatorDef, ctx: FooterCtx): FooterStatVM[] {
  const slots: FooterSlot[] = def.footer ?? DEFAULT_FOOTER;
  const inverse = def.polarity === "down";

  return slots.map((slot): FooterStatVM => {
    if (slot === "meta") {
      const metaUnit = def.metaCompare ? def.metaCompare.unit : def.unit;
      const dec = def.decimals ?? defaultDecimals(metaUnit);

      return {
        label: "Meta",
        display: ctx.meta === null ? "—" : fmtUnit(metaUnit, ctx.meta, dec),
        tone: "default",
      };
    }

    if (slot === "projecao") {
      const dec = def.decimals ?? defaultDecimals(def.unit);

      return { label: "Projeção", display: fmtUnit(def.unit, ctx.projecao, dec), tone: "default" };
    }

    if (slot === "atingimento") {
      const a = ctx.atingimento;

      if (a === null) return { label: "Ating.", display: "—", tone: "default" };

      const good = inverse ? a <= 100 : a >= 100;
      const warn = inverse ? a > 100 && a <= 130 : a >= 70 && a < 100;

      return { label: "Ating.", display: formatPct(a, 0), tone: good ? "good" : warn ? "warn" : "bad" };
    }

    const unit = slot.unit ?? "qtd";
    const v = computeValue(slot.compute, ctx.compute);

    return {
      label: slot.label,
      display: fmtUnit(unit, v, slot.decimals ?? defaultDecimals(unit)),
      tone: "default",
    };
  });
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

  // Metas grouped by month, so a compute can look up targets for any month.
  const metaByMonth = new Map<string, CityMetaRecord[]>();

  for (const m of metaRecords) {
    const arr = metaByMonth.get(m.competencia) ?? [];

    arr.push(m);
    metaByMonth.set(m.competencia, arr);
  }

  const idsByMonth = new Map<string, Set<string>>();

  for (const [m, rows] of rowsByMonth) idsByMonth.set(m, new Set(rows.map((r) => r.id_cidade_src)));

  const ctxFor = (m: string): ComputeCtx => {
    const rows = rowsByMonth.get(m) ?? [];
    const pm = previousMonth(months, m);

    return {
      rows,
      prevRows: pm ? (rowsByMonth.get(pm) ?? []) : [],
      metaRows: metaByMonth.get(m) ?? [],
      servico,
      idsInScope: idsByMonth.get(m) ?? new Set(),
    };
  };

  const curCtx = ctxFor(comp);
  const emptyCtx: ComputeCtx = { rows: [], prevRows: [], metaRows: [], servico, idsInScope: new Set() };
  const prevCtx = prevMes ? ctxFor(prevMes) : emptyCtx;

  return indicatorsForBlock(block).map((def): IndicatorCardVM => {
    if (!def.available) {
      return {
        id: def.id,
        block: def.block,
        label: def.label,
        unit: def.unit,
        decimals: def.decimals ?? defaultDecimals(def.unit),
        polarity: def.polarity,
        available: false,
        value: 0,
        meta: null,
        metaUnit: def.metaCompare?.unit ?? def.unit,
        atingimento: null,
        delta: 0,
        description: def.description,
        footer: [],
        series: [],
        media: 0,
        related: [],
      };
    }

    const value = computeValue(def.compute, curCtx);
    const prevValue = computeValue(def.compute, prevCtx);
    // metaCompute yields the meta directly (already in final unit); otherwise
    // aggregate the per-city targets from metas_cidades.
    const meta = def.metaCompute
      ? computeValue(def.metaCompute, curCtx)
      : aggregateMeta(def, curCtx.rows, metaRecords, comp, servico);
    // When the meta describes a derived value (metaCompare), compare against it.
    const refValue = def.metaCompare ? computeValue(def.metaCompare.compute, curCtx) : value;
    const atingimento = meta === null || meta === 0 ? null : (refValue / meta) * 100;
    // Pro-rata projection only makes sense for volumes; ratios stay as-is.
    const projecao = def.unit === "percent" ? value : projection(value, comp);
    const footer = resolveFooter(def, { meta, atingimento, projecao, compute: curCtx });

    // Enrich the main series with the meta line + tooltip extras when declared.
    const series: SeriesPoint[] = months.map((m) => {
      const ctx = ctxFor(m);
      const point: SeriesPoint = { mes: m, valor: computeValue(def.compute, ctx) };

      if (def.chartMeta) point.meta = aggregateMeta(def, ctx.rows, metaRecords, m, servico);

      if (def.chartExtras)
        point.extras = def.chartExtras.map((e) => {
          const unit = e.unit ?? "qtd";

          return {
            label: e.label,
            display: fmtUnit(unit, computeValue(e.compute, ctx), e.decimals ?? defaultDecimals(unit)),
          };
        });

      return point;
    });
    const media = seriesMean(series);

    // Related metrics (detail modal): same scope, each charted on click.
    const related: RelatedIndicatorVM[] = (def.related ?? []).map((rel) => {
      const relSeries = buildSeries(rel.compute, months, ctxFor);
      const relValue = computeValue(rel.compute, curCtx);
      const relPrev = computeValue(rel.compute, prevCtx);

      return {
        id: rel.id,
        label: rel.label,
        unit: rel.unit,
        decimals: rel.decimals ?? defaultDecimals(rel.unit),
        polarity: rel.polarity,
        value: relValue,
        delta: relDelta(relValue, relPrev),
        media: seriesMean(relSeries),
        series: relSeries,
      };
    });

    return {
      id: def.id,
      block: def.block,
      label: def.label,
      unit: def.unit,
      decimals: def.decimals ?? defaultDecimals(def.unit),
      polarity: def.polarity,
      available: true,
      value,
      meta,
      metaUnit: def.metaCompare?.unit ?? def.unit,
      atingimento,
      delta: relDelta(value, prevValue),
      description: def.description,
      footer,
      series,
      media,
      related,
    };
  });
}
