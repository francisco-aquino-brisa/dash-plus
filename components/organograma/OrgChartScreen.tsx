"use client";

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  Background,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type OnNodeDrag,
  type XYPosition,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { LocateFixed, Network } from "lucide-react";
import { AsyncSelect, type AsyncOption } from "@/components/admin/AsyncSelect";
import { summarizeGroupLabel } from "@/lib/data/organograma/compute";
import type { OrgChartResult, OrgPessoaLeaf, OrgTreeNode } from "@/lib/data/organograma/types";
import { loadOrgChartForCpf, searchOrgPessoas } from "@/app/(app)/organograma/actions";
import { GroupDialog } from "./GroupDialog";
import { layoutTree } from "./layout";
import { ORG_NODE_TYPES } from "./nodes";

/** Above this, a bucket of people collapses into one "+N pessoas" card
 * instead of one box per person — chosen so a busy leadership node (dozens of
 * direct reports) doesn't flood the canvas. */
const GROUP_THRESHOLD = 8;

interface OpenGroup {
  label: string;
  pessoas: OrgPessoaLeaf[];
}

export function OrgChartScreen({
  initial,
  canSearch,
}: {
  initial: OrgChartResult | null;
  canSearch: boolean;
}) {
  const [chart, setChart] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [ancestorsShown, setAncestorsShown] = useState(() => Math.min(1, initial?.ancestors.length ?? 0));
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(initial?.subtrees.map((t) => t.path) ?? []),
  );
  const [openGroup, setOpenGroup] = useState<OpenGroup | null>(null);
  const [selected, setSelected] = useState<AsyncOption | null>(null);
  // Manual drag positions, keyed by node id — layered on top of the dagre
  // layout so dragging a box survives an unrelated expand/collapse elsewhere
  // in the tree (which recomputes everyone else's position from scratch).
  const [dragOverrides, setDragOverrides] = useState<Record<string, XYPosition>>({});
  // The edge the user last clicked — highlights that connection plus the
  // whole chain up to the top of what's currently visible, dims the rest.
  const [highlightedEdgeId, setHighlightedEdgeId] = useState<string | null>(null);

  const applyChart = useCallback((next: OrgChartResult | null) => {
    setChart(next);
    setAncestorsShown(Math.min(1, next?.ancestors.length ?? 0));
    setExpanded(new Set(next?.subtrees.map((t) => t.path) ?? []));
    setDragOverrides({});
    setHighlightedEdgeId(null);
  }, []);

  const handleSelect = useCallback(
    async (option: AsyncOption | null) => {
      setSelected(option);

      if (!option) {
        applyChart(null);

        return;
      }

      setLoading(true);

      try {
        applyChart(await loadOrgChartForCpf(option.value));
      } finally {
        setLoading(false);
      }
    },
    [applyChart],
  );

  const toggle = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);

      if (next.has(path)) next.delete(path);
      else next.add(path);

      return next;
    });
  }, []);

  const searchPessoas = useCallback(
    (query: string) =>
      searchOrgPessoas(query).then((rows) =>
        rows.map((r) => ({ value: r.cpf, label: r.nome, hint: r.cargo ?? r.email ?? undefined })),
      ),
    [],
  );

  const { nodes, edges } = useMemo(
    () => buildGraph(chart, ancestorsShown, expanded, setAncestorsShown, toggle, setOpenGroup),
    [chart, ancestorsShown, expanded, toggle],
  );
  const laidOut = useMemo(() => layoutTree(nodes, edges), [nodes, edges]);
  const positioned = useMemo(
    () => laidOut.map((n) => (dragOverrides[n.id] ? { ...n, position: dragOverrides[n.id] } : n)),
    [laidOut, dragOverrides],
  );

  const handleNodeDragStop: OnNodeDrag = useCallback((_event, node) => {
    setDragOverrides((prev) => ({ ...prev, [node.id]: node.position }));
  }, []);

  const resetLayout = useCallback(() => setDragOverrides({}), []);

  // Clicking an edge highlights the chain of command it belongs to: that
  // edge, plus every edge above it up to the top of what's currently shown.
  // A tree has exactly one incoming edge per node, so "walk up" is unambiguous.
  const highlight = useMemo(() => {
    if (!highlightedEdgeId) return null;

    const clicked = edges.find((e) => e.id === highlightedEdgeId);

    if (!clicked) return null;

    const parentEdgeByTarget = new Map(edges.map((e) => [e.target, e]));
    const nodeIds = new Set([clicked.source, clicked.target]);
    const edgeIds = new Set([clicked.id]);
    let cursor = clicked.source;

    for (let parent = parentEdgeByTarget.get(cursor); parent; parent = parentEdgeByTarget.get(cursor)) {
      edgeIds.add(parent.id);
      nodeIds.add(parent.source);
      cursor = parent.source;
    }

    return { nodeIds, edgeIds };
  }, [edges, highlightedEdgeId]);

  const handleEdgeClick = useCallback((_event: unknown, edge: Edge) => {
    setHighlightedEdgeId((prev) => (prev === edge.id ? null : edge.id));
  }, []);

  const styledEdges = useMemo(
    () =>
      edges.map((e) => {
        const active = highlight ? highlight.edgeIds.has(e.id) : false;

        return {
          ...e,
          animated: active,
          style: {
            stroke: active ? "var(--s-brand)" : "var(--s-border-2)",
            strokeWidth: active ? 2.5 : 1.25,
            opacity: highlight && !active ? 0.25 : 1,
          },
        };
      }),
    [edges, highlight],
  );

  const styledNodes = useMemo(
    () =>
      positioned.map((n) => {
        const active = highlight ? highlight.nodeIds.has(n.id) : false;

        return {
          ...n,
          style: {
            ...n.style,
            opacity: highlight && !active ? 0.35 : 1,
            boxShadow: active && highlight ? "0 0 0 2px var(--s-brand)" : undefined,
            borderRadius: 12,
          },
        };
      }),
    [positioned, highlight],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "18px 22px 0", flex: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            className="bg-brand-weak text-brand"
            style={{
              flex: "none",
              display: "grid",
              placeItems: "center",
              width: 34,
              height: 34,
              borderRadius: 10,
            }}
          >
            <Network size={17} />
          </span>
          <div>
            <h1
              className="font-display text-t1"
              style={{
                margin: 0,
                fontSize: "clamp(20px, 3vw, 24px)",
                fontWeight: 800,
                letterSpacing: "-.02em",
              }}
            >
              Organograma
            </h1>
            <p className="text-t3" style={{ margin: "1px 0 0", fontSize: 12.5 }}>
              Sua posição na hierarquia — gestores acima, equipe abaixo.
            </p>
          </div>
        </div>

        {canSearch && (
          <div style={{ marginTop: 14, maxWidth: 320 }}>
            <AsyncSelect
              label="Ver como"
              value={selected}
              onChange={handleSelect}
              search={searchPessoas}
              placeholder="Buscar uma pessoa na hierarquia…"
            />
          </div>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        {!chart ? (
          <EmptyState canSearch={canSearch} loading={loading} />
        ) : (
          <ReactFlowProvider>
            <ReactFlow
              nodes={styledNodes}
              edges={styledEdges}
              nodeTypes={ORG_NODE_TYPES}
              fitView
              minZoom={0.15}
              nodesDraggable
              nodesConnectable={false}
              elementsSelectable={false}
              // Without this, a clicked/dragged node keeps the browser's raw
              // default focus outline (thick, square, ignores border-radius —
              // xyflow only prettifies it for `.selectable` nodes, which these
              // deliberately aren't). Nothing here needs keyboard focus.
              nodesFocusable={false}
              onNodeDragStop={handleNodeDragStop}
              onEdgeClick={handleEdgeClick}
              onPaneClick={() => setHighlightedEdgeId(null)}
            >
              <RefitOnChange signal={chart.self.cpf} />
              <Background gap={22} color="var(--s-border)" />
              <MiniMap
                pannable
                zoomable
                style={{ background: "var(--s-card)", border: "1px solid var(--s-border)", borderRadius: 10 }}
                maskColor="rgba(15, 15, 26, 0.06)"
                nodeColor="var(--s-border-2)"
                nodeStrokeWidth={0}
              />
              {Object.keys(dragOverrides).length > 0 && (
                <button
                  type="button"
                  onClick={resetLayout}
                  title="Reorganizar automaticamente"
                  style={{
                    position: "absolute",
                    left: 12,
                    bottom: 12,
                    zIndex: 5,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    height: 30,
                    padding: "0 10px",
                    borderRadius: 8,
                    border: "1px solid var(--s-border)",
                    background: "var(--s-card)",
                    color: "var(--s-t2)",
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <LocateFixed size={13} />
                  Reorganizar
                </button>
              )}
            </ReactFlow>
          </ReactFlowProvider>
        )}
      </div>

      <GroupDialog
        label={openGroup?.label ?? null}
        pessoas={openGroup?.pessoas ?? []}
        onClose={() => setOpenGroup(null)}
      />
    </div>
  );
}

/**
 * `fitView` on `<ReactFlow>` only frames the graph once, on mount — it does
 * NOT re-run when the `nodes` prop later changes (a documented xyflow
 * quirk). Without this, switching to a different person via the admin search
 * keeps the old viewport, so the new tree renders off-screen. `signal` is the
 * viewed person's CPF: whenever it changes, refit.
 */
function RefitOnChange({ signal }: { signal: string }) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    const id = requestAnimationFrame(() => fitView({ duration: 200 }));

    return () => cancelAnimationFrame(id);
  }, [signal, fitView]);

  return null;
}

function EmptyState({ canSearch, loading }: { canSearch: boolean; loading: boolean }) {
  return (
    <div style={{ display: "grid", placeItems: "center", height: "100%", padding: 24 }}>
      <div style={{ maxWidth: 380, textAlign: "center" }}>
        <div
          className="bg-brand-weak text-brand"
          style={{
            margin: "0 auto 14px",
            width: 48,
            height: 48,
            borderRadius: 12,
            display: "grid",
            placeItems: "center",
          }}
        >
          <Network size={22} />
        </div>
        <div className="text-t1" style={{ fontSize: 14.5, fontWeight: 800 }}>
          {loading ? "Carregando…" : "Você não está na hierarquia comercial"}
        </div>
        <p className="text-t3" style={{ marginTop: 6, fontSize: 12.5, lineHeight: 1.5 }}>
          {loading
            ? "Buscando a posição dessa pessoa na árvore."
            : canSearch
              ? "Sua conta não está associada a uma posição na hierarquia comercial. Use a busca acima para ver o organograma de outra pessoa."
              : "Isso costuma acontecer com contas administrativas ou de TI, que não fazem parte da hierarquia comercial do RH."}
        </p>
      </div>
    </div>
  );
}

function buildGraph(
  chart: OrgChartResult | null,
  ancestorsShown: number,
  expanded: Set<string>,
  setAncestorsShown: Dispatch<SetStateAction<number>>,
  toggle: (path: string) => void,
  openGroup: Dispatch<SetStateAction<OpenGroup | null>>,
): { nodes: Node[]; edges: Edge[] } {
  if (!chart) return { nodes: [], edges: [] };

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // ancestors[0] is the immediate manager. Render only the first `ancestorsShown`
  // and walk them root-ward so the chain of edges points top (older ancestor) to
  // bottom (self) — expanding reveals one more level up, never a sibling branch.
  const visible = chart.ancestors.slice(0, ancestorsShown);

  for (let i = visible.length - 1; i >= 0; i--) {
    const a = visible[i];
    const id = `ancestor:${a.path}`;
    const isTopmost = i === visible.length - 1;

    nodes.push({
      id,
      type: "ancestor",
      position: { x: 0, y: 0 },
      data: {
        nivel: a.nivel,
        nome: a.nome,
        responsavelNome: a.responsavelNome,
        canExpandUp: isTopmost && ancestorsShown < chart.ancestors.length,
        onExpandUp: () => setAncestorsShown((n) => Math.min(chart.ancestors.length, n + 1)),
      },
    });

    const belowId = i === 0 ? "self" : `ancestor:${visible[i - 1].path}`;

    edges.push({ id: `${id}->${belowId}`, source: id, target: belowId });
  }

  nodes.push({
    id: "self",
    type: "self",
    position: { x: 0, y: 0 },
    data: { nome: chart.self.nome, cargo: chart.self.cargo, situacao: chart.self.situacao },
  });

  for (const subtree of chart.subtrees) {
    edges.push({ id: `self->${subtree.path}`, source: "self", target: subtree.path });
    walkTree(subtree, expanded, toggle, openGroup, nodes, edges);
  }

  return { nodes, edges };
}

function walkTree(
  tree: OrgTreeNode,
  expanded: Set<string>,
  toggle: (path: string) => void,
  openGroup: Dispatch<SetStateAction<OpenGroup | null>>,
  nodes: Node[],
  edges: Edge[],
) {
  const isExpanded = expanded.has(tree.path);
  const hasMore = tree.children.length > 0 || tree.pessoasDiretas.length > 0 || tree.gruposSoltos.length > 0;

  nodes.push({
    id: tree.path,
    type: "manager",
    position: { x: 0, y: 0 },
    data: {
      nivel: tree.nivel,
      nome: tree.nome,
      responsavelNome: tree.responsavelNome,
      totalPessoas: tree.totalPessoas,
      hasMore,
      expanded: isExpanded,
      onToggle: () => toggle(tree.path),
    },
  });

  if (!isExpanded) return;

  addLeafBucket(
    tree.path,
    "diretas",
    tree.pessoasDiretas,
    summarizeGroupLabel(tree.pessoasDiretas),
    openGroup,
    nodes,
    edges,
  );

  for (const grupo of tree.gruposSoltos) {
    addLeafBucket(tree.path, grupo.path, grupo.pessoas, grupo.label, openGroup, nodes, edges);
  }

  for (const child of tree.children) {
    edges.push({ id: `${tree.path}->${child.path}`, source: tree.path, target: child.path });
    walkTree(child, expanded, toggle, openGroup, nodes, edges);
  }
}

function addLeafBucket(
  parentId: string,
  bucketKey: string,
  pessoas: OrgPessoaLeaf[],
  label: string,
  openGroup: Dispatch<SetStateAction<OpenGroup | null>>,
  nodes: Node[],
  edges: Edge[],
) {
  if (pessoas.length === 0) return;

  if (pessoas.length > GROUP_THRESHOLD) {
    const id = `group:${bucketKey}`;

    nodes.push({
      id,
      type: "grupo",
      position: { x: 0, y: 0 },
      data: { label, onOpen: () => openGroup({ label, pessoas }) },
    });
    edges.push({ id: `${parentId}->${id}`, source: parentId, target: id });

    return;
  }

  for (const p of pessoas) {
    const id = `person:${bucketKey}:${p.cpf}`;

    nodes.push({
      id,
      type: "person",
      position: { x: 0, y: 0 },
      data: { nome: p.nome, cargo: p.cargo, situacao: p.situacao, isSelf: p.isSelf },
    });
    edges.push({ id: `${parentId}->${id}`, source: parentId, target: id });
  }
}
