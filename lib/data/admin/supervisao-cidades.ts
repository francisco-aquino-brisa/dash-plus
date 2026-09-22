import "server-only";

import { DatabricksDataClient } from "@/lib/data/databricks";
import { HIERARQUIA_RH } from "@/lib/data/scope-sql";
import { T } from "./tables";
import type { CidadeOpcao, Supervisao, SupervisaoCidadesData, VinculoOrfao } from "./types";

/**
 * Read layer for "Cidades por supervisão" (ADR 0008) — the app-owned binding
 * between a supervisão node and the cities it answers for.
 */

const CAT = process.env.DATABRICKS_CITIES_CATALOG ?? "gdb_brisanet_comunidade_dev";
const SCHEMA = process.env.DATABRICKS_CITIES_SCHEMA ?? "projeto_brisa_performance";
const ORGANOGRAMA = `\`${CAT}\`.\`${SCHEMA}\`.\`vw_organograma_cidades\``;

/**
 * `data` is a dd/MM/yyyy STRING, so `max(data)` is lexicographic and lands on a
 * December. Every read of this view has to parse before comparing.
 */
const ORGANOGRAMA_ATUAL = `
  (SELECT revan_cidade_id, cidade, gerencia, coordenacao
     FROM ${ORGANOGRAMA}
    WHERE to_date(data, 'dd/MM/yyyy') = (SELECT max(to_date(data, 'dd/MM/yyyy')) FROM ${ORGANOGRAMA}))`;

const SUPERVISOES_ATUAIS = `
  (SELECT codigo_local, id_estrutura, nome, responsavel, email
     FROM ${HIERARQUIA_RH}
    WHERE nivel = 'supervisao'
      AND data_carga = (SELECT max(data_carga) FROM ${HIERARQUIA_RH}))`;

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
    console.error(`[admin/supervisao-cidades] ${label} failed:`, err);

    return fallback;
  }
}

export async function readCidades(client: DatabricksDataClient): Promise<CidadeOpcao[]> {
  return safe("cidades", [], async () => {
    const rows = await client.query<Record<string, unknown>>(
      `SELECT revan_cidade_id AS id, max(cidade) AS cidade,
              max(gerencia) AS gerencia, max(coordenacao) AS coordenacao
         FROM ${ORGANOGRAMA_ATUAL}
        WHERE revan_cidade_id IS NOT NULL
        GROUP BY revan_cidade_id
        ORDER BY cidade`,
    );

    return rows.map((r) => ({
      id: Number(r.id),
      nome: toStr(r.cidade),
      gerencia: toStr(r.gerencia),
      coordenacao: toStr(r.coordenacao),
    }));
  });
}

/**
 * The supervisão nodes and their cities, read as two independent queries and
 * joined here: the binding table is young, and a LEFT JOIN against a table that
 * does not exist yet (or that loses its grant) would empty the whole screen
 * instead of just the "atribuídas" column.
 */
export async function readSupervisoes(client: DatabricksDataClient): Promise<Supervisao[]> {
  const [nos, vinculos] = await Promise.all([
    safe("supervisoes", [] as Omit<Supervisao, "cidadeIds">[], async () => {
      const rows = await client.query<Record<string, unknown>>(
        `SELECT codigo_local, id_estrutura, nome, responsavel, email
           FROM ${SUPERVISOES_ATUAIS}
          ORDER BY nome`,
      );

      return rows.map((r) => ({
        codigoLocal: toStr(r.codigo_local),
        idEstrutura: toStr(r.id_estrutura),
        nome: toStr(r.nome),
        responsavel: toNullStr(r.responsavel),
        email: toNullStr(r.email),
      }));
    }),
    readVinculos(client),
  ]);

  return nos.map((no) => ({ ...no, cidadeIds: vinculos.get(no.codigoLocal) ?? [] }));
}

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

export async function readOrfaos(client: DatabricksDataClient): Promise<VinculoOrfao[]> {
  return safe("orfaos", [], async () => {
    const rows = await client.query<Record<string, unknown>>(
      `SELECT v.codigo_local, v.revan_cidade_id
         FROM ${T.supervisaoCidades} v
        WHERE NOT EXISTS (SELECT 1 FROM ${SUPERVISOES_ATUAIS} s WHERE s.codigo_local = v.codigo_local)
        ORDER BY v.codigo_local`,
    );
    const byNode = new Map<string, number[]>();

    for (const r of rows) {
      const key = toStr(r.codigo_local);
      const cidade = Number(r.revan_cidade_id);

      byNode.set(key, [...(byNode.get(key) ?? []), ...(Number.isFinite(cidade) ? [cidade] : [])]);
    }

    return [...byNode.entries()].map(([codigoLocal, cidadeIds]) => ({ codigoLocal, cidadeIds }));
  });
}

export async function readSupervisaoCidades(): Promise<SupervisaoCidadesData> {
  const client = new DatabricksDataClient();
  const [supervisoes, cidades, orfaos] = await Promise.all([
    readSupervisoes(client),
    readCidades(client),
    readOrfaos(client),
  ]);

  return { supervisoes, cidades, orfaos };
}

/** Which of these nodes are still live supervisões in the current RH load. */
export async function filterSupervisoesValidas(codigos: string[]): Promise<string[]> {
  if (codigos.length === 0) return [];

  const marks = codigos.map(() => "?").join(", ");
  const rows = await new DatabricksDataClient().query<{ codigo: unknown }>(
    `SELECT codigo_local AS codigo FROM ${SUPERVISOES_ATUAIS} WHERE codigo_local IN (${marks})`,
    codigos,
  );

  return rows.map((r) => toStr(r.codigo)).filter(Boolean);
}

/** Which of these ids are real cities in the current organograma load. */
export async function filterCidadesValidas(ids: number[]): Promise<number[]> {
  if (ids.length === 0) return [];

  const marks = ids.map(() => "?").join(", ");
  const rows = await new DatabricksDataClient().query<{ id: unknown }>(
    `SELECT DISTINCT revan_cidade_id AS id FROM ${ORGANOGRAMA_ATUAL} WHERE revan_cidade_id IN (${marks})`,
    ids,
  );

  return rows.map((r) => Number(r.id)).filter((id) => Number.isFinite(id));
}
