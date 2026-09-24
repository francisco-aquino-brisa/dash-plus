import "server-only";

import { DatabricksDataClient } from "@/lib/data/databricks";
import { T } from "@/lib/data/admin/tables";
import { BASE_CIDADE, nomeCidade, RH_ATUAL } from "@/lib/data/estrutura-sql";
import type { OrgCidade } from "./types";

/**
 * Which cities each structure node answers for, keyed by `id_estrutura` so the
 * org chart can match its own nodes without knowing about `codigo_local`.
 *
 * Read whole (a few hundred rows) and filtered per chart, like the hierarchy
 * snapshot itself — one query beats one per visible node.
 */
export async function readCidadesPorNo(): Promise<Record<string, OrgCidade[]>> {
  try {
    const rows = await new DatabricksDataClient().query<Record<string, unknown>>(
      `SELECT r.id_estrutura, v.revan_cidade_id AS id, ${nomeCidade("b")} AS cidade
         FROM ${T.supervisaoCidades} v
         JOIN ${RH_ATUAL} r ON r.codigo_local = v.codigo_local
         LEFT JOIN ${BASE_CIDADE} b ON b.revan_cidade_id = v.revan_cidade_id
        ORDER BY 3`,
    );
    const byPath: Record<string, OrgCidade[]> = {};

    for (const r of rows) {
      const path = String(r.id_estrutura ?? "");
      const id = Number(r.id);

      if (!path || !Number.isFinite(id)) continue;

      const nome = r.cidade == null ? `#${id}` : String(r.cidade);

      byPath[path] = [...(byPath[path] ?? []), { id, nome }];
    }

    return byPath;
  } catch (err) {
    console.error("[organograma/cidades] read failed:", err);

    return {};
  }
}
