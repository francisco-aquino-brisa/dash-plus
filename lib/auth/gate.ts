/**
 * Application access gate, checked after Databricks Apps authenticates the user.
 *
 * A forwarded email is not enough to enter: it must match an ACTIVE row in
 * `tb_usuarios`, joined to `tb_niveis` for the access level. The result
 * populates the session token. Runs server-side only (bootstrap route). Queries
 * Databricks directly via the real client, independent of DATA_SOURCE, with a
 * parameterized email (never inlined). See ADR 0005.
 */

import { DatabricksDataClient } from "@/lib/data/databricks";
import type { SessionUser } from "./jwt";

const CAT = process.env.DATABRICKS_CITIES_CATALOG ?? "gdb_brisanet_comunidade_dev";
const SCHEMA = process.env.DATABRICKS_CITIES_SCHEMA ?? "projeto_brisa_performance";
const USERS = `\`${CAT}\`.\`${SCHEMA}\`.\`tb_usuarios\``;
const NIVEIS = `\`${CAT}\`.\`${SCHEMA}\`.\`tb_niveis\``;

/**
 * Authorize a user by email against `tb_usuarios`. Returns the session user
 * when an ACTIVE record exists, or null when the email is not registered or
 * `ativo = false` (→ access denied). Email match is case-insensitive.
 */
export async function authorizeByEmail(email: string): Promise<SessionUser | null> {
  const normalized = email.trim().toLowerCase();

  if (!normalized) return null;

  const rows = await new DatabricksDataClient().query<{
    nome: unknown;
    cpf: unknown;
    matricula: unknown;
    nivel_id: unknown;
    nivel: unknown;
    ativo: unknown;
  }>(
    `SELECT u.nome, u.cpf, u.matricula, u.nivel_id, n.nome AS nivel, u.ativo
       FROM ${USERS} u
       LEFT JOIN ${NIVEIS} n ON u.nivel_id = n.id
      WHERE lower(u.email) = ? AND u.ativo = true
      LIMIT 1`,
    [normalized],
  );

  const r = rows[0];

  if (!r || r.ativo !== true) return null;

  const nivel = String(r.nivel ?? "");

  return {
    email: normalized,
    nome: String(r.nome ?? ""),
    cpf: r.cpf == null ? null : String(r.cpf),
    matricula: r.matricula == null ? null : String(r.matricula),
    nivelId: Number(r.nivel_id ?? 0),
    nivel,
    isAdmin: nivel.toLowerCase() === "admin",
  };
}
