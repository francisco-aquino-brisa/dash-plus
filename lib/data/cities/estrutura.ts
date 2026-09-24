import "server-only";

import { cache } from "react";
import { DatabricksDataClient } from "@/lib/data/databricks";
import { RH_ATUAL } from "@/lib/data/estrutura-sql";
import { T } from "@/lib/data/admin/tables";

/**
 * The commercial structure behind the Cities dashboard: which gerência,
 * coordenação and supervisão answer for each city (ADR 0008).
 *
 * This replaces the `gerencia`/`coordenacao` columns the cubes carry, which
 * come from `vw_organograma_cidades` and disagree with RH — 31 coordenação
 * names against 68 RH nodes. Here the tree is RH's and the city binding is the
 * app's own `tb_supervisao_cidades`.
 */

export interface NoRef {
  /** `codigo_local` — what the filters carry in the URL. */
  codigo: string;
  nome: string;
  responsavel: string;
}

/** One path a city is reachable by. A city bound to two nodes has two. */
export interface VinculoEstrutura {
  cidadeId: number;
  /** Null for the three coordenações that hang straight off the diretoria. */
  gerencia: NoRef | null;
  coordenacao: NoRef;
  /** Null when the city sits in the coordenação's pool and no supervisão took it. */
  supervisao: NoRef | null;
}

function str(v: unknown): string {
  return v == null ? "" : String(v);
}

function ref(codigo: unknown, nome: unknown, responsavel: unknown): NoRef | null {
  const c = str(codigo);

  return c === "" ? null : { codigo: c, nome: str(nome), responsavel: str(responsavel) };
}

/**
 * A cheap version signal for the bindings, composed into the dataset's
 * watermark: the org labels are baked into the cached records, so an admin save
 * has to invalidate them. `count` alone would miss an edit, `max()` alone would
 * miss a delete.
 */
export const estruturaWatermark = cache(async (): Promise<string> => {
  try {
    const rows = await new DatabricksDataClient().query<Record<string, unknown>>(
      `SELECT count(*) AS n, CAST(max(atualizado_em) AS STRING) AS wm FROM ${T.supervisaoCidades}`,
    );

    return `${str(rows[0]?.n)}:${str(rows[0]?.wm)}`;
  } catch {
    return "indisponivel";
  }
});

export async function readVinculosEstrutura(): Promise<VinculoEstrutura[]> {
  try {
    const rows = await new DatabricksDataClient().query<Record<string, unknown>>(
      `WITH rh AS ${RH_ATUAL},
            no AS (
              SELECT n.codigo_local, n.nome, n.responsavel, n.nivel,
                     CASE WHEN n.nivel = 'coordenacao' THEN n.id_estrutura ELSE p.id_estrutura END AS coord
                FROM rh n
                LEFT JOIN rh p ON p.id_estrutura = n.id_estrutura_pai
               WHERE n.nivel = 'coordenacao' OR (n.nivel = 'supervisao' AND p.nivel = 'coordenacao')
            )
       SELECT v.revan_cidade_id AS cidade_id, no.nivel,
              no.codigo_local AS sup_codigo, no.nome AS sup_nome, no.responsavel AS sup_resp,
              c.codigo_local AS coord_codigo, c.nome AS coord_nome, c.responsavel AS coord_resp,
              g.codigo_local AS ger_codigo, g.nome AS ger_nome, g.responsavel AS ger_resp
         FROM ${T.supervisaoCidades} v
         JOIN no ON no.codigo_local = v.codigo_local
         JOIN rh c ON c.id_estrutura = no.coord
         LEFT JOIN rh g
           ON g.id_estrutura = c.id_estrutura_pai
          AND g.nivel IN ('gerencia_funcional', 'gerencia_executiva')`,
    );

    return rows.flatMap((r) => {
      const cidadeId = Number(r.cidade_id);
      const coordenacao = ref(r.coord_codigo, r.coord_nome, r.coord_resp);

      if (!Number.isFinite(cidadeId) || !coordenacao) return [];

      return [
        {
          cidadeId,
          gerencia: ref(r.ger_codigo, r.ger_nome, r.ger_resp),
          coordenacao,
          supervisao: str(r.nivel) === "supervisao" ? ref(r.sup_codigo, r.sup_nome, r.sup_resp) : null,
        },
      ];
    });
  } catch (err) {
    console.error("[cities/estrutura] read failed:", err);

    return [];
  }
}
