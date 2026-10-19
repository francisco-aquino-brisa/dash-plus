/**
 * Pages whose blocks are built from the catalog, keyed by `tb_paginas.rota`. A
 * page only reads `indicadores_paginas` once its code supports it, so the admin
 * offers only these.
 */
export interface CatalogPage {
  rota: string;
  blocos: { key: string; label: string }[];
}

export const CATALOG_PAGES: CatalogPage[] = [
  {
    rota: "/dashboard",
    blocos: [
      { key: "banda-larga", label: "Banda Larga" },
      { key: "5g", label: "5G" },
    ],
  },
  {
    rota: "/vendas",
    blocos: [
      { key: "banda-larga", label: "Banda Larga" },
      { key: "5g", label: "5G" },
    ],
  },
];

export function blocoLabel(rota: string, bloco: string): string {
  return CATALOG_PAGES.find((p) => p.rota === rota)?.blocos.find((b) => b.key === bloco)?.label ?? bloco;
}
