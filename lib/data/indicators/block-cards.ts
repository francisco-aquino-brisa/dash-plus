import { formatBRL, formatNumber, formatPct } from "@/lib/format";
import { projection } from "../_shared";
import { cardSlots, entrySeries, slotEntry, slotLabel, type TechVariant } from "./cards";
import type { CatalogEntry, ScreenCatalog } from "./screen-catalog";
import type { Formato } from "./spec";
import type { MonthPartial } from "./values";

export type IndicatorBlock = "banda-larga" | "5g";
export type IndicatorUnit = "qtd" | "percent" | "currency";
/** "up" = maior é melhor; "down" = menor é melhor (churn). */
export type Polarity = "up" | "down";

/** A resolved footer column: label + formatted value + color tone. */
export interface FooterStatVM {
  label: string;
  display: string;
  /** Exact value for the hover tooltip when `display` is abbreviated (e.g. R$). */
  full?: string;
  tone: "good" | "warn" | "bad" | "default";
}

/** One point of a chart series. `target`/`extras` power the detail-chart overlays. */
export interface SeriesPoint {
  mes: string;
  valor: number;
  target?: number | null;
  extras?: { label: string; display: string }[];
}

/** A secondary metric shown in the detail modal; clicking it charts its series. */
export interface RelatedIndicatorVM {
  id: string;
  label: string;
  unit: IndicatorUnit;
  decimals: number;
  polarity: Polarity;
  value: number;
  /** % change vs previous month (relative). */
  delta: number;
  average: number;
  series: SeriesPoint[];
}

export interface IndicatorCardVM {
  id: string;
  block: IndicatorBlock;
  label: string;
  unit: IndicatorUnit;
  decimals: number;
  polarity: Polarity;
  available: boolean;
  value: number;
  target: number | null;
  targetUnit: IndicatorUnit;
  attainment: number | null;
  /** % change vs previous month (relative). */
  delta: number;
  description: string;
  footer: FooterStatVM[];
  series: SeriesPoint[];
  average: number;
  related: RelatedIndicatorVM[];
}

export interface IndicatorBlocksVM {
  bandaLarga: IndicatorCardVM[];
  g5: IndicatorCardVM[];
  /** Cards pre-selected for a reader who never picked their own. */
  defaults: Record<IndicatorBlock, string[]>;
}

export const NO_BLOCKS: IndicatorBlocksVM = {
  bandaLarga: [],
  g5: [],
  defaults: { "banda-larga": [], "5g": [] },
};

/** The data team presents rates and currency with two decimals. */
export function defaultDecimals(unit: IndicatorUnit): number {
  return unit === "qtd" ? 0 : 2;
}

function unitOf(formato: Formato): IndicatorUnit {
  return formato === "percentual" ? "percent" : formato === "moeda" ? "currency" : "qtd";
}

function polarityOf(e: CatalogEntry): Polarity {
  return e.spec.polaridade === "menor_melhor" ? "down" : "up";
}

function fmt(unit: IndicatorUnit, v: number, decimals: number): string {
  if (unit === "currency") return formatBRL(v, Math.max(decimals, 2));

  if (unit === "percent") return formatPct(v, decimals);

  return formatNumber(v);
}

function relDelta(cur: number, prev: number): number {
  return prev === 0 ? 0 : ((cur - prev) / Math.abs(prev)) * 100;
}

function mean(values: number[]): number {
  return values.reduce((a, v) => a + v, 0) / (values.length || 1);
}

export interface BlockInput {
  catalog: ScreenCatalog;
  rota: string;
  /** Summed partials per catalog entry id, keyed by `yyyy-MM`. */
  series: Map<string, Map<string, MonthPartial>>;
  /** Sources that failed (or can't honour the reader's filters) → their cards show "sem acesso". */
  failed: Set<string>;
  /** Months on the chart, in the screen's own format, oldest first. */
  months: string[];
  /** `months` as `yyyy-MM`. */
  yms: string[];
  competencia: string;
  variant: (block: IndicatorBlock) => TechVariant;
}

/**
 * The catalog-driven cards of a page's two blocks. Metas are not in the catalog
 * yet, so every card shows the no-target state.
 */
export function buildBlocks(input: BlockInput): IndicatorBlocksVM {
  const { catalog, rota, series, failed, months, yms, competencia } = input;
  const curIdx = months.indexOf(competencia);
  const sourceFailed = (e: CatalogEntry) => failed.has(e.spec.fonte);

  const valuesOf = (e: CatalogEntry) => {
    const vals = entrySeries(e, series.get(e.id), yms).map((v) => v ?? 0);
    const value = curIdx >= 0 ? vals[curIdx] : 0;
    const prev = curIdx > 0 ? vals[curIdx - 1] : 0;

    return { vals, value, prev };
  };

  const related = (e: CatalogEntry): RelatedIndicatorVM[] =>
    (e.spec.relacionados ?? []).flatMap((relId) => {
      const r = catalog.entries.get(relId);

      if (!r || sourceFailed(r)) return [];

      const rv = valuesOf(r);
      const unit = unitOf(r.spec.formato);

      return [
        {
          id: r.id,
          label: r.nome,
          unit,
          decimals: defaultDecimals(unit),
          polarity: polarityOf(r),
          value: rv.value,
          delta: relDelta(rv.value, rv.prev),
          average: mean(rv.vals),
          series: months.map((m, i) => ({ mes: m, valor: rv.vals[i] })),
        },
      ];
    });

  const toCard = (id: string, block: IndicatorBlock, label: string, e: CatalogEntry): IndicatorCardVM => {
    const unit = unitOf(e.spec.formato);
    const decimals = defaultDecimals(unit);
    const base = {
      id,
      block,
      label,
      unit,
      decimals,
      polarity: polarityOf(e),
      target: null,
      targetUnit: unit,
      attainment: null,
      description: e.descricao,
    };

    if (sourceFailed(e)) {
      return {
        ...base,
        available: false,
        value: 0,
        delta: 0,
        footer: [],
        series: [],
        average: 0,
        related: [],
      };
    }

    const { vals, value, prev } = valuesOf(e);
    const projected = e.spec.projecao === "linear" ? projection(value, yms[curIdx] ?? competencia) : null;

    return {
      ...base,
      available: true,
      value,
      delta: relDelta(value, prev),
      footer: [
        { label: "Meta", display: "—", tone: "default" },
        {
          label: "Projeção",
          display: projected == null ? "—" : fmt(unit, projected, decimals),
          full: projected != null && unit === "currency" ? fmt(unit, projected, decimals) : undefined,
          tone: "default",
        },
        { label: "Ating.", display: "—", tone: "default" },
      ],
      series: months.map((m, i) => ({ mes: m, valor: vals[i] })),
      average: mean(vals),
      related: related(e),
    };
  };

  const slots = cardSlots(catalog, rota);

  const block = (key: IndicatorBlock): IndicatorCardVM[] =>
    slots
      .filter((s) => s.bloco === key)
      .flatMap((s) => {
        const e = slotEntry(s, input.variant(key));

        return e ? [toCard(s.id, key, slotLabel(s, e), e)] : [];
      });

  const defaults = (key: IndicatorBlock) => slots.filter((s) => s.bloco === key && s.padrao).map((s) => s.id);

  return {
    bandaLarga: block("banda-larga"),
    g5: block("5g"),
    defaults: { "banda-larga": defaults("banda-larga"), "5g": defaults("5g") },
  };
}
