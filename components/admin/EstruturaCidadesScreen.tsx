"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  MapPin,
  Users,
  UserRound,
} from "lucide-react";
import { AdminModal, ModalHeader, ModalShell } from "./AdminModal";
import { AdminScreen } from "./AdminScreen";
import { Panel, PrimaryButton, SearchInput, SecondaryButton } from "./primitives";
import { textMatches } from "./filter";
import { useAdminAction } from "./useAdminAction";
import { Segmented } from "@/components/ui/segmented";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { limparVinculoOrfao, salvarVinculos } from "@/app/(app)/admin/actions";
import { nivelRhLabel } from "@/lib/data/admin/derive";
import { dependents, descendants, poolOwner } from "@/lib/data/admin/tree-pool";
import type { CidadeOpcao, EstruturaNo, VinculoOrfao } from "@/lib/data/admin/types";

type Mode = "responsavel" | "cidade";
type ComCidade = "todos" | "com" | "sem";

const MODES = [
  { value: "responsavel" as const, label: "Por responsável" },
  { value: "cidade" as const, label: "Por cidade" },
];

const COM_CIDADE = [
  { value: "todos" as const, label: "Todos" },
  { value: "com" as const, label: "Com cidade" },
  { value: "sem" as const, label: "Sem cidade" },
];

const EMPTY = new Set<string>();

const pairKey = (codigoLocal: string, cidadeId: number | string) => `${codigoLocal}|${cidadeId}`;

/** The city whose nodes below are being picked, from inside the node that holds it. */
interface Distribuicao {
  cidadeId: number;
  cidade: string;
  node: EstruturaNo;
}

interface Cascade {
  codigoLocal: string;
  cidadeId: number;
  cidade: string;
  node: string;
  affected: EstruturaNo[];
}

export function EstruturaCidadesScreen({
  nodes,
  cidades,
  orfaos,
  failed,
}: {
  nodes: EstruturaNo[];
  cidades: CidadeOpcao[];
  orfaos: VinculoOrfao[];
  failed: boolean;
}) {
  const [mode, setMode] = useState<Mode>("responsavel");
  const [focused, setFocused] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(nodes.filter((n) => !n.parentCodigoLocal).map((n) => n.codigoLocal)),
  );
  const [onlyUnbound, setOnlyUnbound] = useState(false);
  const [cascade, setCascade] = useState<Cascade | null>(null);
  const [distribuicao, setDistribuicao] = useState<Distribuicao | null>(null);
  const { busy, error, setError, run } = useAdminAction();

  /**
   * Edits live as a delta over the server's state instead of replacing it: a
   * save that lands (and re-renders with new props) makes the matching deltas
   * no-ops, and a move back to where it started stops counting as pending.
   */
  const base = useMemo(
    () => new Set(nodes.flatMap((n) => n.cidadeIds.map((id) => pairKey(n.codigoLocal, id)))),
    [nodes],
  );
  const [deltas, setDeltas] = useState<Map<string, boolean>>(new Map());

  const pending = useMemo(() => [...deltas].filter(([k, bind]) => base.has(k) !== bind), [deltas, base]);

  const pairs = useMemo(() => {
    const set = new Set(base);

    for (const [key, bind] of deltas) {
      if (bind) set.add(key);
      else set.delete(key);
    }

    return set;
  }, [base, deltas]);

  const citiesByNode = useMemo(() => groupBy(pairs, "node"), [pairs]);
  const nodesByCity = useMemo(() => groupBy(pairs, "city"), [pairs]);

  // The "only unbound" filter reads the SAVED state on purpose: filtering the
  // live one would make a row vanish from under the cursor the moment its first
  // city is moved, before anything is saved.
  const savedByNode = useMemo(() => groupBy(base, "node"), [base]);
  const savedByCity = useMemo(() => groupBy(base, "city"), [base]);

  const cityById = useMemo(() => new Map(cidades.map((c) => [String(c.id), c])), [cidades]);
  const byCode = useMemo(() => new Map(nodes.map((n) => [n.codigoLocal, n])), [nodes]);
  const childNodes = useMemo(() => {
    const map = new Map<string, EstruturaNo[]>();

    for (const n of nodes) {
      if (n.parentCodigoLocal) map.set(n.parentCodigoLocal, [...(map.get(n.parentCodigoLocal) ?? []), n]);
    }

    for (const list of map.values()) list.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    return map;
  }, [nodes]);

  const ownerOf = (codigo: string) => poolOwner(codigo, byCode, citiesByNode);

  /** Null when nothing above holds cities — the node may take any operated city. */
  const poolOf = (codigo: string) => {
    const owner = ownerOf(codigo);

    return owner ? (citiesByNode.get(owner.codigoLocal) ?? EMPTY) : null;
  };

  const cityName = (id: number | string) => cityById.get(String(id))?.nome ?? `#${id}`;

  function setDelta(codigoLocal: string, cidadeId: number | string, bind: boolean) {
    setError(null);
    setDeltas((prev) => new Map(prev).set(pairKey(codigoLocal, cidadeId), bind));
  }

  function includeAll(codigoLocal: string, cidadeIds: string[]) {
    setError(null);
    setDeltas((prev) => {
      const next = new Map(prev);

      for (const id of cidadeIds) next.set(pairKey(codigoLocal, id), true);

      return next;
    });
  }

  /**
   * Dropping a city from a node drops it from every node below, so it asks
   * first and then stages every removal — the server recomputes the same
   * cascade on save, this is what makes it visible before it happens.
   */
  function move(codigoLocal: string, cidadeId: number, bind: boolean) {
    if (bind) return setDelta(codigoLocal, cidadeId, true);

    const node = byCode.get(codigoLocal);
    const affected = node
      ? descendants(node, nodes).filter((d) => citiesByNode.get(d.codigoLocal)?.has(String(cidadeId)))
      : [];

    if (affected.length === 0) return setDelta(codigoLocal, cidadeId, false);

    setCascade({
      codigoLocal,
      cidadeId,
      cidade: cityName(cidadeId),
      node: node?.nome ?? codigoLocal,
      affected,
    });
  }

  function confirmCascade() {
    if (!cascade) return;

    setError(null);
    setDeltas((prev) => {
      const next = new Map(prev);

      next.set(pairKey(cascade.codigoLocal, cascade.cidadeId), false);
      for (const d of cascade.affected) next.set(pairKey(d.codigoLocal, cascade.cidadeId), false);

      return next;
    });
    setCascade(null);
  }

  function save() {
    run(
      () =>
        salvarVinculos(
          pending.map(([key, bind]) => {
            const [codigoLocal, cidadeId] = key.split("|");

            return { codigoLocal, cidadeId: Number(cidadeId), vincular: bind };
          }),
        ),
      () => setDeltas(new Map()),
    );
  }

  function select(codigo: string) {
    setFocused(codigo);
    setExpanded((prev) => {
      const next = new Set(prev).add(codigo);

      for (let pai = byCode.get(codigo)?.parentCodigoLocal; pai; pai = byCode.get(pai)?.parentCodigoLocal) {
        next.add(pai);
      }

      return next;
    });
  }

  function toggle(codigo: string) {
    setExpanded((prev) => {
      const next = new Set(prev);

      if (!next.delete(codigo)) next.add(codigo);

      return next;
    });
  }

  function switchMode(next: Mode) {
    setMode(next);
    setFocused(null);
  }

  const byResponsavel = mode === "responsavel";
  const underPool = nodes.filter((n) => ownerOf(n.codigoLocal));
  const alert = byResponsavel
    ? {
        n: underPool.filter((n) => (citiesByNode.get(n.codigoLocal)?.size ?? 0) === 0).length,
        total: underPool.length,
        texto:
          "nós com cidades acima ainda não têm cidade própria. As equipes deles não enxergam cidade nenhuma.",
      }
    : {
        n: cidades.filter((c) => !nodesByCity.has(String(c.id))).length,
        total: cidades.length,
        texto: "cidades ainda sem nenhum nó. Fora os admins, ninguém as enxerga.",
      };
  const filter = {
    label: byResponsavel ? "Só sem cidade" : "Só sem nó",
    on: onlyUnbound,
    onToggle: () => setOnlyUnbound((v) => !v),
  };
  const current = byResponsavel && focused ? byCode.get(focused) : undefined;

  return (
    <AdminScreen
      title="Cidades por estrutura"
      subtitle="Qualquer nível do RH pode receber cidades. Quem está abaixo só pode receber o que o nó acima já tem."
      extra={
        <>
          <Segmented options={MODES} value={mode} onChange={switchMode} ariaLabel="Modo de vínculo" />
          <FilterChip filter={filter} />
        </>
      }
    >
      {failed && (
        <Panel style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <MapPin size={16} style={{ color: "var(--s-bad)", flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "var(--s-t2)" }}>
            Não foi possível carregar a estrutura ou as cidades do Databricks. Use <strong>Atualizar</strong>{" "}
            para tentar de novo.
          </span>
        </Panel>
      )}

      {!failed && alert.n > 0 && (
        <Panel style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <MapPin size={16} style={{ color: "var(--s-warn)", flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "var(--s-t2)" }}>
            <strong>{alert.n}</strong> de {alert.total} {alert.texto}
          </span>
        </Panel>
      )}

      {byResponsavel ? (
        <div className="grid gap-3.5 lg:grid-cols-3">
          <Tree
            nodes={nodes}
            childNodes={childNodes}
            citiesByNode={citiesByNode}
            savedByNode={savedByNode}
            hasOwner={(codigo) => ownerOf(codigo) !== null}
            onlyUnbound={onlyUnbound}
            expanded={expanded}
            selected={focused}
            onSelect={select}
            onToggle={toggle}
          />
          {current ? (
            <NodeDetail
              key={current.codigoLocal}
              node={current}
              nodes={nodes}
              byCode={byCode}
              childNodes={childNodes.get(current.codigoLocal) ?? []}
              cidades={cidades}
              citiesByNode={citiesByNode}
              nodesByCity={nodesByCity}
              owner={ownerOf(current.codigoLocal)}
              pool={poolOf(current.codigoLocal)}
              onSelect={select}
              onMove={move}
              onIncludeAll={includeAll}
              onDistribuir={(cidadeId) =>
                setDistribuicao({ cidadeId, cidade: cityName(cidadeId), node: current })
              }
            />
          ) : (
            <div className="lg:col-span-2">
              <Panel style={{ padding: 24, minHeight: 560 }}>
                <p style={{ margin: 0, fontSize: 13, color: "var(--s-t3)" }}>
                  Selecione um nó na estrutura para ver e atribuir as cidades dele.
                </p>
              </Panel>
            </div>
          )}
        </div>
      ) : (
        <ByCity
          nodes={nodes}
          byCode={byCode}
          cidades={cidades}
          citiesByNode={citiesByNode}
          nodesByCity={nodesByCity}
          savedByCity={savedByCity}
          poolOf={poolOf}
          onlyUnbound={onlyUnbound}
          focused={focused}
          onFocus={setFocused}
          onMove={move}
        />
      )}

      {pending.length > 0 && (
        <div style={{ position: "sticky", bottom: 12, zIndex: 3 }}>
          <Panel
            style={{
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              boxShadow: "var(--s-sh-2)",
            }}
          >
            <span style={{ flex: 1, minWidth: 180, fontSize: 13, fontWeight: 700, color: "var(--s-t1)" }}>
              {pending.length} alteração(ões) não salva(s)
            </span>
            {error && <span style={{ fontSize: 12.5, color: "var(--s-bad)" }}>{error}</span>}
            <SecondaryButton onClick={() => setDeltas(new Map())} disabled={busy}>
              Descartar
            </SecondaryButton>
            <PrimaryButton onClick={save} disabled={busy}>
              {busy ? "Salvando…" : "Salvar vínculos"}
            </PrimaryButton>
          </Panel>
        </div>
      )}

      {orfaos.length > 0 && <Orphans orfaos={orfaos} busy={busy} run={run} cityById={cityById} />}

      {distribuicao && (
        <DistribuirModal
          alvo={distribuicao}
          childNodes={childNodes.get(distribuicao.node.codigoLocal) ?? []}
          citiesByNode={citiesByNode}
          cityById={cityById}
          onToggle={(codigoLocal, bind) => move(codigoLocal, distribuicao.cidadeId, bind)}
          onClose={() => setDistribuicao(null)}
        />
      )}

      {cascade && (
        <AdminModal
          open
          onClose={() => setCascade(null)}
          eyebrow={cascade.node}
          title={`Remover ${cascade.cidade}?`}
          onSubmit={confirmCascade}
          submitLabel="Remover de todos"
          busy={busy}
        >
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--s-t2)" }}>
            {cascade.affected.length} nó(s) abaixo respondem por essa cidade e vão perdê-la junto:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflow: "auto" }}>
            {cascade.affected.map((d) => (
              <span
                key={d.codigoLocal}
                style={{
                  padding: "8px 11px",
                  borderRadius: 10,
                  background: "var(--s-sunken)",
                  fontSize: 12.5,
                  color: "var(--s-t2)",
                }}
              >
                {d.nome}
                {d.responsavel && ` · ${d.responsavel}`}
              </span>
            ))}
          </div>
        </AdminModal>
      )}
    </AdminScreen>
  );
}

function groupBy(pairs: ReadonlySet<string>, by: "node" | "city"): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();

  for (const pair of pairs) {
    const [node, city] = pair.split("|");
    const key = by === "node" ? node : city;
    const value = by === "node" ? city : node;

    map.set(key, (map.get(key) ?? new Set()).add(value));
  }

  return map;
}

function nodeRow(n: EstruturaNo, citiesByNode: Map<string, Set<string>>, pai?: EstruturaNo): Row {
  return {
    key: n.codigoLocal,
    title: n.nome,
    subtitle: [
      nivelRhLabel(n.nivel),
      n.responsavel ?? "sem responsável",
      `${citiesByNode.get(n.codigoLocal)?.size ?? 0} cidade(s)`,
      pai && `em ${pai.nome}`,
    ]
      .filter(Boolean)
      .join(" · "),
    search: [n.nome, n.responsavel, pai?.nome],
    icon: <UserRound size={15} />,
  };
}

/**
 * The RH tree, bindable levels only. While searching (or filtering) it shows
 * the matches with the path above them, all open, so a hit is never hidden
 * inside a collapsed branch; a search hit also brings its branch below.
 */
function Tree({
  nodes,
  childNodes,
  citiesByNode,
  savedByNode,
  hasOwner,
  onlyUnbound,
  expanded,
  selected,
  onSelect,
  onToggle,
}: {
  nodes: EstruturaNo[];
  childNodes: Map<string, EstruturaNo[]>;
  citiesByNode: Map<string, Set<string>>;
  savedByNode: Map<string, Set<string>>;
  hasOwner: (codigo: string) => boolean;
  onlyUnbound: boolean;
  expanded: Set<string>;
  selected: string | null;
  onSelect: (codigo: string) => void;
  onToggle: (codigo: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtering = query.trim() !== "" || onlyUnbound;

  const visible = useMemo(() => {
    if (!filtering) return null;

    const byCode = new Map(nodes.map((n) => [n.codigoLocal, n]));
    const set = new Set<string>();
    const passes = (n: EstruturaNo) => !onlyUnbound || (savedByNode.get(n.codigoLocal)?.size ?? 0) === 0;

    for (const n of nodes) {
      if (!textMatches(query, n.nome, n.responsavel) || !passes(n)) continue;

      for (
        let c: string | null = n.codigoLocal;
        c && !set.has(c);
        c = byCode.get(c)?.parentCodigoLocal ?? null
      ) {
        set.add(c);
      }

      if (query.trim() !== "") {
        for (const d of descendants(n, nodes)) if (passes(d)) set.add(d.codigoLocal);
      }
    }

    return set;
  }, [filtering, nodes, query, onlyUnbound, savedByNode]);

  const roots = nodes
    .filter((n) => !n.parentCodigoLocal)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const rows: { node: EstruturaNo; depth: number }[] = [];

  const walk = (list: EstruturaNo[], depth: number) => {
    for (const node of list) {
      if (visible && !visible.has(node.codigoLocal)) continue;

      rows.push({ node, depth });

      if (visible || expanded.has(node.codigoLocal)) walk(childNodes.get(node.codigoLocal) ?? [], depth + 1);
    }
  };

  walk(roots, 0);

  // Out of flow so the tree takes the height of the columns beside it instead
  // of stretching them to its own length.
  return (
    <div className="relative h-[560px] lg:h-auto">
      <Panel style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--s-border)" }}>
          <SearchInput value={query} onChange={setQuery} placeholder="Buscar nó ou responsável" />
        </div>

        <div
          role="tree"
          aria-label="Estrutura do RH"
          style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 6 }}
        >
          {rows.length === 0 ? (
            <p style={{ margin: 0, padding: 14, fontSize: 12.5, color: "var(--s-t3)" }}>
              {onlyUnbound ? "Todo nó já tem cidade." : "Nenhum nó encontrado."}
            </p>
          ) : (
            rows.map(({ node, depth }) => (
              <TreeRow
                key={node.codigoLocal}
                node={node}
                depth={depth}
                total={citiesByNode.get(node.codigoLocal)?.size ?? 0}
                hasOwner={hasOwner(node.codigoLocal)}
                hasChildren={(childNodes.get(node.codigoLocal)?.length ?? 0) > 0}
                open={visible !== null || expanded.has(node.codigoLocal)}
                active={selected === node.codigoLocal}
                onSelect={() => onSelect(node.codigoLocal)}
                onToggle={() => onToggle(node.codigoLocal)}
              />
            ))
          )}
        </div>
      </Panel>
    </div>
  );
}

function TreeRow({
  node,
  depth,
  total,
  hasOwner,
  hasChildren,
  open,
  active,
  onSelect,
  onToggle,
}: {
  node: EstruturaNo;
  depth: number;
  total: number;
  hasOwner: boolean;
  hasChildren: boolean;
  open: boolean;
  active: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <div
      role="treeitem"
      aria-selected={active}
      aria-expanded={hasChildren ? open : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        paddingLeft: depth * 16,
        borderRadius: 10,
        background: active ? "var(--s-brand-weak)" : "transparent",
      }}
    >
      {hasChildren ? (
        <button
          type="button"
          onClick={onToggle}
          aria-label={`${open ? "Recolher" : "Expandir"} ${node.nome}`}
          className="bd-ghost"
          style={{
            display: "grid",
            placeItems: "center",
            width: 24,
            height: 24,
            flexShrink: 0,
            border: 0,
            borderRadius: 6,
            background: "transparent",
            color: "var(--s-t3)",
            cursor: "pointer",
          }}
        >
          <Chevron size={14} />
        </button>
      ) : (
        <span style={{ width: 24, flexShrink: 0 }} />
      )}
      <button
        type="button"
        onClick={onSelect}
        className="bd-ghost"
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "7px 8px",
          border: 0,
          borderRadius: 8,
          background: "transparent",
          font: "inherit",
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: active ? "var(--s-brand)" : "var(--s-t1)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {node.nome}
          </span>
          <span
            style={{
              fontSize: 11,
              color: "var(--s-t3)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {nivelRhLabel(node.nivel)} · {node.responsavel ?? "sem responsável"}
          </span>
        </span>
        <NodeStatus total={total} hasOwner={hasOwner} />
      </button>
    </div>
  );
}

/**
 * An empty node under a pool is the state worth spotting: its team sees no city
 * at all, since nothing is inherited from above (ADR 0008). An empty node with
 * nothing above is just not configured yet.
 */
function NodeStatus({ total, hasOwner }: { total: number; hasOwner: boolean }) {
  if (total === 0 && !hasOwner) return null;

  const isEmpty = total === 0;

  return (
    <span
      title={isEmpty ? "Há cidades acima, mas nenhuma aqui: a equipe não enxerga cidade nenhuma." : undefined}
      style={{
        flexShrink: 0,
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 800,
        background: isEmpty ? "var(--s-warn-bg)" : "var(--s-brand-weak)",
        color: isEmpty ? "var(--s-warn)" : "var(--s-brand)",
      }}
    >
      {isEmpty ? "sem cidade" : total}
    </span>
  );
}

function NodeDetail({
  node,
  nodes,
  byCode,
  childNodes,
  cidades,
  citiesByNode,
  nodesByCity,
  owner,
  pool,
  onSelect,
  onMove,
  onIncludeAll,
  onDistribuir,
}: {
  node: EstruturaNo;
  nodes: EstruturaNo[];
  byCode: Map<string, EstruturaNo>;
  childNodes: EstruturaNo[];
  cidades: CidadeOpcao[];
  citiesByNode: Map<string, Set<string>>;
  nodesByCity: Map<string, Set<string>>;
  owner: EstruturaNo | null;
  pool: Set<string> | null;
  onSelect: (codigo: string) => void;
  onMove: (codigoLocal: string, cidadeId: number, bind: boolean) => void;
  onIncludeAll: (codigoLocal: string, cidadeIds: string[]) => void;
  onDistribuir: (cidadeId: number) => void;
}) {
  const bound = citiesByNode.get(node.codigoLocal) ?? EMPTY;
  const holdersBelow = (cidadeId: number) =>
    childNodes.filter((f) => citiesByNode.get(f.codigoLocal)?.has(String(cidadeId))).length;

  // Filling an empty node makes it the pool of whoever below already holds
  // cities, so the save refuses unless it covers them — offered here up front.
  const below =
    bound.size === 0
      ? dependents(node, nodes, byCode, new Map([...citiesByNode, [node.codigoLocal, new Set(["*"])]]))
      : [];
  const citiesBelow = [...new Set(below.flatMap((d) => [...(citiesByNode.get(d.codigoLocal) ?? [])]))];

  return (
    <>
      <Column
        placeholder={`Cidades de ${node.nome} (${bound.size})`}
        empty="Nenhuma cidade."
        hint={
          citiesBelow.length > 0 && (
            <>
              Abaixo já há {citiesBelow.length} cidade(s) em {below.length} nó(s); este nó precisa incluí-las.{" "}
              <InlineLink onClick={() => onIncludeAll(node.codigoLocal, citiesBelow)}>Incluir</InlineLink>
            </>
          )
        }
        items={cidades
          .filter((c) => bound.has(String(c.id)))
          .map((c) => ({
            key: String(c.id),
            title: c.nome,
            // A city missing from the pool above is a leftover from before
            // that node was filled.
            subtitle:
              pool && !pool.has(String(c.id))
                ? `fora do conjunto de ${owner?.nome}`
                : childNodes.length > 0
                  ? `${holdersBelow(c.id)} de ${childNodes.length} abaixo`
                  : null,
            search: [c.nome],
            extra: childNodes.length > 0 && (
              <RoundButton
                Icon={Users}
                tone="neutral"
                label={`Quem abaixo responde por ${c.nome}`}
                onClick={() => onDistribuir(c.id)}
              />
            ),
          }))}
        action={{ direction: "right", onClick: (k) => onMove(node.codigoLocal, Number(k), false) }}
      />
      <Column
        placeholder="Cidades disponíveis"
        hint={
          owner ? (
            <>
              Do conjunto de <InlineLink onClick={() => onSelect(owner.codigoLocal)}>{owner.nome}</InlineLink>
            </>
          ) : (
            "Nada acima tem cidades: todas as operadas."
          )
        }
        empty={
          pool?.size === 0
            ? `${owner?.nome} ainda não tem cidades.`
            : owner
              ? `Tudo de ${owner.nome} já está aqui.`
              : "Nenhuma cidade disponível."
        }
        items={cidades
          .filter((c) => (pool ? pool.has(String(c.id)) : true) && !bound.has(String(c.id)))
          .map((c) => {
            const others = nodesByCity.get(String(c.id))?.size ?? 0;

            return {
              key: String(c.id),
              title: c.nome,
              subtitle: others > 0 ? `já em ${others} nó(s)` : null,
              search: [c.nome],
            };
          })}
        action={{ direction: "left", onClick: (k) => onMove(node.codigoLocal, Number(k), true) }}
      />
    </>
  );
}

function InlineLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: 0,
        border: 0,
        background: "transparent",
        color: "var(--s-brand)",
        font: "inherit",
        fontWeight: 700,
        textDecoration: "underline",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function ByCity({
  nodes,
  byCode,
  cidades,
  citiesByNode,
  nodesByCity,
  savedByCity,
  poolOf,
  onlyUnbound,
  focused,
  onFocus,
  onMove,
}: {
  nodes: EstruturaNo[];
  byCode: Map<string, EstruturaNo>;
  cidades: CidadeOpcao[];
  citiesByNode: Map<string, Set<string>>;
  nodesByCity: Map<string, Set<string>>;
  savedByCity: Map<string, Set<string>>;
  poolOf: (codigo: string) => Set<string> | null;
  onlyUnbound: boolean;
  focused: string | null;
  onFocus: (key: string) => void;
  onMove: (codigoLocal: string, cidadeId: number, bind: boolean) => void;
}) {
  const current = focused ? cidades.find((c) => String(c.id) === focused) : undefined;
  const holders = current ? (nodesByCity.get(String(current.id)) ?? EMPTY) : EMPTY;
  const row = (n: EstruturaNo) =>
    nodeRow(n, citiesByNode, n.parentCodigoLocal ? byCode.get(n.parentCodigoLocal) : undefined);
  const eligible = current
    ? nodes.filter((n) => {
        const pool = poolOf(n.codigoLocal);

        return !holders.has(n.codigoLocal) && (pool === null || pool.has(String(current.id)));
      })
    : [];

  return (
    <Columns>
      <Column
        placeholder="Cidade"
        items={cidades
          .filter((c) => !onlyUnbound || !savedByCity.has(String(c.id)))
          .map((c) => ({
            key: String(c.id),
            title: c.nome,
            subtitle: `${nodesByCity.get(String(c.id))?.size ?? 0} nó(s)`,
            search: [c.nome],
            icon: <MapPin size={15} />,
          }))}
        selected={focused}
        onSelect={onFocus}
        empty={onlyUnbound ? "Toda cidade já tem nó." : "Nenhuma cidade operada."}
      />
      <Column
        placeholder="Nós com a cidade"
        empty={current ? "Nenhum nó." : "Selecione uma cidade à esquerda."}
        items={nodes.filter((n) => holders.has(n.codigoLocal)).map(row)}
        action={current && { direction: "right", onClick: (k) => onMove(k, current.id, false) }}
      />
      <Column
        placeholder="Nós que podem recebê-la"
        empty={current ? "Nenhum nó pode receber esta cidade." : "Selecione uma cidade à esquerda."}
        items={eligible.map(row)}
        action={current && { direction: "left", onClick: (k) => onMove(k, current.id, true) }}
      />
    </Columns>
  );
}

function Columns({ children }: { children: ReactNode }) {
  return <div className="grid items-start gap-3.5 lg:grid-cols-3">{children}</div>;
}

interface Row {
  key: string;
  title: string;
  subtitle?: string | null;
  search: (string | null | undefined)[];
  icon?: ReactNode;
  /** Secondary control, rendered just before the move arrow. */
  extra?: ReactNode;
}

interface MoveAction {
  direction: "left" | "right";
  onClick: (key: string) => void;
}

interface ListFilter {
  label: string;
  on: boolean;
  onToggle: () => void;
}

function Column({
  placeholder,
  hint,
  items,
  empty,
  selected,
  onSelect,
  action,
}: {
  placeholder: string;
  hint?: ReactNode;
  items: Row[];
  empty: string;
  selected?: string | null;
  onSelect?: (key: string) => void;
  action?: MoveAction | false | undefined;
}) {
  const [query, setQuery] = useState("");
  const visible = items.filter((i) => textMatches(query, i.title, i.subtitle, ...i.search));

  return (
    <Panel style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--s-border)" }}>
        <SearchInput value={query} onChange={setQuery} placeholder={placeholder} />
        {hint && (
          <p style={{ margin: "8px 2px 0", fontSize: 11.5, lineHeight: 1.45, color: "var(--s-t3)" }}>
            {hint}
          </p>
        )}
      </div>

      <div style={{ height: 480, overflowY: "auto", padding: 6 }}>
        {visible.length === 0 ? (
          <p style={{ margin: 0, padding: 14, fontSize: 12.5, color: "var(--s-t3)" }}>{empty}</p>
        ) : (
          visible.map((item) => (
            <ItemRow
              key={item.key}
              item={item}
              active={selected === item.key}
              onClick={onSelect ? () => onSelect(item.key) : undefined}
              action={
                action ? { direction: action.direction, onClick: () => action.onClick(item.key) } : undefined
              }
            />
          ))
        )}
      </div>
    </Panel>
  );
}

function FilterChip({ filter }: { filter: ListFilter }) {
  return (
    <button
      type="button"
      onClick={filter.onToggle}
      aria-pressed={filter.on}
      className="bd-ghost"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 40,
        padding: "0 14px",
        borderRadius: 999,
        border: `1px solid ${filter.on ? "var(--s-brand-line)" : "var(--s-border)"}`,
        background: filter.on ? "var(--s-brand-weak)" : "var(--s-sunken)",
        color: filter.on ? "var(--s-brand)" : "var(--s-t3)",
        font: "inherit",
        fontSize: 12.5,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {filter.on && <Check size={14} />}
      {filter.label}
    </button>
  );
}

/**
 * Flags a supervisor who already answers for other cities — the thing you want
 * to know before handing them one more. The names live in the tooltip, which
 * rides above the modal: the shared `TooltipContent` sits at z-50 and the
 * dialog at z-81, so without the bump it would open behind it.
 */
function OutrasCidadesBadge({ cidades }: { cidades: string[] }) {
  if (cidades.length === 0) return null;

  const MOSTRAR = 15;
  const resto = cidades.length - MOSTRAR;
  const titulo = `Já é responsável por ${cidades.length} cidade(s)`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          aria-label={titulo}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            flexShrink: 0,
            padding: "3px 8px",
            borderRadius: 999,
            border: "1px solid var(--s-border)",
            background: "var(--s-card)",
            color: "var(--s-t3)",
            fontSize: 11,
            fontWeight: 800,
            cursor: "help",
          }}
        >
          <MapPin size={11} />
          {cidades.length}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="left"
        className="z-[90] max-w-[260px] text-left text-xs leading-relaxed whitespace-normal"
      >
        <div style={{ fontWeight: 800, marginBottom: 3 }}>{titulo}</div>
        {cidades.slice(0, MOSTRAR).join(" · ")}
        {resto > 0 && ` … e mais ${resto}`}
      </TooltipContent>
    </Tooltip>
  );
}

function ActionPill({
  tone,
  label,
  onClick,
  children,
}: {
  tone: "brand" | "neutral";
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  const brand = tone === "brand";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="bd-ghost"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        flexShrink: 0,
        height: 30,
        padding: "0 12px",
        borderRadius: 999,
        border: `1px solid ${brand ? "transparent" : "var(--s-border)"}`,
        background: brand ? "var(--s-brand)" : "var(--s-card)",
        color: brand ? "#fff" : "var(--s-t2)",
        font: "inherit",
        fontSize: 11.5,
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      {brand ? <ArrowLeft size={13} /> : <ArrowRight size={13} />}
      {children}
    </button>
  );
}

function ItemRow({
  item,
  active,
  onClick,
  action,
}: {
  item: Row;
  active: boolean;
  onClick?: () => void;
  action?: { direction: "left" | "right"; onClick: () => void };
}) {
  const content = (
    <>
      {item.icon && (
        <span
          style={{
            display: "grid",
            placeItems: "center",
            width: 28,
            height: 28,
            flexShrink: 0,
            borderRadius: 999,
            background: active ? "var(--s-brand)" : "var(--s-sunken)",
            color: active ? "var(--s-card)" : "var(--s-t3)",
          }}
        >
          {item.icon}
        </span>
      )}
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 700,
            color: active ? "var(--s-brand)" : "var(--s-t1)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {item.title}
        </span>
        {item.subtitle && (
          <span
            style={{
              fontSize: 11,
              color: "var(--s-t3)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.subtitle}
          </span>
        )}
      </span>
    </>
  );

  const style: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    padding: "8px 10px",
    borderRadius: 10,
    background: active ? "var(--s-brand-weak)" : "transparent",
    border: 0,
    font: "inherit",
    textAlign: "left",
  };

  if (!action) {
    return onClick ? (
      <button
        type="button"
        onClick={onClick}
        aria-label={item.title}
        className="bd-ghost"
        style={{ ...style, cursor: "pointer" }}
      >
        {content}
      </button>
    ) : (
      <div style={style}>
        {content}
        {item.extra}
      </div>
    );
  }

  const toRight = action.direction === "right";
  const move = {
    onClick: action.onClick,
    Icon: toRight ? ArrowRight : ArrowLeft,
    label: `${toRight ? "Remover" : "Atribuir"} ${item.title}`,
  };

  return (
    <div style={style}>
      {!toRight && <RoundButton {...move} />}
      {content}
      {item.extra}
      {toRight && <RoundButton {...move} />}
    </div>
  );
}

function RoundButton({
  onClick,
  Icon,
  label,
  tone = "brand",
}: {
  onClick: () => void;
  Icon: typeof ArrowRight;
  label: string;
  tone?: "brand" | "neutral";
}) {
  const brand = tone === "brand";

  return (
    <button
      type="button"
      onClick={onClick}
      className="bd-ghost"
      aria-label={label}
      title={label}
      style={{
        display: "grid",
        placeItems: "center",
        width: 28,
        height: 28,
        flexShrink: 0,
        borderRadius: 999,
        border: `1px solid ${brand ? "var(--s-brand-line)" : "var(--s-border)"}`,
        background: brand ? "var(--s-brand-weak)" : "var(--s-sunken)",
        color: brand ? "var(--s-brand)" : "var(--s-t2)",
        cursor: "pointer",
      }}
    >
      <Icon size={15} />
    </button>
  );
}

/**
 * Distributing one city from the side of the node that holds it: which of the
 * nodes right below answer for it. Toggles stage into the same delta map as the
 * columns; the sticky bar saves.
 */
function DistribuirModal({
  alvo,
  childNodes,
  citiesByNode,
  cityById,
  onToggle,
  onClose,
}: {
  alvo: Distribuicao;
  childNodes: EstruturaNo[];
  citiesByNode: Map<string, Set<string>>;
  cityById: Map<string, CidadeOpcao>;
  onToggle: (codigoLocal: string, bind: boolean) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [recorte, setRecorte] = useState<ComCidade>("todos");
  const temACidade = (s: EstruturaNo) => citiesByNode.get(s.codigoLocal)?.has(String(alvo.cidadeId)) ?? false;

  const quantasOutras = (s: EstruturaNo) => {
    const suas = citiesByNode.get(s.codigoLocal);

    if (!suas) return 0;

    return suas.has(String(alvo.cidadeId)) ? suas.size - 1 : suas.size;
  };

  const outrasCidades = (s: EstruturaNo) =>
    [...(citiesByNode.get(s.codigoLocal) ?? [])]
      .filter((id) => id !== String(alvo.cidadeId))
      .map((id) => cityById.get(id)?.nome ?? `#${id}`)
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
  const visible = childNodes.filter((s) => textMatches(query, s.nome, s.responsavel));
  const com = visible.filter(temACidade);
  const sem = visible
    .filter((s) => !temACidade(s))
    .filter((s) => recorte === "todos" || (recorte === "com") === quantasOutras(s) > 0);

  return (
    <ModalShell open onClose={onClose} maxWidth={520}>
      <ModalHeader eyebrow={alvo.node.nome} title={alvo.cidade} onClose={onClose} />

      <p style={{ margin: 0, fontSize: 12.5, color: "var(--s-t3)" }}>
        {`${childNodes.filter(temACidade).length} de ${childNodes.length} nó(s) logo abaixo respondem por esta cidade.`}
      </p>

      <SearchInput value={query} onChange={setQuery} placeholder="Buscar nó ou responsável…" />

      <div style={{ display: "flex", flexDirection: "column", gap: 14, maxHeight: 340, overflowY: "auto" }}>
        <GrupoSupervisoes
          titulo="Responsáveis selecionados"
          itens={com}
          vazio="Ninguém abaixo responde por esta cidade."
          atribuidas
          onToggle={onToggle}
        />
        <GrupoSupervisoes
          titulo="Responsáveis disponíveis"
          itens={sem}
          vazio={
            recorte === "todos"
              ? "Todos os nós abaixo já têm a cidade."
              : `Ninguém disponível ${recorte === "com" ? "com" : "sem"} outras cidades.`
          }
          outras={outrasCidades}
          acao={
            <Segmented
              options={COM_CIDADE}
              value={recorte}
              onChange={setRecorte}
              size="sm"
              ariaLabel="Filtrar por quem já tem cidade"
            />
          }
          onToggle={onToggle}
        />
      </div>

      <PrimaryButton onClick={onClose}>Concluir</PrimaryButton>
    </ModalShell>
  );
}

function GrupoSupervisoes({
  titulo,
  itens,
  vazio,
  atribuidas,
  outras,
  acao,
  onToggle,
}: {
  titulo: string;
  itens: EstruturaNo[];
  vazio: string;
  atribuidas?: boolean;
  outras?: (s: EstruturaNo) => string[];
  acao?: ReactNode;
  onToggle: (codigoLocal: string, bind: boolean) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 800,
            letterSpacing: ".06em",
            textTransform: "uppercase",
            color: "var(--s-t3)",
          }}
        >
          {titulo} ({itens.length})
        </span>
        {acao}
      </div>

      {itens.length === 0 ? (
        <p style={{ margin: 0, padding: "4px 2px", fontSize: 12, color: "var(--s-t3)" }}>{vazio}</p>
      ) : (
        itens.map((s) => (
          <div
            key={s.codigoLocal}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 11px",
              borderRadius: 10,
              background: atribuidas ? "var(--s-brand-weak)" : "var(--s-sunken)",
            }}
          >
            <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: atribuidas ? "var(--s-brand)" : "var(--s-t1)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {s.responsavel ?? "sem responsável"}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--s-t3)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {s.nome}
              </span>
            </span>
            <OutrasCidadesBadge cidades={outras?.(s) ?? []} />
            <ActionPill
              tone={atribuidas ? "neutral" : "brand"}
              label={`${atribuidas ? "Remover de" : "Atribuir a"} ${s.nome}`}
              onClick={() => onToggle(s.codigoLocal, !atribuidas)}
            >
              {atribuidas ? "Remover" : "Atribuir"}
            </ActionPill>
          </div>
        ))
      )}
    </div>
  );
}

/**
 * Bindings on a node that is no longer bindable — it left the RH load or is a
 * liderança. They already
 * grant nothing (the scope resolution only reads bindable nodes), so clearing
 * them is hygiene: it also frees the city visibly.
 */
function Orphans({
  orfaos,
  busy,
  run,
  cityById,
}: {
  orfaos: VinculoOrfao[];
  busy: boolean;
  run: ReturnType<typeof useAdminAction>["run"];
  cityById: Map<string, CidadeOpcao>;
}) {
  return (
    <Panel style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
      <span style={{ fontSize: 13, fontWeight: 800, color: "var(--s-t1)" }}>
        Vínculos órfãos ({orfaos.length})
      </span>
      <span style={{ fontSize: 12.5, color: "var(--s-t3)" }}>
        O nó saiu da carga do RH ou é uma liderança. O vínculo não dá acesso a ninguém e as cidades já estão
        livres.
      </span>
      {orfaos.map((o) => (
        <div
          key={o.codigoLocal}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
        >
          <span style={{ fontSize: 12.5, color: "var(--s-t2)" }}>
            Nó {o.codigoLocal} —{" "}
            {o.cidadeIds.map((id) => cityById.get(String(id))?.nome ?? `#${id}`).join(", ")}
          </span>
          <SecondaryButton onClick={() => run(() => limparVinculoOrfao(o.codigoLocal))} disabled={busy}>
            Remover
          </SecondaryButton>
        </div>
      ))}
    </Panel>
  );
}
