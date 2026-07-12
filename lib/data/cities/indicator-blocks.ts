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

export interface IndicatorCardVM {
  id: string;
  block: IndicatorBlock;
  label: string;
  unit: IndicatorUnit;
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
  series: { mes: string; valor: number }[];
  media: number;
}

function fmtUnit(unit: IndicatorUnit, v: number): string {
  if (unit === "currency") return `R$ ${v.toFixed(1).replace(".", ",")}`;

  if (unit === "percent") return formatPct(v);

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

function computeValue(
  c: IndicatorCompute | undefined,
  rows: CityIndicatorRecord[],
  prevRows: CityIndicatorRecord[],
): number {
  if (!c) return 0;

  if (c.kind === "sum") return sum(rows, (r) => r[c.field] as number);

  if (c.kind === "ratio") {
    const den = sumFields(rows, c.den);

    return den === 0 ? 0 : (sumFields(rows, c.num) / den) * 100;
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

interface FooterCtx {
  meta: number | null;
  atingimento: number | null;
  projecao: number;
  curRows: CityIndicatorRecord[];
  prevRows: CityIndicatorRecord[];
}

/** Resolve the card footer columns (built-in stats + custom slots). */
function resolveFooter(def: IndicatorDef, ctx: FooterCtx): FooterStatVM[] {
  const slots: FooterSlot[] = def.footer ?? DEFAULT_FOOTER;
  const inverse = def.polarity === "down";

  return slots.map((slot): FooterStatVM => {
    if (slot === "meta") {
      const metaUnit = def.metaCompare ? def.metaCompare.unit : def.unit;

      return {
        label: "Meta",
        display: ctx.meta === null ? "—" : fmtUnit(metaUnit, ctx.meta),
        tone: "default",
      };
    }

    if (slot === "projecao") {
      return { label: "Projeção", display: fmtUnit(def.unit, ctx.projecao), tone: "default" };
    }

    if (slot === "atingimento") {
      const a = ctx.atingimento;

      if (a === null) return { label: "Ating.", display: "—", tone: "default" };

      const good = inverse ? a <= 100 : a >= 100;
      const warn = inverse ? a > 100 && a <= 130 : a >= 70 && a < 100;

      return { label: "Ating.", display: formatPct(a, 0), tone: good ? "good" : warn ? "warn" : "bad" };
    }

    const v = computeValue(slot.compute, ctx.curRows, ctx.prevRows);

    return { label: slot.label, display: fmtUnit(slot.unit ?? "qtd", v), tone: "default" };
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
  const curRows = rowsByMonth.get(comp) ?? [];
  const prevRows = prevMes ? (rowsByMonth.get(prevMes) ?? []) : [];

  return indicatorsForBlock(block).map((def): IndicatorCardVM => {
    if (!def.available) {
      return {
        id: def.id,
        block: def.block,
        label: def.label,
        unit: def.unit,
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
      };
    }

    const value = computeValue(def.compute, curRows, prevRows);
    const prevValue = computeValue(def.compute, prevRows, []);
    const meta = aggregateMeta(def, curRows, metaRecords, comp, servico);
    // When the meta describes a derived value (metaCompare), compare against it.
    const refValue = def.metaCompare ? computeValue(def.metaCompare.compute, curRows, prevRows) : value;
    const atingimento = meta === null || meta === 0 ? null : (refValue / meta) * 100;
    // Pro-rata projection only makes sense for volumes; ratios stay as-is.
    const projecao = def.unit === "percent" ? value : projection(value, comp);
    const footer = resolveFooter(def, { meta, atingimento, projecao, curRows, prevRows });

    const series = months.map((m, i) => {
      const rows = rowsByMonth.get(m) ?? [];
      const pr = i > 0 ? (rowsByMonth.get(months[i - 1]) ?? []) : [];

      return { mes: m, valor: computeValue(def.compute, rows, pr) };
    });
    const media = series.reduce((a, s) => a + s.valor, 0) / (series.length || 1);

    return {
      id: def.id,
      block: def.block,
      label: def.label,
      unit: def.unit,
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
    };
  });
}
