import "server-only";

import { DatabricksDataClient } from "@/lib/data/databricks";
import { HIERARQUIA, HIERARQUIA_RH } from "@/lib/data/scope-sql";
import type { HierarquiaSnapshot, NivelHierarquia, OrgNode, OrgPessoa } from "./types";

/**
 * Both views are small (476 structure nodes, 2.885 people) — trivial next to
 * the multi-million-row fact tables the rest of the app queries. So instead
 * of one round-trip per viewer, we read each view whole and let the caller
 * (repository.ts) cache it by watermark and slice it in memory per person.
 */

function toStr(v: unknown): string {
  return v == null ? "" : String(v);
}

function toNullStr(v: unknown): string | null {
  const s = v == null ? "" : String(v).trim();

  return s === "" ? null : s;
}

function mapNode(r: Record<string, unknown>): OrgNode {
  return {
    path: toStr(r.id_estrutura),
    parentPath: toNullStr(r.id_estrutura_pai),
    nivel: toStr(r.nivel) as NivelHierarquia,
    nome: toStr(r.nome),
    responsavelNome: toStr(r.responsavel),
    responsavelEmail: toNullStr(r.email)?.toLowerCase() ?? null,
  };
}

function mapPessoa(r: Record<string, unknown>): OrgPessoa {
  return {
    cpf: toStr(r.cpf),
    nome: toStr(r.nome),
    cargo: toNullStr(r.cargo),
    email: toNullStr(r.email)?.toLowerCase() ?? null,
    situacao: toNullStr(r.situacao),
    path: toStr(r.path),
  };
}

/** Cheap freshness probe — the RH structure view's own `data_carga`. */
export async function databricksHierarquiaWatermark(): Promise<string> {
  const rows = await new DatabricksDataClient().query<{ w: unknown }>(
    `SELECT CAST(max(data_carga) AS STRING) AS w FROM ${HIERARQUIA_RH}`,
  );

  return toStr(rows[0]?.w) || "none";
}

export async function databricksHierarquiaSnapshot(): Promise<HierarquiaSnapshot> {
  const client = new DatabricksDataClient();

  const [watermark, nodeRows, pessoaRows] = await Promise.all([
    databricksHierarquiaWatermark(),
    client.query<Record<string, unknown>>(
      `SELECT id_estrutura, id_estrutura_pai, nivel, nome, responsavel, email
         FROM ${HIERARQUIA_RH}
        WHERE data_carga = (SELECT max(data_carga) FROM ${HIERARQUIA_RH})`,
    ),
    client.query<Record<string, unknown>>(
      `SELECT cpf_digits AS cpf, nome, cargo, email, situacao, idestruturahierarquia AS path
         FROM ${HIERARQUIA}
        WHERE coalesce(trim(idestruturahierarquia), '') <> ''`,
    ),
  ]);

  return {
    watermark,
    nodes: nodeRows.map(mapNode).filter((n) => n.path),
    pessoas: pessoaRows.map(mapPessoa).filter((p) => p.cpf),
  };
}
