/**
 * Pure tree-building for the Organograma screen — no I/O, so it can be
 * exercised against a hand-built snapshot without a warehouse round-trip.
 *
 * The RH-only tree (`vw_hierarquia_rh`, 476 nodes) stops at `lideranca`;
 * people (`vw_hierarquia`) hang off it, sometimes deeper than any node when a
 * whole team shares one path past the last node (see
 * docs/hierarquia-permissionamento-referencia.md §1.3 — the PAP - ARACAJU/SE 1
 * example: one líder node plus 11 promotores one segment below it). That is
 * what `gruposSoltos` exists to hold instead of flooding the graph with one
 * box per person.
 *
 * "Is this person a manager?" is resolved the same way
 * `lib/auth/scope.ts#queryManagedNodes` resolves it against the warehouse: by
 * e-mail match against a node's `responsavel`, never by path equality — a
 * person's own `idestruturahierarquia` usually matches the one node they run,
 * but the two people who run more than one node would be missed by a
 * path-only check.
 */

import { collapsePrefixes, cpfDigits } from "@/lib/data/scope-sql";
import type {
  HierarquiaSnapshot,
  OrgAncestor,
  OrgChartResult,
  OrgGrupo,
  OrgNode,
  OrgPessoa,
  OrgPessoaLeaf,
  OrgTreeNode,
} from "./types";

function findByPath(nodes: OrgNode[], path: string | null): OrgNode | null {
  if (!path) return null;

  return nodes.find((n) => n.path === path) ?? null;
}

/** The node whose path is `path` itself, or the deepest node that is a prefix of it. */
export function findNodeForPath(nodes: OrgNode[], path: string): OrgNode | null {
  let best: OrgNode | null = null;

  for (const n of nodes) {
    if (path === n.path || path.startsWith(`${n.path}.`)) {
      if (!best || n.path.length > best.path.length) best = n;
    }
  }

  return best;
}

/** Every node this e-mail is the `responsavel` of — uncollapsed. */
export function findManagedNodePaths(nodes: OrgNode[], email: string): string[] {
  const key = email.trim().toLowerCase();

  if (!key) return [];

  return nodes.filter((n) => n.responsavelEmail === key).map((n) => n.path);
}

function toAncestor(n: OrgNode): OrgAncestor {
  return {
    path: n.path,
    nivel: n.nivel,
    nome: n.nome,
    responsavelNome: n.responsavelNome,
    responsavelEmail: n.responsavelEmail,
  };
}

/** Walks `parentPath` up from `start` to the root. `start` itself is included. */
export function buildAncestorChain(nodes: OrgNode[], start: OrgNode | null): OrgAncestor[] {
  const chain: OrgAncestor[] = [];
  let cursor = start;

  while (cursor) {
    chain.push(toAncestor(cursor));
    cursor = findByPath(nodes, cursor.parentPath);
  }

  return chain;
}

function toLeaf(p: OrgPessoa, selfCpf: string): OrgPessoaLeaf {
  return { cpf: p.cpf, nome: p.nome, cargo: p.cargo, situacao: p.situacao, isSelf: p.cpf === selfCpf };
}

/**
 * No automatic pluralization of `cargo` (Portuguese has too many irregular
 * plurals to guess) — the count carries the plural, the cargo stays singular.
 * Exported so the client can label a `pessoasDiretas` bucket the same way
 * once it crosses the group-collapse threshold (that decision is the UI's,
 * not this module's — see components/organograma/OrgChartScreen.tsx).
 */
export function summarizeGroupLabel(pessoas: Array<{ cargo: string | null }>): string {
  const counts = new Map<string, number>();

  for (const p of pessoas) {
    const cargo = p.cargo?.trim();

    if (cargo) counts.set(cargo, (counts.get(cargo) ?? 0) + 1);
  }

  let top: string | null = null;
  let topCount = 0;

  for (const [cargo, count] of counts) {
    if (count > topCount) {
      top = cargo;
      topCount = count;
    }
  }

  return top ? `${pessoas.length} pessoas · ${top}` : `${pessoas.length} pessoas`;
}

/** Buckets people whose path continues past `rootPath` but matches no child
 * node, grouped by the first path segment past `rootPath` (so a path two or
 * more segments deeper than any node still lands in one group, not one per
 * distinct sub-path). */
function groupLeftover(leftover: OrgPessoa[], rootPath: string, selfCpf: string): OrgGrupo[] {
  const buckets = new Map<string, OrgPessoa[]>();
  const prefixLen = rootPath.length + 1;

  for (const p of leftover) {
    const firstSegment = p.path.slice(prefixLen).split(".")[0];
    const key = `${rootPath}.${firstSegment}`;

    (buckets.get(key) ?? buckets.set(key, []).get(key)!).push(p);
  }

  return Array.from(buckets.entries()).map(([path, pessoas]) => ({
    path,
    label: summarizeGroupLabel(pessoas),
    pessoas: pessoas.map((p) => toLeaf(p, selfCpf)),
  }));
}

function buildDescendantTree(
  node: OrgNode,
  allNodes: OrgNode[],
  allPessoas: OrgPessoa[],
  selfCpf: string,
): OrgTreeNode {
  const childNodes = allNodes.filter((n) => n.parentPath === node.path);
  const children = childNodes.map((c) => buildDescendantTree(c, allNodes, allPessoas, selfCpf));

  const isResponsavel = (p: OrgPessoa) => node.responsavelEmail != null && p.email === node.responsavelEmail;
  const pessoasDiretas = allPessoas
    .filter((p) => p.path === node.path && !isResponsavel(p))
    .map((p) => toLeaf(p, selfCpf));

  const prefix = `${node.path}.`;
  const leftover = allPessoas.filter(
    (p) =>
      p.path.startsWith(prefix) &&
      !childNodes.some((c) => p.path === c.path || p.path.startsWith(`${c.path}.`)),
  );
  const gruposSoltos = groupLeftover(leftover, node.path, selfCpf);

  const totalPessoas =
    pessoasDiretas.length +
    gruposSoltos.reduce((sum, g) => sum + g.pessoas.length, 0) +
    children.reduce((sum, c) => sum + c.totalPessoas, 0);

  return {
    path: node.path,
    nivel: node.nivel,
    nome: node.nome,
    responsavelNome: node.responsavelNome,
    totalPessoas,
    pessoasDiretas,
    gruposSoltos,
    children,
  };
}

/**
 * The full chart for one CPF: who they answer to (one path, up to the root)
 * and who answers to them (one subtree per node they run — almost always 0 or
 * 1, up to 4 for the two people who run more than one node). `null` when the
 * CPF is not in `vw_hierarquia` at all — the caller renders the empty state.
 */
export function buildOrgChart(snapshot: HierarquiaSnapshot, cpfInput: string): OrgChartResult | null {
  const cpf = cpfDigits(cpfInput);

  if (!cpf) return null;

  const pessoa = snapshot.pessoas.find((p) => p.cpf === cpf);

  if (!pessoa) return null;

  const nearestNode = findNodeForPath(snapshot.nodes, pessoa.path);
  const managedPaths = pessoa.email
    ? collapsePrefixes(findManagedNodePaths(snapshot.nodes, pessoa.email))
    : [];
  const isManager = managedPaths.length > 0;

  // If the nearest node is one this person runs, it is not their ancestor —
  // it is them. The chain starts one level up. Otherwise (an individual
  // contributor, or a manager parked deeper than the node they happen to be
  // nearest to) the nearest node IS their immediate manager and belongs in
  // the chain.
  const nearestIsSelf =
    nearestNode != null && pessoa.email != null && nearestNode.responsavelEmail === pessoa.email;
  const ancestorStart = nearestNode
    ? nearestIsSelf
      ? findByPath(snapshot.nodes, nearestNode.parentPath)
      : nearestNode
    : null;

  const subtrees = managedPaths
    .map((path) => findByPath(snapshot.nodes, path))
    .filter((n): n is OrgNode => n != null)
    .map((node) => buildDescendantTree(node, snapshot.nodes, snapshot.pessoas, cpf));

  return {
    self: {
      cpf: pessoa.cpf,
      nome: pessoa.nome,
      cargo: pessoa.cargo,
      email: pessoa.email,
      situacao: pessoa.situacao,
      path: pessoa.path,
      isManager,
    },
    ancestors: buildAncestorChain(snapshot.nodes, ancestorStart),
    subtrees,
  };
}
