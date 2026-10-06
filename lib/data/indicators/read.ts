import "server-only";

import { DatabricksDataClient } from "@/lib/data/databricks";
import { T } from "@/lib/data/admin/tables";
import { IND } from "./catalog";
import { CATALOG_PAGES } from "./pages";
import type { IndicadorGeral, IndicadorServico, PaginaCatalogo, PaginaIndicador } from "./types";

/**
 * Read layer for the indicator catalog (admin area). Reads the two catalog tables
 * directly through the real Databricks client — independent of DATA_SOURCE, like
 * the auth gate and the admin `tb_*` reads (ADR 0005): the catalog only lives in
 * the warehouse, there is no mock.
 */

function toStr(v: unknown): string {
  return v == null ? "" : String(v);
}

function toNullStr(v: unknown): string | null {
  return v == null ? null : String(v);
}

const SERVICO_COLS = `id, id_indicador_geral, servico, indicador_servico, descricao_indicador,
        tabela, colunas, formato_dado, polaridade, funcao, metrica, status, especificacao_calculo`;

function mapServico(r: Record<string, unknown>): IndicadorServico {
  return {
    id: toStr(r.id),
    idIndicadorGeral: toStr(r.id_indicador_geral),
    servico: toStr(r.servico),
    indicadorServico: toStr(r.indicador_servico),
    descricao: toNullStr(r.descricao_indicador),
    tabela: toNullStr(r.tabela),
    colunas: toNullStr(r.colunas),
    formatoDado: toNullStr(r.formato_dado),
    polaridade: toNullStr(r.polaridade),
    funcao: toNullStr(r.funcao),
    metrica: toNullStr(r.metrica),
    status: toNullStr(r.status),
    especificacaoCalculo: toNullStr(r.especificacao_calculo),
  };
}

export async function readIndicadores(): Promise<IndicadorGeral[]> {
  const client = new DatabricksDataClient();

  try {
    const [gerais, servicos] = await Promise.all([
      client.query<Record<string, unknown>>(
        `SELECT id, categoria, indicadores, status FROM ${IND.gerais} ORDER BY id`,
      ),
      client.query<Record<string, unknown>>(
        `SELECT ${SERVICO_COLS} FROM ${IND.servicos} ORDER BY id_indicador_geral, servico`,
      ),
    ]);

    const byGeral = new Map<string, IndicadorServico[]>();

    for (const r of servicos) {
      const s = mapServico(r);
      const list = byGeral.get(s.idIndicadorGeral);

      if (list) list.push(s);
      else byGeral.set(s.idIndicadorGeral, [s]);
    }

    return gerais.map((r) => {
      const id = toStr(r.id);

      return {
        id,
        categoria: toStr(r.categoria),
        nome: toStr(r.indicadores),
        status: toNullStr(r.status),
        servicos: byGeral.get(id) ?? [],
      };
    });
  } catch (err) {
    console.error("[indicators/read] readIndicadores failed:", err);

    return [];
  }
}

/** Read a single indicator (by `indicadores_gerais.id`) with its serviços. */
export async function readIndicador(id: string): Promise<IndicadorGeral | null> {
  const client = new DatabricksDataClient();

  try {
    const [gerais, servicos] = await Promise.all([
      client.query<Record<string, unknown>>(
        `SELECT id, categoria, indicadores, status FROM ${IND.gerais} WHERE id = ?`,
        [id],
      ),
      client.query<Record<string, unknown>>(
        `SELECT ${SERVICO_COLS} FROM ${IND.servicos} WHERE id_indicador_geral = ? ORDER BY servico`,
        [id],
      ),
    ]);

    if (gerais.length === 0) return null;

    const g = gerais[0];

    return {
      id: toStr(g.id),
      categoria: toStr(g.categoria),
      nome: toStr(g.indicadores),
      status: toNullStr(g.status),
      servicos: servicos.map(mapServico),
    };
  } catch (err) {
    console.error("[indicators/read] readIndicador failed:", err);

    return null;
  }
}

/** Where each serviço of an indicador shows up. Degrades to none: the page still edits the indicador. */
export async function readPaginasDoIndicador(idIndicadorGeral: string): Promise<PaginaIndicador[]> {
  try {
    const rows = await new DatabricksDataClient().query<Record<string, unknown>>(
      `SELECT ip.id, ip.pagina_id, p.nome, p.rota, ip.bloco, ip.ordem, ip.padrao, ip.id_indicador_servico
         FROM ${IND.paginas} ip
         JOIN ${IND.servicos} s ON s.id = ip.id_indicador_servico
         JOIN ${T.paginas} p ON p.id = ip.pagina_id
        WHERE s.id_indicador_geral = ?
        ORDER BY p.nome, ip.bloco, ip.ordem`,
      [idIndicadorGeral],
    );

    return rows.map((r) => ({
      id: toStr(r.id),
      paginaId: Number(r.pagina_id),
      paginaNome: toStr(r.nome),
      rota: toStr(r.rota),
      bloco: toStr(r.bloco),
      ordem: Number(r.ordem ?? 0),
      padrao: r.padrao === true,
      servicoId: toStr(r.id_indicador_servico),
    }));
  } catch (err) {
    console.error("[indicators/read] readPaginasDoIndicador failed:", err);

    return [];
  }
}

/** The `tb_paginas` rows whose code builds blocks from the catalog. */
export async function readPaginasCatalogo(): Promise<PaginaCatalogo[]> {
  const rotas = CATALOG_PAGES.map((p) => p.rota);

  try {
    const rows = await new DatabricksDataClient().query<Record<string, unknown>>(
      `SELECT id, nome, rota FROM ${T.paginas} WHERE rota IN (${rotas.map(() => "?").join(", ")}) ORDER BY nome`,
      rotas,
    );

    return rows.map((r) => ({ id: Number(r.id), nome: toStr(r.nome), rota: toStr(r.rota) }));
  } catch (err) {
    console.error("[indicators/read] readPaginasCatalogo failed:", err);

    return [];
  }
}

export async function paginaIndicadorExists(
  paginaId: number,
  bloco: string,
  servicoId: string,
): Promise<boolean> {
  const rows = await new DatabricksDataClient().query<{ n: unknown }>(
    `SELECT count(*) AS n FROM ${IND.paginas} WHERE pagina_id = ? AND bloco = ? AND id_indicador_servico = ?`,
    [paginaId, bloco, servicoId],
  );

  return Number(rows[0]?.n ?? 0) > 0;
}

// ── Write-path guards ─────────────────────────────────────────────────────────
// Delta enforces no uniqueness constraint on `id` — the app must check itself
// before INSERT (see write.ts). Small, targeted counts; never used for listing.

async function countWhere(table: string, column: string, value: string): Promise<number> {
  const rows = await new DatabricksDataClient().query<{ n: unknown }>(
    `SELECT count(*) AS n FROM ${table} WHERE ${column} = ?`,
    [value],
  );

  return Number(rows[0]?.n ?? 0);
}

export async function indicadorGeralExists(id: string): Promise<boolean> {
  return (await countWhere(IND.gerais, "id", id)) > 0;
}

export async function indicadorServicoExists(id: string): Promise<boolean> {
  return (await countWhere(IND.servicos, "id", id)) > 0;
}

/** How many serviços an indicador currently has — guards "must keep at least one". */
export async function countServicosDoIndicador(idIndicadorGeral: string): Promise<number> {
  return countWhere(IND.servicos, "id_indicador_geral", idIndicadorGeral);
}
