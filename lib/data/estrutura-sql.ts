/**
 * Derived-table fragments for the two sources that describe who answers for
 * what: the RH tree, and the city registry. Both need a "current" filter that
 * is easy to get wrong, so it is written once here.
 */

import { HIERARQUIA_RH } from "./scope-sql";

const CAT = process.env.DATABRICKS_CITIES_CATALOG ?? "gdb_brisanet_comunidade_dev";
const SCHEMA = process.env.DATABRICKS_CITIES_SCHEMA ?? "projeto_brisa_performance";

const FQ = (t: string) => `\`${CAT}\`.\`${SCHEMA}\`.\`${t}\``;

/** The Revan city registry: one row per `revan_cidade_id`, name and UF. */
export const BASE_CIDADE = FQ("public_base_cidade");

/** Name as the rest of the app writes it ("CIDADE / UF"), from the registry. */
export const nomeCidade = (alias: string) => `concat(${alias}.nome_cidade, ' / ', ${alias}.uf)`;

const INDICADORES = FQ("vw_indicadores_cidades");
const JANELA = `add_months((SELECT max(data) FROM ${INDICADORES}), -2)`;

/**
 * The cities the app may hand out: the registry narrowed to the ones the
 * performance cubes still move. The registry alone carries 2.3k rows, most of
 * them never operated, and a city absent from the cubes shows nothing to
 * whoever receives it — assigning it would grant an empty dashboard.
 */
export const CIDADES_OPERADAS = `
  (SELECT b.revan_cidade_id AS id, ${nomeCidade("b")} AS nome
     FROM ${BASE_CIDADE} b
     JOIN (SELECT DISTINCT revan_cidade_id AS id
             FROM ${INDICADORES}
            WHERE data >= ${JANELA}
              AND coalesce(base_ativa, 0) + coalesce(orcamentos, 0)
                + coalesce(instalacoes, 0) + coalesce(total_de_hp, 0) > 0
           UNION
           SELECT DISTINCT revan_cidade_id AS id
             FROM ${FQ("vw_indicadores_cidades_5g")}
            WHERE data >= ${JANELA}
              AND coalesce(base_ativa, 0) + coalesce(ativacao_mes, 0) > 0) c
       ON c.id = b.revan_cidade_id)`;

/** The RH tree's latest load — the only one anything should read. */
export const RH_ATUAL = `
  (SELECT codigo_local, id_estrutura, id_estrutura_pai, nivel, nome, responsavel, email
     FROM ${HIERARQUIA_RH}
    WHERE data_carga = (SELECT max(data_carga) FROM ${HIERARQUIA_RH}))`;
