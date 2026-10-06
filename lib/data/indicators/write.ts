import "server-only";

import { DatabricksDataClient } from "@/lib/data/databricks";
import { randomUUID } from "node:crypto";
import { IND } from "./catalog";
import { bumpCatalogVersion } from "./screen-catalog";

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

/** Every catalog write goes through here so the screens drop their cached catalog. */
async function write(sql: string, params: unknown[]): Promise<void> {
  try {
    await new DatabricksDataClient().query(sql, params);
  } finally {
    bumpCatalogVersion();
  }
}

/** Persist (or clear, with null) the `especificacao_calculo` JSON of one serviço row. */
export async function updateEspecificacaoCalculo(servicoId: string, json: string | null): Promise<void> {
  await write(`UPDATE ${IND.servicos} SET especificacao_calculo = ? WHERE id = ?`, [json, servicoId]);
}

// ── Indicador geral ───────────────────────────────────────────────────────────

export async function createIndicadorGeral(
  id: string,
  categoria: string,
  nome: string,
  status: string,
): Promise<void> {
  await write(`INSERT INTO ${IND.gerais} (id, categoria, indicadores, status) VALUES (?, ?, ?, ?)`, [
    id,
    categoria,
    nome,
    status,
  ]);
}

/** Updates the parent row and cascades categoria/nome to its serviços' denormalized copies. */
export async function updateIndicadorGeral(
  id: string,
  categoria: string,
  nome: string,
  status: string,
): Promise<void> {
  await write(`UPDATE ${IND.gerais} SET categoria = ?, indicadores = ?, status = ? WHERE id = ?`, [
    categoria,
    nome,
    status,
    id,
  ]);
  await write(`UPDATE ${IND.servicos} SET categoria = ?, indicador_geral = ? WHERE id_indicador_geral = ?`, [
    categoria,
    nome,
    id,
  ]);
}

/** Deletes the parent, its serviços and their placements (Delta has no FK cascade — done manually). */
export async function deleteIndicadorGeral(id: string): Promise<void> {
  await write(
    `DELETE FROM ${IND.paginas}
      WHERE id_indicador_servico IN (SELECT id FROM ${IND.servicos} WHERE id_indicador_geral = ?)`,
    [id],
  );
  await write(`DELETE FROM ${IND.servicos} WHERE id_indicador_geral = ?`, [id]);
  await write(`DELETE FROM ${IND.gerais} WHERE id = ?`, [id]);
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
  await write(
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
  await write(
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
  await write(`DELETE FROM ${IND.paginas} WHERE id_indicador_servico = ?`, [id]);
  await write(`DELETE FROM ${IND.servicos} WHERE id = ?`, [id]);
}

// ── Onde aparece (indicadores_paginas) ────────────────────────────────────────

export interface PaginaIndicadorInput {
  paginaId: number;
  bloco: string;
  servicoId: string;
  ordem: number;
  padrao: boolean;
}

export async function createPaginaIndicador(input: PaginaIndicadorInput): Promise<void> {
  await write(
    `INSERT INTO ${IND.paginas}
       (id, pagina_id, id_indicador_servico, bloco, ordem, padrao, criado_em, atualizado_em)
     VALUES (?, ?, ?, ?, ?, ?, current_timestamp(), current_timestamp())`,
    [randomUUID(), input.paginaId, input.servicoId, input.bloco, input.ordem, input.padrao],
  );
}

export async function updatePaginaIndicador(id: string, ordem: number, padrao: boolean): Promise<void> {
  await write(
    `UPDATE ${IND.paginas} SET ordem = ?, padrao = ?, atualizado_em = current_timestamp() WHERE id = ?`,
    [ordem, padrao, id],
  );
}

export async function deletePaginaIndicador(id: string): Promise<void> {
  await write(`DELETE FROM ${IND.paginas} WHERE id = ?`, [id]);
}
