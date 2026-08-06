import "server-only";

import { DatabricksDataClient } from "@/lib/data/databricks";
import { IND } from "./catalog";

/**
 * Write layer for the indicator catalog. Scoped to the app-owned catalog tables in
 * `projeto_brisa_performance` (see [[app-crud-write-path-allowed]] / ADR 0005): the
 * read-only rule applies to the internal validation scripts, not to these admin
 * writes. Every value is bound as an ordinal `?` param — never interpolated.
 */

/** Persist (or clear, with null) the `especificacao_calculo` JSON of one serviço row. */
export async function updateEspecificacaoCalculo(servicoId: string, json: string | null): Promise<void> {
  await new DatabricksDataClient().query(
    `UPDATE ${IND.servicos} SET especificacao_calculo = ? WHERE id = ?`,
    [json, servicoId],
  );
}
