/**
 * Derived-table fragments for the two sources that describe the commercial
 * structure: the RH tree and the city organograma. Both need a "current load"
 * filter that is easy to get wrong, so it is written once here.
 */

import { HIERARQUIA_RH } from "./scope-sql";

const CAT = process.env.DATABRICKS_CITIES_CATALOG ?? "gdb_brisanet_comunidade_dev";
const SCHEMA = process.env.DATABRICKS_CITIES_SCHEMA ?? "projeto_brisa_performance";

export const ORGANOGRAMA = `\`${CAT}\`.\`${SCHEMA}\`.\`vw_organograma_cidades\``;

/**
 * `data` is a dd/MM/yyyy STRING, so `max(data)` is lexicographic and lands on a
 * December. Every read of this view has to parse before comparing.
 */
export const ORGANOGRAMA_ATUAL = `
  (SELECT revan_cidade_id, cidade, gerencia, coordenacao
     FROM ${ORGANOGRAMA}
    WHERE to_date(data, 'dd/MM/yyyy') = (SELECT max(to_date(data, 'dd/MM/yyyy')) FROM ${ORGANOGRAMA}))`;

/** The RH tree's latest load — the only one anything should read. */
export const RH_ATUAL = `
  (SELECT codigo_local, id_estrutura, id_estrutura_pai, nivel, nome, responsavel, email
     FROM ${HIERARQUIA_RH}
    WHERE data_carga = (SELECT max(data_carga) FROM ${HIERARQUIA_RH}))`;
