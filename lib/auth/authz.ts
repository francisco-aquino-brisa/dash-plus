/**
 * Application-level authorization, checked AFTER the SSO validates credentials.
 *
 * A valid Brisanet SSO account is not enough to enter the dashboard: the CPF must
 * also exist in `cadastro_usuario` with `usuario_ativo = true`. That table also
 * carries the user's `email` and `permissao`, which go into the session token.
 *
 * Runs server-side only (login route). Queries Databricks directly via the real
 * client, independent of DATA_SOURCE, with a parameterized CPF (never inlined).
 */

import { DatabricksDataClient } from "@/lib/data/databricks";
import { onlyDigits } from "./cpf";

const CAT = process.env.DATABRICKS_CITIES_CATALOG ?? "gdb_brisanet_comunidade_dev";
const SCHEMA = process.env.DATABRICKS_CITIES_SCHEMA ?? "projeto_brisa_performance";
const TABLE = `\`${CAT}\`.\`${SCHEMA}\`.\`cadastro_usuario\``;

export interface UserAuthorization {
  email: string;
  permissao: string;
}

/**
 * Authorize a user by CPF against `cadastro_usuario`.
 * Returns { email, permissao } when an ACTIVE record exists, or null when the
 * CPF is not registered or `usuario_ativo = false` (→ access denied). The stored
 * CPF is unmasked (11 digits), so we strip punctuation before matching.
 */
export async function authorizeByCpf(cpf: string): Promise<UserAuthorization | null> {
  const digits = onlyDigits(cpf);

  if (digits.length !== 11) return null;

  const rows = await new DatabricksDataClient().query<{
    email: unknown;
    usuario_ativo: unknown;
    permissao: unknown;
  }>(`SELECT email, usuario_ativo, permissao FROM ${TABLE} WHERE cpf = ? LIMIT 1`, [digits]);

  const r = rows[0];

  if (!r || r.usuario_ativo !== true) return null;

  return { email: String(r.email ?? ""), permissao: String(r.permissao ?? "") };
}
