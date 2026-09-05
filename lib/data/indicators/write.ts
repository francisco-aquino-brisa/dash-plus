import "server-only";

import { DatabricksDataClient } from "@/lib/data/databricks";
import { IND } from "./catalog";

/**
 * Write layer for the indicator catalog. Scoped to the app-owned catalog tables in
 * `projeto_brisa_performance` (see [[app-crud-write-path-allowed]] / ADR 0005): the
 * read-only rule applies to the internal validation scripts, not to these admin
 * writes. Every value is bound as an ordinal `?` param — never interpolated.
 *
 * `id` is a plain STRING primary key on both tables (verified via DESCRIBE TABLE
 * EXTENDED — not GENERATED ALWAYS AS IDENTITY), so the app supplies it explicitly
 * and must check uniqueness itself before INSERT (see read.ts `*Exists` helpers) —
 * Delta enforces no uniqueness constraint.
 */

/** Persist (or clear, with null) the `especificacao_calculo` JSON of one serviço row. */
export async function updateEspecificacaoCalculo(servicoId: string, json: string | null): Promise<void> {
  await new DatabricksDataClient().query(
    `UPDATE ${IND.servicos} SET especificacao_calculo = ? WHERE id = ?`,
    [json, servicoId],
  );
}

// ── Indicador geral ───────────────────────────────────────────────────────────

export async function createIndicadorGeral(
  id: string,
  categoria: string,
  nome: string,
  status: string,
): Promise<void> {
  await new DatabricksDataClient().query(
    `INSERT INTO ${IND.gerais} (id, categoria, indicadores, status) VALUES (?, ?, ?, ?)`,
    [id, categoria, nome, status],
  );
}

/** Updates the parent row and cascades categoria/nome to its serviços' denormalized copies. */
export async function updateIndicadorGeral(
  id: string,
  categoria: string,
  nome: string,
  status: string,
): Promise<void> {
  const client = new DatabricksDataClient();

  await client.query(`UPDATE ${IND.gerais} SET categoria = ?, indicadores = ?, status = ? WHERE id = ?`, [
    categoria,
    nome,
    status,
    id,
  ]);
  await client.query(
    `UPDATE ${IND.servicos} SET categoria = ?, indicador_geral = ? WHERE id_indicador_geral = ?`,
    [categoria, nome, id],
  );
}

/** Deletes the parent and all its serviços (Delta has no FK cascade — done manually). */
export async function deleteIndicadorGeral(id: string): Promise<void> {
  const client = new DatabricksDataClient();

  await client.query(`DELETE FROM ${IND.servicos} WHERE id_indicador_geral = ?`, [id]);
  await client.query(`DELETE FROM ${IND.gerais} WHERE id = ?`, [id]);
}

// ── Indicador serviço ─────────────────────────────────────────────────────────

export interface IndicadorServicoInput {
  id: string;
  idIndicadorGeral: string;
  categoria: string;
  indicadorGeral: string;
  servico: string;
  indicadorServico: string;
  descricao: string | null;
  tabela: string | null;
  colunas: string | null;
  formatoDado: string;
  polaridade: string;
  funcao: string | null;
  metrica: string | null;
  status: string;
}

export async function createIndicadorServico(input: IndicadorServicoInput): Promise<void> {
  await new DatabricksDataClient().query(
    `INSERT INTO ${IND.servicos}
       (id, id_indicador_geral, categoria, indicador_geral, servico, indicador_servico,
        descricao_indicador, tabela, colunas, formato_dado, polaridade, funcao, metrica, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.id,
      input.idIndicadorGeral,
      input.categoria,
      input.indicadorGeral,
      input.servico,
      input.indicadorServico,
      input.descricao,
      input.tabela,
      input.colunas,
      input.formatoDado,
      input.polaridade,
      input.funcao,
      input.metrica,
      input.status,
    ],
  );
}

/** Updates the serviço's own fields — `idIndicadorGeral`/`categoria`/`indicadorGeral` stay put. */
export async function updateIndicadorServico(input: IndicadorServicoInput): Promise<void> {
  await new DatabricksDataClient().query(
    `UPDATE ${IND.servicos} SET
       servico = ?, indicador_servico = ?, descricao_indicador = ?, tabela = ?, colunas = ?,
       formato_dado = ?, polaridade = ?, funcao = ?, metrica = ?, status = ?
     WHERE id = ?`,
    [
      input.servico,
      input.indicadorServico,
      input.descricao,
      input.tabela,
      input.colunas,
      input.formatoDado,
      input.polaridade,
      input.funcao,
      input.metrica,
      input.status,
      input.id,
    ],
  );
}

export async function deleteIndicadorServico(id: string): Promise<void> {
  await new DatabricksDataClient().query(`DELETE FROM ${IND.servicos} WHERE id = ?`, [id]);
}
