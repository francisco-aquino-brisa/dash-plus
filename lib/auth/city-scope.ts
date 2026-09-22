import "server-only";

/**
 * Data scope — the city axis.
 *
 * The person axis (`lib/auth/scope.ts`) narrows facts that carry a CPF. City
 * cubes carry none, so they need this: `tb_supervisao_cidades` binds each
 * supervisão NODE (`vw_hierarquia_rh.codigo_local`) to the cities it answers
 * for, and the RH tree propagates the binding in both directions —
 *
 *   • up: a coordenador/gerente sees every city bound below their node;
 *   • down: a promotor sees the cities of the supervisão above them.
 *
 * Both are prefix tests on the same materialized path, so the whole thing is
 * one query. Binding by node and not by person is what makes a supervisor's
 * replacement inherit the cities with no re-cadastro; the binding only goes
 * stale when the node itself leaves the RH load, and then the city is free
 * again (the join below stops matching).
 */

import { cache } from "react";

import { isDatabricks } from "@/lib/data/client";
import { DatabricksDataClient } from "@/lib/data/databricks";
import { T } from "@/lib/data/admin/tables";
import { HIERARQUIA, HIERARQUIA_RH, collapsePrefixes, cpfDigits } from "@/lib/data/scope-sql";
import { getSession } from "./session";
import { findManagedNodes } from "./scope";
import type { SessionUser } from "./jwt";

export type CityScope = { all: true } | { all: false; cities: ReadonlySet<number> };

export const ALL_CITIES: CityScope = { all: true };
export const NO_CITIES: CityScope = { all: false, cities: new Set<number>() };

/** Every distinct position this CPF occupies, deepest included. */
async function queryOwnPaths(cpf: string): Promise<string[]> {
  const rows = await new DatabricksDataClient().query<{ path: unknown }>(
    `SELECT DISTINCT idestruturahierarquia AS path
       FROM ${HIERARQUIA}
      WHERE cpf_digits = ?
        AND coalesce(trim(idestruturahierarquia), '') <> ''`,
    [cpf],
  );

  return rows.map((r) => String(r.path ?? "")).filter(Boolean);
}

/**
 * `managed` are the nodes the reader answers for (their subtree counts);
 * `own` are the positions they occupy (the nodes ABOVE count). The two cannot
 * be collapsed into one list — the test runs in opposite directions.
 */
async function queryCities(managed: string[], own: string[]): Promise<number[]> {
  if (managed.length === 0 && own.length === 0) return [];

  const conds: string[] = [];
  const params: unknown[] = [];

  for (const path of managed) {
    conds.push("(r.id_estrutura = ? OR r.id_estrutura LIKE ?)");
    params.push(path, `${path}.%`);
  }

  for (const path of own) {
    conds.push("(r.id_estrutura = ? OR ? LIKE concat(r.id_estrutura, '.%'))");
    params.push(path, path);
  }

  const rows = await new DatabricksDataClient().query<{ id: unknown }>(
    `SELECT DISTINCT v.revan_cidade_id AS id
       FROM ${T.supervisaoCidades} v
       JOIN ${HIERARQUIA_RH} r
         ON r.codigo_local = v.codigo_local
        AND r.nivel = 'supervisao'
        AND r.data_carga = (SELECT max(data_carga) FROM ${HIERARQUIA_RH})
      WHERE ${conds.join(" OR ")}`,
    params,
  );

  return rows.map((r) => Number(r.id)).filter((id) => Number.isFinite(id));
}

export async function resolveCityScope(user: SessionUser): Promise<CityScope> {
  if (user.isAdmin || user.escopoTipo === "todos") return ALL_CITIES;

  // The mock's revan_cidade_id are synthetic, so a real binding would match
  // nothing and blank the screen for every non-admin in DATA_SOURCE=mock.
  if (!isDatabricks()) return ALL_CITIES;

  const cpf = cpfDigits(user.escopoTipo === "gestor" ? user.escopoCpf : user.cpf);

  if (!cpf) return NO_CITIES;

  try {
    const [managed, own] = await Promise.all([findManagedNodes(cpf), queryOwnPaths(cpf)]);
    const cities = await queryCities(collapsePrefixes(managed), own);

    return cities.length === 0 ? NO_CITIES : { all: false, cities: new Set(cities) };
  } catch (err) {
    // Fail closed: a warehouse hiccup must not hand a restricted reader every
    // city. Admins never reach this branch.
    console.error("[city-scope] resolution failed:", err);

    return NO_CITIES;
  }
}

export const currentCityScope = cache(async (): Promise<CityScope> => {
  const session = await getSession();

  if (!session) return NO_CITIES;

  return resolveCityScope(session);
});
