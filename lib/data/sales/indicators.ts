import type { IndicatorBlock } from "../indicators/block-cards";

/** localStorage preference keys for the per-block selection. */
export const SELECTION_PREF_KEY: Record<IndicatorBlock, string> = {
  "banda-larga": "vendas.blocos.banda-larga.selecionados",
  "5g": "vendas.blocos.5g.selecionados",
};
