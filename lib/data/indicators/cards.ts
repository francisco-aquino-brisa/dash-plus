import type { CatalogEntry, ScreenCatalog } from "./screen-catalog";
import type { Formato } from "./spec";
import { specValue, type MonthPartial } from "./values";

export type TechVariant = "FTTH" | "FWA" | "BL" | "5G";

/**
 * One card of a block. Serviços of the technology family (FTTH/FWA/Banda
 * Larga/5G) of the same indicador geral collapse into one card, and the screen's
 * technology filter picks the variant; any other serviço (Mix, SVAs) is its own card.
 */
export interface CardSlot {
  id: string;
  bloco: string;
  ordem: number;
  padrao: boolean;
  variants: Partial<Record<TechVariant, CatalogEntry>>;
  single?: CatalogEntry;
}

export function techVariant(servico: string): TechVariant | null {
  const s = servico.trim().toUpperCase().replace(/\s+/g, "");

  if (s === "FTTH") return "FTTH";

  if (s === "FWA") return "FWA";

  if (s === "BANDALARGA" || s === "BL") return "BL";

  if (s === "5G") return "5G";

  return null;
}

export function cardSlots(catalog: ScreenCatalog, rota: string): CardSlot[] {
  const slots = new Map<string, CardSlot>();

  for (const p of catalog.placements) {
    if (p.rota !== rota) continue;

    const entry = catalog.entries.get(p.servicoId);

    if (!entry) continue;

    const variant = techVariant(entry.servico);
    const id = variant ? entry.idIndicadorGeral : entry.id;
    const key = `${p.bloco}|${id}`;
    let slot = slots.get(key);

    if (!slot) {
      slot = { id, bloco: p.bloco, ordem: p.ordem, padrao: p.padrao, variants: {} };
      slots.set(key, slot);
    }

    slot.ordem = Math.min(slot.ordem, p.ordem);
    slot.padrao ||= p.padrao;

    if (variant) slot.variants[variant] = entry;
    else slot.single = entry;
  }

  return [...slots.values()].sort((a, b) => a.ordem - b.ordem || a.id.localeCompare(b.id));
}

/** The entry a slot shows for the screen's technology, or none — then the card is left out. */
export function slotEntry(slot: CardSlot, variant: TechVariant): CatalogEntry | undefined {
  return slot.single ?? slot.variants[variant];
}

export function slotLabel(slot: CardSlot, entry: CatalogEntry): string {
  return slot.single ? entry.nome : entry.nomeGeral || entry.nome;
}

/** Every entry a page can show, plus what their detail modals relate to. */
export function pageEntries(catalog: ScreenCatalog, rota: string): CatalogEntry[] {
  const out = new Map<string, CatalogEntry>();

  for (const p of catalog.placements) {
    const e = p.rota === rota ? catalog.entries.get(p.servicoId) : undefined;

    if (!e) continue;

    out.set(e.id, e);

    for (const rel of e.spec.relacionados ?? []) {
      const r = catalog.entries.get(rel);

      if (r) out.set(r.id, r);
    }
  }

  return [...out.values()];
}

/** Display scale: a `percentual` ratio is stored as a fraction and shown in points. */
export function displayValue(formato: Formato, v: number | null): number | null {
  return v == null ? null : formato === "percentual" ? v * 100 : v;
}

/** The entry's monthly values for `months`, already in display scale (null = not computable). */
export function entrySeries(
  entry: CatalogEntry,
  partials: Map<string, MonthPartial> | undefined,
  months: string[],
): (number | null)[] {
  const at = (ym: string) => partials?.get(ym);

  return months.map((m) => displayValue(entry.spec.formato, specValue(entry.spec, at, m)));
}
