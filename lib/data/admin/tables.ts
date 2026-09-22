/**
 * Fully-qualified identifiers for the app-owned `tb_*` tables, built from the
 * same catalog/schema env the auth gate uses (ADR 0005). These are the only
 * writable tables in the warehouse and are touched only from the /admin path.
 */

const CAT = process.env.DATABRICKS_CITIES_CATALOG ?? "gdb_brisanet_comunidade_dev";
const SCHEMA = process.env.DATABRICKS_CITIES_SCHEMA ?? "projeto_brisa_performance";

const id = (table: string) => `\`${CAT}\`.\`${SCHEMA}\`.\`${table}\``;

export const T = {
  niveis: id("tb_niveis"),
  paginas: id("tb_paginas"),
  permissoes: id("tb_permissoes"),
  permissoesNivel: id("tb_permissoes_nivel"),
  usuarios: id("tb_usuarios"),
} as const;
