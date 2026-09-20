import dagre from "@dagrejs/dagre";
import { Position, type Edge, type Node } from "@xyflow/react";

/**
 * Box size per node type — authoritative, not a guess. Each `nodes.tsx` card
 * enforces this exact height (fixed height + `overflow: hidden` + truncated
 * text), so what dagre lays out for spacing is what the DOM actually renders.
 * A mismatch here (declaring 76px for a card that really renders 92px) is
 * what made the highlight ring and the edge's attachment point drift off the
 * visible card — the wrapper xyflow decorates is sized off this number, so it
 * has to be true.
 */
export const NODE_WIDTH = 232;
export const NODE_HEIGHT_BY_TYPE: Record<string, number> = {
  ancestor: 68,
  self: 86,
  manager: 92,
  person: 68,
  // Named "grupo", not "group" — xyflow reserves the literal type name
  // "group" for its own built-in container node and ships default CSS for
  // `.react-flow__node-group` (a border, fixed width, background) that would
  // otherwise bleed through underneath this card.
  grupo: 52,
};
const DEFAULT_NODE_HEIGHT = 76;

export function nodeHeight(type: string | undefined): number {
  return NODE_HEIGHT_BY_TYPE[type ?? ""] ?? DEFAULT_NODE_HEIGHT;
}

/**
 * Positions the currently visible nodes top-to-bottom with `@dagrejs/dagre`
 * (the maintained fork — the original `dagre` package is unmaintained).
 * Pure: takes the visible node/edge list, returns the same nodes with
 * `position` (and the matching `width`/`height`) filled in. Re-run on every
 * expand/collapse — trees this size (tens of visible nodes at most) relayout
 * instantly.
 */
export function layoutTree(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();

  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 24, ranksep: 56 });

  for (const n of nodes) g.setNode(n.id, { width: NODE_WIDTH, height: nodeHeight(n.type) });
  for (const e of edges) g.setEdge(e.source, e.target);

  dagre.layout(g);

  return nodes.map((n) => {
    const p = g.node(n.id);
    const height = nodeHeight(n.type);

    return {
      ...n,
      position: { x: p.x - NODE_WIDTH / 2, y: p.y - height / 2 },
      width: NODE_WIDTH,
      height,
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    };
  });
}
