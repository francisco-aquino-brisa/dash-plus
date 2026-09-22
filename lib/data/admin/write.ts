import "server-only";

import { DatabricksDataClient } from "@/lib/data/databricks";
import type { ScopeKind } from "@/lib/auth/jwt";
import { T } from "./tables";

/**
 * Write layer for the Administração area (ADR 0005). These are the ONLY writes
 * the app performs against Databricks, and only from the /admin path. The tables
 * are app-owned (the maintainer has ALL PRIVILEGES); every analytics catalog
 * stays strictly read-only.
 *
 * Conventions from the real schema (verified): `id` is GENERATED ALWAYS AS
 * IDENTITY and `criado_em`/`atualizado_em` default to CURRENT_TIMESTAMP(), so
 * INSERTs omit all three and UPDATEs set `atualizado_em` explicitly. Every value
 * is passed as an ordinal `?` parameter — never interpolated into the SQL.
 *
 * The locked defaults are protected by a SQL-level guard so a stale client cannot
 * edit or delete them, both keyed on the real `padrao` column.
 */

function client(): DatabricksDataClient {
  return new DatabricksDataClient();
}

async function run(sql: string, params: unknown[] = []): Promise<void> {
  await client().query(sql, params);
}

// ── Níveis ──────────────────────────────────────────────────────────────────

export function createNivel(nome: string, descricao: string | null): Promise<void> {
  return run(`INSERT INTO ${T.niveis} (nome, descricao, padrao) VALUES (?, ?, 0)`, [nome, descricao]);
}

export function updateNivel(id: number, nome: string, descricao: string | null): Promise<void> {
  return run(
    `UPDATE ${T.niveis} SET nome = ?, descricao = ?, atualizado_em = CURRENT_TIMESTAMP()
      WHERE id = ? AND coalesce(padrao, 0) = 0`,
    [nome, descricao, id],
  );
}

export function deleteNivel(id: number): Promise<void> {
  return run(`DELETE FROM ${T.niveis} WHERE id = ? AND coalesce(padrao, 0) = 0`, [id]);
}

// ── Páginas ─────────────────────────────────────────────────────────────────

export function createPagina(nome: string, icone: string | null, rota: string | null): Promise<void> {
  return run(`INSERT INTO ${T.paginas} (nome, icone, rota) VALUES (?, ?, ?)`, [nome, icone, rota]);
}

export function updatePagina(
  id: number,
  nome: string,
  icone: string | null,
  rota: string | null,
): Promise<void> {
  return run(
    `UPDATE ${T.paginas} SET nome = ?, icone = ?, rota = ?, atualizado_em = CURRENT_TIMESTAMP() WHERE id = ?`,
    [nome, icone, rota, id],
  );
}

export function deletePagina(id: number): Promise<void> {
  return run(`DELETE FROM ${T.paginas} WHERE id = ?`, [id]);
}

// ── Capacidades (tb_permissoes) ───────────────────────────────────────────────

export function createCapacidade(
  label: string,
  descricao: string | null,
  paginaId: number | null,
): Promise<void> {
  return run(`INSERT INTO ${T.permissoes} (label, descricao, pagina_id) VALUES (?, ?, ?)`, [
    label,
    descricao,
    paginaId,
  ]);
}

export function updateCapacidade(
  id: number,
  label: string,
  descricao: string | null,
  paginaId: number | null,
): Promise<void> {
  return run(
    `UPDATE ${T.permissoes} SET label = ?, descricao = ?, pagina_id = ?, atualizado_em = CURRENT_TIMESTAMP() WHERE id = ?`,
    [label, descricao, paginaId, id],
  );
}

export function deleteCapacidade(id: number): Promise<void> {
  return run(`DELETE FROM ${T.permissoes} WHERE id = ?`, [id]);
}

// ── Usuários ──────────────────────────────────────────────────────────────────

/**
 * The fields a user row carries beyond its identity. Grouped because the list
 * outgrew a readable positional signature once the scope columns arrived.
 */
export interface UsuarioFields {
  nivelId: number | null;
  /** `proprio` | `gestor` | `todos` — validated by the caller. */
  escopoTipo: ScopeKind;
  /** Digits only; only meaningful when `escopoTipo === "gestor"`. */
  escopoCpf: string | null;
}

export function createUsuario(
  identity: { nome: string; email: string; cpf: string | null; matricula: string | null },
  fields: UsuarioFields,
): Promise<void> {
  // `ativo` defaults to TRUE — a new user is always Ativo (no status on create).
  // `cpf` and `matricula` come from the hierarchy: the CPF is what binds the
  // user to their position, so a row without it can only ever see itself.
  return run(
    `INSERT INTO ${T.usuarios} (nome, email, cpf, matricula, nivel_id, escopo_tipo, escopo_cpf)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      identity.nome,
      identity.email,
      identity.cpf,
      identity.matricula,
      fields.nivelId,
      fields.escopoTipo,
      fields.escopoTipo === "gestor" ? fields.escopoCpf : null,
    ],
  );
}

export function updateUsuario(
  id: number,
  identity: { nome: string; email: string },
  fields: UsuarioFields & { ativo: boolean },
): Promise<void> {
  return run(
    `UPDATE ${T.usuarios}
        SET nome = ?, email = ?, nivel_id = ?, ativo = ?,
            escopo_tipo = ?, escopo_cpf = ?, atualizado_em = CURRENT_TIMESTAMP()
      WHERE id = ?`,
    [
      identity.nome,
      identity.email,
      fields.nivelId,
      fields.ativo,
      fields.escopoTipo,
      fields.escopoTipo === "gestor" ? fields.escopoCpf : null,
      id,
    ],
  );
}

/** Backfill the CPF of a row created before it was stored (see [[hierarquia]]). */
export function setUsuarioCpf(id: number, cpf: string, matricula: string | null): Promise<void> {
  return run(
    `UPDATE ${T.usuarios} SET cpf = ?, matricula = coalesce(matricula, ?), atualizado_em = CURRENT_TIMESTAMP()
      WHERE id = ? AND coalesce(cpf, '') = ''`,
    [cpf, matricula, id],
  );
}

export function deleteUsuario(id: number): Promise<void> {
  return run(`DELETE FROM ${T.usuarios} WHERE id = ?`, [id]);
}

// ── Permissões por nível (matriz) ─────────────────────────────────────────────

const ADMIN_NIVEL_TTL_MS = 5 * 60_000;

let adminNivelCache: { ids: number[]; at: number } | null = null;

/**
 * The ids of the locked `admin` nível, memoized.
 *
 * Resolving this per toggle cost a round-trip (~735ms measured) on an answer
 * that changes essentially never — `admin` is seeded and `updateNivel`/
 * `deleteNivel` refuse to touch it. On a read failure the cache is not
 * populated and the caller treats every nível as locked, which fails closed.
 */
async function adminNivelIds(): Promise<number[]> {
  if (adminNivelCache && Date.now() - adminNivelCache.at < ADMIN_NIVEL_TTL_MS) {
    return adminNivelCache.ids;
  }

  const rows = await client().query<{ id: unknown }>(
    `SELECT id FROM ${T.niveis} WHERE lower(nome) = 'admin'`,
  );
  const ids = rows.map((r) => Number(r.id)).filter(Number.isFinite);

  adminNivelCache = { ids, at: Date.now() };

  return ids;
}

/**
 * Grant/revoke a capability for a level. The `admin` level is fully granted and
 * immutable, guarded here so a stale client cannot alter it. Grant is idempotent
 * (delete-then-insert) since the junction has no enforced uniqueness.
 */
export async function setPerm(nivelId: number, capId: number, granted: boolean): Promise<void> {
  if ((await adminNivelIds()).includes(nivelId)) return;

  if (!granted) {
    return run(`DELETE FROM ${T.permissoesNivel} WHERE nivel_id = ? AND permissao_id = ?`, [nivelId, capId]);
  }

  // One statement instead of DELETE-then-INSERT: each Delta write is a separate
  // commit, and the junction has no uniqueness to make a bare INSERT safe.
  await run(
    `MERGE INTO ${T.permissoesNivel} t
     USING (SELECT ? AS nivel_id, ? AS permissao_id) s
        ON t.nivel_id = s.nivel_id AND t.permissao_id = s.permissao_id
      WHEN NOT MATCHED THEN INSERT (nivel_id, permissao_id) VALUES (s.nivel_id, s.permissao_id)`,
    [nivelId, capId],
  );
}
