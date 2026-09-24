/**
 * View models for the Administração area. These mirror the real `tb_*` schema
 * verified in the warehouse (see docs/migration/new-ui-plan.md §6), plus the two
 * fields the new_ui model needs that the schema does not store — `locked` and the
 * chip colour — which are derived (see ./derive.ts), never read from a column.
 */

import type { ScopeKind } from "@/lib/auth/jwt";

export type { ScopeKind };

export interface Nivel {
  id: number;
  nome: string;
  descricao: string | null;
  /** Derived: true for the seeded `admin` level (badge "Padrão", non-editable). */
  locked: boolean;
  /** Count of capabilities granted to this level (n de N in the UI). */
  capCount: number;
}

export interface Pagina {
  id: number;
  nome: string;
  /** Icon set key (lucide) rendered next to the name. */
  icone: string | null;
  rota: string | null;
  /** Count of capabilities that belong to this page. */
  capCount: number;
}

/** A "capacidade" in the UI is a row of `tb_permissoes` (an app permission). */
export interface Capacidade {
  id: number;
  label: string;
  descricao: string | null;
  paginaId: number | null;
  paginaNome: string | null;
}

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  /** Digits only. The key that binds the user to the RH hierarchy. */
  cpf: string | null;
  nivelId: number | null;
  nivelNome: string | null;
  ativo: boolean;
  /** Whether the user is synced with the source system (`tb_usuarios.sincronizado`). */
  sincronizado: boolean;
  /** Whose point of view this user takes when reading data. */
  escopoTipo: ScopeKind;
  /** The CPF of that person — only set when `escopoTipo === "gestor"`. */
  escopoCpf: string | null;
  /** That person's name, resolved from the hierarchy for display. */
  escopoNome: string | null;
}

/**
 * The permission matrix (Capacidades por nível): the set of granted
 * `(nivelId, capacidadeId)` pairs, held as a Set of `"nivelId:capId"` keys for
 * O(1) lookup in the grid.
 */
export type PermMatrix = Set<string>;

export function permKey(nivelId: number, capId: number): string {
  return `${nivelId}:${capId}`;
}

/** Result of an admin mutation server action. */
export type ActionResult = { ok: true } | { ok: false; error: string };

/** Everything the admin area reads, assembled once server-side. */
export interface AdminData {
  niveis: Nivel[];
  paginas: Pagina[];
  capacidades: Capacidade[];
  usuarios: Usuario[];
  perms: string[]; // serialized PermMatrix keys (Set is not serializable to a client)
}

// ── Cidades por estrutura (ADR 0008) ─────────────────────────────────────────

export interface CidadeOpcao {
  /** `public_base_cidade.revan_cidade_id` — the key every city read joins on. */
  id: number;
  /** "CIDADE / UF". */
  nome: string;
}

/** A node that can hold cities: a coordenação, or a supervisão under one. */
export interface EstruturaNo {
  /** `vw_hierarquia_rh.codigo_local` — the binding key, stable across re-parents. */
  codigoLocal: string;
  idEstrutura: string;
  nome: string;
  responsavel: string | null;
  email: string | null;
  cidadeIds: number[];
}

export interface SupervisaoNo extends EstruturaNo {
  /** The coordenação above — the pool this supervisão may draw from. */
  coordenacaoCodigoLocal: string;
  coordenacaoNome: string;
}

/** A binding whose node is no longer bindable: inert, and its cities are free again. */
export interface VinculoOrfao {
  codigoLocal: string;
  cidadeIds: number[];
}

export interface EstruturaCidadesData {
  coordenacoes: EstruturaNo[];
  /** Only the 281 supervisões that hang under a coordenação; the other 18 are out. */
  supervisoes: SupervisaoNo[];
  cidades: CidadeOpcao[];
  orfaos: VinculoOrfao[];
}
