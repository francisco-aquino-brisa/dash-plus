import "server-only";

import { DatabricksDataClient } from "@/lib/data/databricks";
import { IND } from "./catalog";
import type { IndicadorGeral, IndicadorServico } from "./types";

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
