import "server-only";

import { cache } from "react";
import { DatabricksDataClient } from "@/lib/data/databricks";
import { RH_ATUAL, isBindable } from "@/lib/data/estrutura-sql";
import { T } from "@/lib/data/admin/tables";

/**
 * The commercial structure behind the Cities dashboard: which gerência,
 * coordenação and supervisão answer for each city (ADR 0008, 0009).
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

/**
 * One path a city is reachable by, read off the ancestors of the bound node. A
 * city bound to two nodes has two. A ref is null when the path has no node of
 * that level — the tree skips levels (19 supervisões hang straight off a
 * gerência funcional) and a binding can sit above the level (a gerência pool).
 */
export interface VinculoEstrutura {
  cidadeId: number;
  gerencia: NoRef | null;
  coordenacao: NoRef | null;
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
    const client = new DatabricksDataClient();
    const [nodes, bindings] = await Promise.all([
      client.query<Record<string, unknown>>(
        `SELECT codigo_local, id_estrutura, nivel, nome, responsavel FROM ${RH_ATUAL} n WHERE ${isBindable("n")}`,
      ),
      client.query<Record<string, unknown>>(
        `SELECT codigo_local, revan_cidade_id FROM ${T.supervisaoCidades}`,
      ),
    ]);
    const byPath = new Map(nodes.map((n) => [str(n.id_estrutura), n]));
    const byCode = new Map(nodes.map((n) => [str(n.codigo_local), n]));

    return bindings.flatMap((v) => {
      const cidadeId = Number(v.revan_cidade_id);
      const node = byCode.get(str(v.codigo_local));

      if (!Number.isFinite(cidadeId) || !node) return [];

      const segments = str(node.id_estrutura).split(".");
      const path = segments
        .map((_, i) => byPath.get(segments.slice(0, i + 1).join(".")))
        .filter((n) => n !== undefined);

      const atLevel = (nivel: string) => {
        const found = path.findLast((n) => str(n.nivel) === nivel);

        return found ? ref(found.codigo_local, found.nome, found.responsavel) : null;
      };

      return [
        {
          cidadeId,
          gerencia: atLevel("gerencia_funcional") ?? atLevel("gerencia_executiva"),
          coordenacao: atLevel("coordenacao"),
          supervisao: atLevel("supervisao"),
        },
      ];
    });
  } catch (err) {
    console.error("[cities/estrutura] read failed:", err);

    return [];
  }
}
