/**
 * Types for the "Organograma" screen — a personal view of the org hierarchy,
 * built from `vw_hierarquia_rh` (the structure) and `vw_hierarquia` (people).
 * See docs/hierarquia-permissionamento-referencia.md for the source shapes.
 */

export type NivelHierarquia =
  "diretoria" | "gerencia_executiva" | "gerencia_funcional" | "coordenacao" | "supervisao" | "lideranca";

/** A structure node from `vw_hierarquia_rh` — the current `data_carga` only. */
export interface OrgNode {
  /** `id_estrutura` — materialized path, e.g. `1.9.22.2929`. */
  path: string;
  /** `id_estrutura_pai`. Null only for the root. */
  parentPath: string | null;
  nivel: NivelHierarquia;
  nome: string;
  responsavelNome: string;
  responsavelEmail: string | null;
}

/** A person from `vw_hierarquia` — one row per CPF. */
export interface OrgPessoa {
  /** Digits only (`cpf_digits`). */
  cpf: string;
  nome: string;
  cargo: string | null;
  email: string | null;
  situacao: string | null;
  /** `idestruturahierarquia` — may equal a node's path or extend past it. */
  path: string;
}

export interface HierarquiaSnapshot {
  nodes: OrgNode[];
  pessoas: OrgPessoa[];
  /** Freshness probe — `vw_hierarquia_rh`'s own `data_carga`, or a fixed value in mock. */
  watermark: string;
}

/** A person hanging off a node, shown as a leaf in the tree. */
export interface OrgPessoaLeaf {
  cpf: string;
  nome: string;
  cargo: string | null;
  situacao: string | null;
  isSelf: boolean;
}

/** People sharing a path that continues past any known node (e.g. the 11
 * promotores under one liderança) — grouped so they don't flood the graph. */
export interface OrgGrupo {
  /** The dangling path segment they share, for a stable React key. */
  path: string;
  label: string;
  pessoas: OrgPessoaLeaf[];
}

export interface OrgTreeNode {
  path: string;
  nivel: NivelHierarquia;
  nome: string;
  responsavelNome: string;
  /** Total people in this node's subtree (nodes below + all leaves), for the
   * collapsed-state hint. */
  totalPessoas: number;
  /** People parked exactly at this node's path (excludes the responsável). */
  pessoasDiretas: OrgPessoaLeaf[];
  /** Dangling groups whose path starts here but matches no child node. */
  gruposSoltos: OrgGrupo[];
  children: OrgTreeNode[];
}

export interface OrgAncestor {
  path: string;
  nivel: NivelHierarquia;
  nome: string;
  responsavelNome: string;
  responsavelEmail: string | null;
}

export interface OrgChartSelf {
  cpf: string;
  nome: string;
  cargo: string | null;
  email: string | null;
  situacao: string | null;
  path: string;
  isManager: boolean;
}

/** A city bound to a structure node (ADR 0008). */
export interface OrgCidade {
  id: number;
  nome: string;
}

export interface OrgChartResult {
  self: OrgChartSelf;
  /** Immediate manager first, root last. */
  ancestors: OrgAncestor[];
  /** One root per node the person manages — usually 0 or 1, up to 4. */
  subtrees: OrgTreeNode[];
  /** Cities per `id_estrutura`, for the nodes visible in this chart only. */
  cidades: Record<string, OrgCidade[]>;
}
