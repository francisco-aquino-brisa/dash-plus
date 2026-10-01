/**
 * The pool rules of "Cidades por estrutura" over the RH tree (ADR 0009), pure so
 * the screen previews exactly what the save path enforces.
 *
 * A node's pool is the cities of the nearest node above it that holds any —
 * empty nodes in between are skipped. With nothing bound above, the node is a
 * root and may take any operated city.
 */

export interface TreeNode {
  codigoLocal: string;
  idEstrutura: string;
  parentCodigoLocal: string | null;
}

export type CitiesByNode<C> = ReadonlyMap<string, ReadonlySet<C>>;

/** Nearest bindable node above each one, from the materialized paths. */
export function parentsByPath<N extends { codigoLocal: string; idEstrutura: string }>(
  nodes: N[],
): Map<string, string | null> {
  const byPath = new Map(nodes.map((n) => [n.idEstrutura, n.codigoLocal]));
  const parents = new Map<string, string | null>();

  for (const n of nodes) {
    const segments = n.idEstrutura.split(".");
    let parent: string | null = null;

    for (let i = segments.length - 1; i > 0 && parent === null; i--) {
      parent = byPath.get(segments.slice(0, i).join(".")) ?? null;
    }

    parents.set(n.codigoLocal, parent);
  }

  return parents;
}

export const isBelow = (path: string, ancestor: string) => path.startsWith(`${ancestor}.`);

/** The node above that supplies the pool, or null when the node is a root. */
export function poolOwner<C, N extends TreeNode>(
  code: string,
  byCode: ReadonlyMap<string, N>,
  cities: CitiesByNode<C>,
): N | null {
  let parent = byCode.get(code)?.parentCodigoLocal ?? null;

  while (parent) {
    if ((cities.get(parent)?.size ?? 0) > 0) return byCode.get(parent) ?? null;

    parent = byCode.get(parent)?.parentCodigoLocal ?? null;
  }

  return null;
}

/** Every node below, at any depth. */
export function descendants<N extends TreeNode>(node: TreeNode, nodes: N[]): N[] {
  return nodes.filter((n) => isBelow(n.idEstrutura, node.idEstrutura));
}

/**
 * The nodes below `node` that draw their pool from it: descendants with cities
 * whose nearest holder above is `node`. Used when `node` goes from empty to
 * filled, since that is the one move that narrows someone else's pool.
 */
export function dependents<C, N extends TreeNode>(
  node: TreeNode,
  nodes: N[],
  byCode: ReadonlyMap<string, TreeNode>,
  cities: CitiesByNode<C>,
): N[] {
  return descendants(node, nodes).filter(
    (d) =>
      (cities.get(d.codigoLocal)?.size ?? 0) > 0 &&
      poolOwner(d.codigoLocal, byCode, cities)?.codigoLocal === node.codigoLocal,
  );
}
