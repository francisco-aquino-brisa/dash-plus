/**
 * View models for the Administração area. These mirror the real `tb_*` schema
 * verified in the warehouse (see docs/migration/new-ui-plan.md §6), plus the two
 * fields the new_ui model needs that the schema does not store — `locked` and the
 * chip colour — which are derived (see ./derive.ts), never read from a column.
 */

export interface Nivel {
  id: number;
  nome: string;
  descricao: string | null;
  /** Derived: true for the seeded `admin` level (badge "Padrão", non-editable). */
  locked: boolean;
  /** Count of capabilities granted to this level (n de N in the UI). */
  capCount: number;
}

export interface Cargo {
  id: number;
  nome: string;
  descricao: string | null;
  /** From the `padrao` column: true for seeded default cargos (padrao = 1). */
  locked: boolean;
  /** People assigned to this cargo. */
  pessoas: number;
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
  nivelId: number | null;
  nivelNome: string | null;
  cargoId: number | null;
  cargoNome: string | null;
  ativo: boolean;
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
  cargos: Cargo[];
  paginas: Pagina[];
  capacidades: Capacidade[];
  usuarios: Usuario[];
  perms: string[]; // serialized PermMatrix keys (Set is not serializable to a client)
}
