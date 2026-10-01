import "server-only";

import { DatabricksDataClient } from "@/lib/data/databricks";
import { CIDADES_OPERADAS, RH_ATUAL, isBindable } from "@/lib/data/estrutura-sql";
import { parentsByPath } from "./tree-pool";
import { T } from "./tables";
import type { CidadeOpcao, EstruturaCidadesData, EstruturaNo, VinculoOrfao } from "./types";

/**
 * Read layer for "Cidades por estrutura" (ADR 0008, 0009): the app-owned binding
 * between an RH node and the cities it answers for. Any level but liderança
 * binds; a node draws from the nearest node above it that holds cities.
 */

function toStr(v: unknown): string {
  return v == null ? "" : String(v);
}

function toNullStr(v: unknown): string | null {
  const s = toStr(v).trim();

  return s === "" || s === "-" ? null : s;
}

async function safe<T>(label: string, run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch (err) {
    console.error(`[admin/estrutura-cidades] ${label} failed:`, err);

    return null;
  }
}

async function readCidades(client: DatabricksDataClient): Promise<CidadeOpcao[]> {
  const rows = await client.query<Record<string, unknown>>(
    `SELECT id, nome FROM ${CIDADES_OPERADAS} ORDER BY nome`,
  );

  return rows.map((r) => ({ id: Number(r.id), nome: toStr(r.nome) }));
}

/** The bindable nodes of the current RH load, each with its nearest bindable parent. */
export async function readNodes(
  client: DatabricksDataClient = new DatabricksDataClient(),
): Promise<EstruturaNo[]> {
  const rows = await client.query<Record<string, unknown>>(
    `SELECT codigo_local, id_estrutura, nivel, nome, responsavel, email
       FROM ${RH_ATUAL} n
      WHERE ${isBindable("n")}
      ORDER BY id_estrutura`,
  );
  const nodes = rows.map((r) => ({
    codigoLocal: toStr(r.codigo_local),
    idEstrutura: toStr(r.id_estrutura),
    nivel: toStr(r.nivel),
    parentCodigoLocal: null as string | null,
    nome: toStr(r.nome),
    responsavel: toNullStr(r.responsavel),
    email: toNullStr(r.email),
    cidadeIds: [] as number[],
  }));
  const parents = parentsByPath(nodes);

  return nodes.map((n) => ({ ...n, parentCodigoLocal: parents.get(n.codigoLocal) ?? null }));
}

export async function readVinculos(
  client: DatabricksDataClient = new DatabricksDataClient(),
): Promise<Map<string, number[]>> {
  const rows = await client.query<Record<string, unknown>>(
    `SELECT codigo_local, revan_cidade_id FROM ${T.supervisaoCidades}`,
  );
  const mapa = new Map<string, number[]>();

  for (const r of rows) {
    const codigo = toStr(r.codigo_local);
    const cidade = Number(r.revan_cidade_id);

    if (codigo && Number.isFinite(cidade)) mapa.set(codigo, [...(mapa.get(codigo) ?? []), cidade]);
  }

  return mapa;
}

export async function readEstruturaCidades(): Promise<EstruturaCidadesData> {
  const client = new DatabricksDataClient();
  const [nodes, vinculos, cidades] = await Promise.all([
    safe("nodes", () => readNodes(client)),
    safe("vinculos", () => readVinculos(client)),
    safe("cidades", () => readCidades(client)),
  ]);

  // All or nothing: a partial screen reads as "nothing bound", and with the
  // nodes missing every binding would be listed as an orphan, one click from
  // being deleted.
  if (!nodes || !vinculos || !cidades) return { nodes: [], cidades: [], orfaos: [], failed: true };

  const bindable = new Set(nodes.map((n) => n.codigoLocal));
  const orfaos: VinculoOrfao[] = [...vinculos]
    .filter(([codigo]) => !bindable.has(codigo))
    .map(([codigoLocal, cidadeIds]) => ({ codigoLocal, cidadeIds }));

  return {
    nodes: nodes.map((n) => ({ ...n, cidadeIds: vinculos.get(n.codigoLocal) ?? [] })),
    cidades,
    orfaos,
    failed: false,
  };
}

/** Which of these ids the app may actually hand out. */
export async function filterCidadesValidas(ids: number[]): Promise<number[]> {
  if (ids.length === 0) return [];

  const marks = ids.map(() => "?").join(", ");
  const rows = await new DatabricksDataClient().query<{ id: unknown }>(
    `SELECT id FROM ${CIDADES_OPERADAS} WHERE id IN (${marks})`,
    ids,
  );

  return rows.map((r) => Number(r.id)).filter((id) => Number.isFinite(id));
}
