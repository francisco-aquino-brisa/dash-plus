import "server-only";

import { DatabricksDataClient } from "@/lib/data/databricks";
import { T } from "./tables";

/**
 * Candidate lookup for "Vincular usuário": the people the admin can bind to an
 * access level are the ones in the corporate hierarchy view (`vw_hierarquia`)
 * that (a) have a registered e-mail and (b) are not already in `tb_usuarios`.
 *
 * The view has ~133k rows but only ~3k distinct e-mails (one person spans many
 * rows), so every query deduplicates by e-mail and is capped — the UI never
 * pulls the whole list, it searches server-side (max 100). Read-only: this view
 * is analytics data, never written. Search terms are passed as `?` params.
 */

const CAT = process.env.DATABRICKS_CITIES_CATALOG ?? "gdb_brisanet_comunidade_dev";
const SCHEMA = process.env.DATABRICKS_CITIES_SCHEMA ?? "projeto_brisa_performance";
const HIER = `\`${CAT}\`.\`${SCHEMA}\`.\`vw_hierarquia\``;

export const CANDIDATE_LIMIT = 100;

export interface HierarquiaCandidate {
  /** Lower-cased e-mail — the stable identity + the app's login key. */
  email: string;
  nome: string;
  cpf: string | null;
  matricula: string | null;
}

function toStr(v: unknown): string {
  return v == null ? "" : String(v);
}

function toNullStr(v: unknown): string | null {
  const s = v == null ? "" : String(v).trim();

  return s === "" ? null : s;
}

function mapRow(r: Record<string, unknown>): HierarquiaCandidate {
  return {
    email: toStr(r.email),
    nome: toStr(r.nome),
    cpf: toNullStr(r.cpf),
    matricula: toNullStr(r.matricula),
  };
}

/** People with e-mail, not yet registered, deduped by e-mail. Capped at 100. */
const SELECT_CANDIDATE = `
  SELECT lower(trim(h.email)) AS email, MAX(h.nome) AS nome, MAX(h.cpf) AS cpf, MAX(h.matricula) AS matricula
    FROM ${HIER} h
   WHERE coalesce(trim(h.email), '') <> ''
     AND lower(trim(h.email)) NOT IN (SELECT lower(trim(email)) FROM ${T.usuarios} WHERE email IS NOT NULL)`;

/**
 * Up to `limit` candidates. With a `query`, matches nome/e-mail/matrícula/CPF
 * (case-insensitive); without one, returns the first `limit` by name.
 */
export async function searchHierarquiaCandidates(
  query: string,
  limit: number = CANDIDATE_LIMIT,
): Promise<HierarquiaCandidate[]> {
  const n = Math.min(CANDIDATE_LIMIT, Math.max(1, Math.floor(limit) || CANDIDATE_LIMIT));
  const term = query.trim().toLowerCase();
  const params: unknown[] = [];
  let where = "";

  if (term) {
    const like = `%${term}%`;

    where = `
     AND (lower(h.nome) LIKE ? OR lower(trim(h.email)) LIKE ? OR lower(h.matricula) LIKE ? OR lower(h.cpf) LIKE ?)`;
    params.push(like, like, like, like);
  }

  const sql = `${SELECT_CANDIDATE}${where}
   GROUP BY lower(trim(h.email))
   ORDER BY nome
   LIMIT ${n}`;

  try {
    const rows = await new DatabricksDataClient().query<Record<string, unknown>>(sql, params);

    return rows.map(mapRow);
  } catch (err) {
    console.error("[admin/hierarquia] search failed:", err);

    return [];
  }
}

/**
 * Server-side re-validation for the create flow: resolves an e-mail back to its
 * canonical hierarchy identity, returning null when the e-mail is not in the
 * hierarchy or is already registered (so a stale/forged client can't bind it).
 */
export async function findHierarquiaCandidate(email: string): Promise<HierarquiaCandidate | null> {
  const key = email.trim().toLowerCase();

  if (!key) return null;

  const sql = `${SELECT_CANDIDATE}
     AND lower(trim(h.email)) = ?
   GROUP BY lower(trim(h.email))
   LIMIT 1`;

  const rows = await new DatabricksDataClient().query<Record<string, unknown>>(sql, [key]);

  return rows[0] ? mapRow(rows[0]) : null;
}

/**
 * A person in the hierarchy, for the "vê o mesmo que" picker — the pool for the
 * delegated scope. Unlike the candidate search above this does NOT exclude
 * people already registered: the person you delegate to is usually a manager
 * who is already a user. Keyed by CPF, which is what the scope stores.
 */
export interface HierarquiaPessoa {
  /** Digits only. */
  cpf: string;
  nome: string;
  email: string | null;
  cargo: string | null;
}

const SELECT_PESSOA = `
  SELECT h.cpf_digits AS cpf, MAX(h.nome) AS nome,
         MAX(h.email) AS email, MAX(h.cargo) AS cargo
    FROM ${HIER} h
   WHERE coalesce(trim(h.cpf), '') <> ''`;

function mapPessoa(r: Record<string, unknown>): HierarquiaPessoa {
  return {
    cpf: toStr(r.cpf),
    nome: toStr(r.nome),
    email: toNullStr(r.email),
    cargo: toNullStr(r.cargo),
  };
}

/** Up to `limit` people, matching nome/CPF/matrícula/e-mail. Deduped by CPF. */
export async function searchHierarquiaPessoas(
  query: string,
  limit: number = CANDIDATE_LIMIT,
): Promise<HierarquiaPessoa[]> {
  const n = Math.min(CANDIDATE_LIMIT, Math.max(1, Math.floor(limit) || CANDIDATE_LIMIT));
  const term = query.trim().toLowerCase();
  const params: unknown[] = [];
  let where = "";

  if (term) {
    const like = `%${term}%`;
    const digits = term.replace(/\D/g, "");
    // The CPF clause only joins the OR when the term actually has digits —
    // otherwise its LIKE collapses to '%%' and matches every row.
    const clauses = ["lower(h.nome) LIKE ?", "lower(trim(h.email)) LIKE ?", "lower(h.matricula) LIKE ?"];

    params.push(like, like, like);

    if (digits) {
      clauses.push("h.cpf_digits LIKE ?");
      params.push(`%${digits}%`);
    }

    where = `
     AND (${clauses.join(" OR ")})`;
  }

  const sql = `${SELECT_PESSOA}${where}
   GROUP BY h.cpf_digits
   ORDER BY nome
   LIMIT ${n}`;

  try {
    const rows = await new DatabricksDataClient().query<Record<string, unknown>>(sql, params);

    return rows.map(mapPessoa);
  } catch (err) {
    console.error("[admin/hierarquia] people search failed:", err);

    return [];
  }
}

/**
 * Resolve a CPF back to its hierarchy identity — the server-side re-validation
 * for the delegated scope, so a stale or forged client cannot point a user at
 * someone who is not in the hierarchy.
 */
export async function findHierarquiaPessoa(cpf: string): Promise<HierarquiaPessoa | null> {
  const key = cpf.replace(/\D/g, "");

  if (!key) return null;

  const rows = await new DatabricksDataClient().query<Record<string, unknown>>(
    `${SELECT_PESSOA}
       AND h.cpf_digits = ?
     GROUP BY h.cpf_digits
     LIMIT 1`,
    [key],
  );

  return rows[0] ? mapPessoa(rows[0]) : null;
}

/**
 * Same, keyed by e-mail — used on create, where the picker only carries the
 * e-mail and the escopo preview still needs the CPF behind it.
 */
export async function findHierarquiaPessoaByEmail(email: string): Promise<HierarquiaPessoa | null> {
  const key = email.trim().toLowerCase();

  if (!key) return null;

  const rows = await new DatabricksDataClient().query<Record<string, unknown>>(
    `${SELECT_PESSOA}
       AND lower(trim(h.email)) = ?
     GROUP BY h.cpf_digits
     LIMIT 1`,
    [key],
  );

  return rows[0] ? mapPessoa(rows[0]) : null;
}

/** Stored identity of an existing user — used on edit so nome/e-mail are never taken from the client. */
export async function readUsuarioIdentity(id: number): Promise<{ nome: string; email: string } | null> {
  const rows = await new DatabricksDataClient().query<{ nome: unknown; email: unknown }>(
    `SELECT nome, email FROM ${T.usuarios} WHERE id = ? LIMIT 1`,
    [id],
  );
  const r = rows[0];

  return r ? { nome: toStr(r.nome), email: toStr(r.email) } : null;
}
