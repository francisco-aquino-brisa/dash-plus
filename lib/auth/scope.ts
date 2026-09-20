import "server-only";

/**
 * Data scope — the IO half: turn a session into a `ScopeFilter`.
 *
 * Two orthogonal axes (see docs/hierarquia-permissionamento.md): the **nível**
 * decides what the user can open, this decides which rows they see inside it.
 *
 * Nothing about the hierarchy is stored on our side. `tb_usuarios` only says
 * WHOSE point of view the user takes — their own CPF, someone else's, or
 * everything — and the position itself is resolved against the live RH views on
 * every request. So a promotion, a re-parented node or a renumbered path is
 * absorbed on the next load with no migration and nothing to keep in sync.
 *
 * Being a manager is not a stored label either: it is "does a node list me as
 * its `responsavel`?". Someone who answers for no node sees only themselves,
 * which is how the 11 promotores that share one path stay invisible to each
 * other.
 */

import { cache } from "react";

import { DatabricksDataClient } from "@/lib/data/databricks";
import { getSession } from "./session";
import {
  EMPTY_SCOPE,
  HIERARQUIA,
  HIERARQUIA_RH,
  UNRESTRICTED_SCOPE,
  collapsePrefixes,
  cpfDigits,
  scopePredicate,
  type ScopeFilter,
} from "@/lib/data/scope-sql";
import type { SessionUser } from "./jwt";

export type { ScopeFilter };

/**
 * The nodes a CPF answers for, in the tree's current load.
 *
 * Matched through the node's `responsavel` e-mail rather than the person's own
 * `idestruturahierarquia`: both agree for every one of the 384 managers in the
 * view, but only the e-mail finds the manager who answers for more than one
 * node (a diretoria plus a gerência, say). The e-mail never leaves the RH side
 * — the key coming in is always the CPF.
 */
export interface ManagedNode {
  /** `id_estrutura` — the materialized path. */
  path: string;
  /** `diretoria` … `lideranca`. */
  nivel: string;
  nome: string;
}

async function queryManagedNodes(key: string): Promise<ManagedNode[]> {
  const rows = await new DatabricksDataClient().query<Record<string, unknown>>(
    `SELECT r.id_estrutura, r.nivel, r.nome
       FROM ${HIERARQUIA} h
       JOIN ${HIERARQUIA_RH} r
         ON lower(trim(r.email)) = lower(trim(h.email))
        AND r.data_carga = (SELECT max(data_carga) FROM ${HIERARQUIA_RH})
      WHERE h.cpf_digits = ?
        AND coalesce(trim(r.email), '') <> ''
      ORDER BY length(r.id_estrutura)`,
    [key],
  );

  return rows
    .map((r) => ({
      path: String(r.id_estrutura ?? ""),
      nivel: String(r.nivel ?? ""),
      nome: String(r.nome ?? ""),
    }))
    .filter((n) => n.path);
}

export async function findManagedNodes(cpf: string): Promise<string[]> {
  const key = cpfDigits(cpf);

  if (!key) return [];

  return (await queryManagedNodes(key)).map((n) => n.path);
}

export interface ScopeDescription {
  /** The nodes this CPF answers for, already collapsed. Empty ⇒ sees only itself. */
  nodes: ManagedNode[];
  /** How many people the scope covers right now. */
  people: number;
  /** False when the CPF is absent from `vw_hierarquia` (the view is CLT-only). */
  inHierarchy: boolean;
}

/**
 * What a CPF's scope resolves to today, for the admin form to show before
 * saving. Two round-trips, on an admin screen — worth it so nobody has to guess
 * what "segue a hierarquia" will mean for this particular person.
 */
export async function describeScope(cpf: string): Promise<ScopeDescription> {
  const key = cpfDigits(cpf);

  if (!key) return { nodes: [], people: 0, inHierarchy: false };

  const nodes = await queryManagedNodes(key);
  const paths = collapsePrefixes(nodes.map((n) => n.path));
  const kept = nodes.filter((n) => paths.includes(n.path));
  const client = new DatabricksDataClient();

  if (paths.length === 0) {
    const rows = await client.query<{ n: unknown }>(
      `SELECT count(*) AS n FROM ${HIERARQUIA} WHERE cpf_digits = ?`,
      [key],
    );
    const found = Number(rows[0]?.n ?? 0) > 0;

    return { nodes: [], people: found ? 1 : 0, inHierarchy: found };
  }

  const cond = "(idestruturahierarquia = ? OR idestruturahierarquia LIKE ?)";
  const rows = await client.query<{ n: unknown }>(
    `SELECT count(*) AS n FROM ${HIERARQUIA} WHERE ${paths.map(() => cond).join(" OR ")}`,
    paths.flatMap((p) => [p, `${p}.%`]),
  );

  return { nodes: kept, people: Number(rows[0]?.n ?? 0), inHierarchy: true };
}

/**
 * The rows this user may see. `isAdmin` short-circuits, so a session minted
 * before the scope columns existed still works: its missing claim falls back to
 * `proprio`, the closed end of the range, never to unrestricted.
 */
export async function resolveScope(user: SessionUser): Promise<ScopeFilter> {
  if (user.isAdmin || user.escopoTipo === "todos") return UNRESTRICTED_SCOPE;

  const cpf = cpfDigits(user.escopoTipo === "gestor" ? user.escopoCpf : user.cpf);

  if (!cpf) return EMPTY_SCOPE;

  const paths = await findManagedNodes(cpf);

  return { all: false, paths: collapsePrefixes(paths), cpfs: [cpf] };
}

/**
 * Is this person inside the scope?
 *
 * The guard for screens that take a person as a *filter* rather than listing
 * them: the Vendedor screen resolves one matrícula, and without this anybody
 * could read any seller by editing the querystring. Narrowing the picker is a
 * convenience; this is the check.
 *
 * Built from the same `scopePredicate` the row filter uses, on purpose — a
 * membership test that drifted from the filter would either open a person whose
 * rows then come back empty, or, worse, the other way round.
 */
export async function isInScope(
  scope: ScopeFilter,
  person: { matricula?: string | null; cpf?: string | null },
): Promise<boolean> {
  if (scope.all) return true;

  const matricula = (person.matricula ?? "").trim();
  const cpf = cpfDigits(person.cpf);
  const key = matricula ? "matricula" : "cpf";
  const value = matricula || cpf;

  if (!value) return false;

  const { where, params } = scopePredicate(scope, "?", key);
  const rows = await new DatabricksDataClient().query<{ ok: unknown }>(
    `SELECT 1 AS ok WHERE 1 = 1${where} LIMIT 1`,
    [value, ...params],
  );

  return rows.length > 0;
}

/**
 * The current request's scope, for the data layer.
 *
 * Resolved at the repository boundary rather than in each screen: a screen that
 * forgot to ask would otherwise query unscoped, and "forgot" is not a failure
 * mode a permission check may have. No session at all resolves to `EMPTY_SCOPE`,
 * which selects nothing.
 *
 * Memoized per request: a screen asks the repository for several things at once
 * (the aggregation and the filter options, at least) and each would otherwise
 * re-resolve the same nodes against the warehouse, which is metered. Admins
 * never query at all — `resolveScope` short-circuits before the round-trip.
 */
export const currentScope = cache(async (): Promise<ScopeFilter> => {
  const session = await getSession();

  if (!session) return EMPTY_SCOPE;

  return resolveScope(session);
});
