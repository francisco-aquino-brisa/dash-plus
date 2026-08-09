/**
 * Fully-qualified identifiers for the indicator catalog, migrated into
 * `projeto_brisa_performance` as three MANAGED tables (2026-08):
 *
 * - `indicadores_gerais`   — the parent indicator (id, categoria, nome, status)
 * - `indicadores_servicos` — one row per indicator × serviço, carrying the formula
 *   (`tabela`/`colunas`/`formato_dado`/`polaridade`/`funcao`/`metrica`) and the
 *   new machine-executable `especificacao_calculo` (JSON)
 * - `indicadores_setores`  — indicator assignment per setor/gerente
 *
 * Same catalog/schema env as the admin `tb_*` tables (ADR 0005). These are
 * app-owned and are the only indicator tables the admin area writes to.
 */

const CAT = process.env.DATABRICKS_CITIES_CATALOG ?? "gdb_brisanet_comunidade_dev";
const SCHEMA = process.env.DATABRICKS_CITIES_SCHEMA ?? "projeto_brisa_performance";

const id = (table: string) => `\`${CAT}\`.\`${SCHEMA}\`.\`${table}\``;

export const IND = {
  gerais: id("indicadores_gerais"),
  servicos: id("indicadores_servicos"),
  setores: id("indicadores_setores"),
} as const;
