import "server-only";

import { DatabricksDataClient } from "@/lib/data/databricks";
import { CIDADES_OPERADAS, RH_ATUAL } from "@/lib/data/estrutura-sql";
import { T } from "./tables";
import type { CidadeOpcao, EstruturaCidadesData, EstruturaNo, SupervisaoNo, VinculoOrfao } from "./types";

/**
 * Read layer for "Cidades por estrutura" (ADR 0008): the app-owned binding
 * between an RH node and the cities it answers for. Two levels bind — the
 * coordenação holds the pool, the supervisões under it split that pool.
 */

function toStr(v: unknown): string {
  return v == null ? "" : String(v);
}

function toNullStr(v: unknown): string | null {
  const s = toStr(v).trim();

  return s === "" || s === "-" ? null : s;
}

async function safe<T>(label: string, fallback: T, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    console.error(`[admin/estrutura-cidades] ${label} failed:`, err);

    return fallback;
  }
}

export async function readCidades(client: DatabricksDataClient): Promise<CidadeOpcao[]> {
  return safe("cidades", [], async () => {
    const rows = await client.query<Record<string, unknown>>(
      `SELECT id, nome FROM ${CIDADES_OPERADAS} ORDER BY nome`,
    );

    return rows.map((r) => ({ id: Number(r.id), nome: toStr(r.nome) }));
  });
}

/**
 * The bindable nodes: every coordenação, and every supervisão whose parent is
 * one. The 18 supervisões that hang straight off a gerência funcional are left
 * out — with no coordenação above them there is no pool to draw from, so they
 * cannot be filled in and are not shown.
 */
async function readNos(client: DatabricksDataClient) {
  return safe("nos", { coordenacoes: [] as EstruturaNo[], supervisoes: [] as SupervisaoNo[] }, async () => {
    const rows = await client.query<Record<string, unknown>>(
      `SELECT n.codigo_local, n.id_estrutura, n.nivel, n.nome, n.responsavel, n.email,
              p.codigo_local AS pai_codigo, p.nome AS pai_nome
         FROM ${RH_ATUAL} n
         LEFT JOIN ${RH_ATUAL} p ON p.id_estrutura = n.id_estrutura_pai
        WHERE n.nivel = 'coordenacao'
           OR (n.nivel = 'supervisao' AND p.nivel = 'coordenacao')
        ORDER BY n.nome`,
    );
    const coordenacoes: EstruturaNo[] = [];
    const supervisoes: SupervisaoNo[] = [];

    for (const r of rows) {
      const no = {
        codigoLocal: toStr(r.codigo_local),
        idEstrutura: toStr(r.id_estrutura),
        nome: toStr(r.nome),
        responsavel: toNullStr(r.responsavel),
        email: toNullStr(r.email),
        cidadeIds: [] as number[],
      };

      if (toStr(r.nivel) === "coordenacao") coordenacoes.push(no);
      else
        supervisoes.push({
          ...no,
          coordenacaoCodigoLocal: toStr(r.pai_codigo),
          coordenacaoNome: toStr(r.pai_nome),
        });
    }

    return { coordenacoes, supervisoes };
  });
}

/**
 * Read separately from the nodes, and joined here: the binding table is young,
 * and a LEFT JOIN against a table that does not exist yet (or that loses its
 * grant) would empty the whole screen instead of just the bound columns.
 */
async function readVinculos(client: DatabricksDataClient): Promise<Map<string, number[]>> {
  return safe("vinculos", new Map<string, number[]>(), async () => {
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
  });
}

export async function readEstruturaCidades(): Promise<EstruturaCidadesData> {
  const client = new DatabricksDataClient();
  const [{ coordenacoes, supervisoes }, vinculos, cidades] = await Promise.all([
    readNos(client),
    readVinculos(client),
    readCidades(client),
  ]);
  const fill = <T extends EstruturaNo>(no: T): T => ({
    ...no,
    cidadeIds: vinculos.get(no.codigoLocal) ?? [],
  });
  const bindable = new Set([...coordenacoes, ...supervisoes].map((n) => n.codigoLocal));
  const orfaos: VinculoOrfao[] = [...vinculos]
    .filter(([codigo]) => !bindable.has(codigo))
    .map(([codigoLocal, cidadeIds]) => ({ codigoLocal, cidadeIds }));

  return {
    coordenacoes: coordenacoes.map(fill),
    supervisoes: supervisoes.map(fill),
    cidades,
    orfaos,
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

export interface NoValidado {
  codigoLocal: string;
  nivel: "coordenacao" | "supervisao";
  /** For a supervisão, the coordenação above it. */
  paiCodigoLocal: string | null;
}

/**
 * Resolve nodes for the write path. A node absent from the result is not
 * bindable — it left the RH load, is the wrong level, or is one of the 18
 * supervisões with no coordenação above.
 */
export async function resolveNos(codigos: string[]): Promise<Map<string, NoValidado>> {
  if (codigos.length === 0) return new Map();

  const marks = codigos.map(() => "?").join(", ");
  const rows = await new DatabricksDataClient().query<Record<string, unknown>>(
    `SELECT n.codigo_local, n.nivel, p.codigo_local AS pai_codigo
       FROM ${RH_ATUAL} n
       LEFT JOIN ${RH_ATUAL} p ON p.id_estrutura = n.id_estrutura_pai
      WHERE n.codigo_local IN (${marks})
        AND (n.nivel = 'coordenacao' OR (n.nivel = 'supervisao' AND p.nivel = 'coordenacao'))`,
    codigos,
  );

  return new Map(
    rows.map((r) => [
      toStr(r.codigo_local),
      {
        codigoLocal: toStr(r.codigo_local),
        nivel: toStr(r.nivel) as NoValidado["nivel"],
        paiCodigoLocal: toNullStr(r.pai_codigo),
      },
    ]),
  );
}

/** The cities currently bound to these nodes. */
export async function readCidadesDosNos(codigos: string[]): Promise<Map<string, Set<number>>> {
  if (codigos.length === 0) return new Map();

  const marks = codigos.map(() => "?").join(", ");
  const rows = await new DatabricksDataClient().query<Record<string, unknown>>(
    `SELECT codigo_local, revan_cidade_id FROM ${T.supervisaoCidades} WHERE codigo_local IN (${marks})`,
    codigos,
  );
  const mapa = new Map<string, Set<number>>();

  for (const r of rows) {
    const codigo = toStr(r.codigo_local);
    const cidade = Number(r.revan_cidade_id);

    if (!Number.isFinite(cidade)) continue;

    mapa.set(codigo, (mapa.get(codigo) ?? new Set()).add(cidade));
  }

  return mapa;
}

/** The supervisões under a coordenação, for the cascade on removal. */
export async function readSupervisoesDaCoordenacao(codigos: string[]): Promise<Map<string, string[]>> {
  if (codigos.length === 0) return new Map();

  const marks = codigos.map(() => "?").join(", ");
  const rows = await new DatabricksDataClient().query<Record<string, unknown>>(
    `SELECT p.codigo_local AS pai_codigo, n.codigo_local
       FROM ${RH_ATUAL} n
       JOIN ${RH_ATUAL} p ON p.id_estrutura = n.id_estrutura_pai
      WHERE n.nivel = 'supervisao' AND p.nivel = 'coordenacao' AND p.codigo_local IN (${marks})`,
    codigos,
  );
  const mapa = new Map<string, string[]>();

  for (const r of rows) {
    const pai = toStr(r.pai_codigo);

    mapa.set(pai, [...(mapa.get(pai) ?? []), toStr(r.codigo_local)]);
  }

  return mapa;
}
