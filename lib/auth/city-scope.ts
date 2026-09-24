import "server-only";

/**
 * Data scope — the city axis.
 *
 * The person axis (`lib/auth/scope.ts`) narrows facts that carry a CPF. City
 * cubes carry none, so they need this: `tb_supervisao_cidades` binds RH nodes to
 * cities at two levels — a coordenação holds the pool, and the supervisões under
 * it split that pool (ADR 0008).
 *
 * Propagation, both directions, over `id_estrutura` (a materialized path):
 *
 *   • up — a gestor sees every city bound anywhere inside a subtree they answer
 *     for, which for a coordenador is their pool plus whatever the supervisões
 *     hold (a subset of it);
 *   • down — everyone else sees the cities of the NEAREST BINDABLE node above
 *     them, and only that node's. Not the union of the ancestors: a promotor
 *     under an empty supervisão must see nothing, never the coordenação's whole
 *     pool, which belongs to the sibling supervisões too.
 *
 * The binding set is small (a few hundred rows), so it is read whole and the
 * prefix logic runs here rather than as an OR-chain in SQL.
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

const ALL_CITIES: CityScope = { all: true };
const NO_CITIES: CityScope = { all: false, cities: new Set<number>() };

interface BindableNode {
  /** `id_estrutura` — the materialized path. */
  path: string;
  cities: Set<number>;
}

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
 * Every node a city could be bound to, with what it holds today. Nodes with no
 * binding are part of the answer, not noise: an empty supervisão is what stops
 * its team from inheriting the coordenação's pool.
 */
async function queryBindableNodes(): Promise<BindableNode[]> {
  const rh = `(SELECT codigo_local, id_estrutura, id_estrutura_pai, nivel
                 FROM ${HIERARQUIA_RH}
                WHERE data_carga = (SELECT max(data_carga) FROM ${HIERARQUIA_RH}))`;
  const rows = await new DatabricksDataClient().query<Record<string, unknown>>(
    `SELECT n.id_estrutura, v.revan_cidade_id
       FROM ${rh} n
       LEFT JOIN ${T.supervisaoCidades} v ON v.codigo_local = n.codigo_local
       LEFT JOIN ${rh} p ON p.id_estrutura = n.id_estrutura_pai
      WHERE n.nivel = 'coordenacao'
         OR (n.nivel = 'supervisao' AND p.nivel = 'coordenacao')`,
  );
  const byPath = new Map<string, BindableNode>();

  for (const r of rows) {
    const path = String(r.id_estrutura ?? "");

    if (!path) continue;

    const node = byPath.get(path) ?? { path, cities: new Set<number>() };
    const city = Number(r.revan_cidade_id);

    if (Number.isFinite(city)) node.cities.add(city);

    byPath.set(path, node);
  }

  return [...byPath.values()];
}

const isUnder = (path: string, ancestor: string) => path === ancestor || path.startsWith(`${ancestor}.`);

function resolveCities(nodes: BindableNode[], managed: string[], own: string[]): Set<number> {
  const cities = new Set<number>();

  for (const node of nodes) {
    if (managed.some((p) => isUnder(node.path, p))) {
      for (const city of node.cities) cities.add(city);
    }
  }

  for (const path of own) {
    const nearest = nodes
      .filter((n) => isUnder(path, n.path))
      .sort((a, b) => b.path.length - a.path.length)[0];

    if (nearest) for (const city of nearest.cities) cities.add(city);
  }

  return cities;
}

export async function resolveCityScope(user: SessionUser): Promise<CityScope> {
  if (user.isAdmin || user.escopoTipo === "todos") return ALL_CITIES;

  // The mock's revan_cidade_id are synthetic, so a real binding would match
  // nothing and blank the screen for every non-admin in DATA_SOURCE=mock.
  if (!isDatabricks()) return ALL_CITIES;

  const cpf = cpfDigits(user.escopoTipo === "gestor" ? user.escopoCpf : user.cpf);

  if (!cpf) return NO_CITIES;

  try {
    const [managed, own, nodes] = await Promise.all([
      findManagedNodes(cpf),
      queryOwnPaths(cpf),
      queryBindableNodes(),
    ]);
    const cities = resolveCities(nodes, collapsePrefixes(managed), own);

    return cities.size === 0 ? NO_CITIES : { all: false, cities };
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
