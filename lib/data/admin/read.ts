import "server-only";

import { DatabricksDataClient } from "@/lib/data/databricks";
import { isScopeKind } from "@/lib/auth/jwt";
import { HIERARQUIA, cpfDigits } from "@/lib/data/scope-sql";
import { T } from "./tables";
import type { AdminData, Capacidade, Nivel, Pagina, Usuario } from "./types";

/**
 * Read layer for the Administração area. Queries the app-owned `tb_*` tables
 * directly through the real Databricks client — independent of DATA_SOURCE, like
 * the auth gate (ADR 0005): these tables only exist in the warehouse, there is no
 * mock. All reads are bounded and parameter-free (small policy tables).
 *
 * Each entity is read independently so one failing table degrades to an empty
 * list rather than taking down the whole admin screen.
 */

function toNum(v: unknown): number {
  return v == null ? 0 : Number(v);
}

function toStr(v: unknown): string {
  return v == null ? "" : String(v);
}

function toNullStr(v: unknown): string | null {
  return v == null ? null : String(v);
}

async function safe<T>(label: string, run: () => Promise<T[]>): Promise<T[]> {
  try {
    return await run();
  } catch (err) {
    console.error(`[admin/read] ${label} failed:`, err);

    return [];
  }
}

export async function readNiveis(client: DatabricksDataClient): Promise<Nivel[]> {
  return safe("niveis", async () => {
    const rows = await client.query<{
      id: unknown;
      nome: unknown;
      descricao: unknown;
      padrao: unknown;
      cap_count: unknown;
    }>(
      `SELECT n.id, n.nome, n.descricao, n.padrao, count(pn.permissao_id) AS cap_count
         FROM ${T.niveis} n
         LEFT JOIN ${T.permissoesNivel} pn ON pn.nivel_id = n.id
        GROUP BY n.id, n.nome, n.descricao, n.padrao
        ORDER BY n.id`,
    );

    return rows.map((r) => ({
      id: toNum(r.id),
      nome: toStr(r.nome),
      descricao: toNullStr(r.descricao),
      locked: toNum(r.padrao) === 1,
      capCount: toNum(r.cap_count),
    }));
  });
}

export async function readPaginas(client: DatabricksDataClient): Promise<Pagina[]> {
  return safe("paginas", async () => {
    const rows = await client.query<{
      id: unknown;
      nome: unknown;
      icone: unknown;
      rota: unknown;
      cap_count: unknown;
    }>(
      `SELECT p.id, p.nome, p.icone, p.rota, count(perm.id) AS cap_count
         FROM ${T.paginas} p
         LEFT JOIN ${T.permissoes} perm ON perm.pagina_id = p.id
        GROUP BY p.id, p.nome, p.icone, p.rota
        ORDER BY p.id`,
    );

    return rows.map((r) => ({
      id: toNum(r.id),
      nome: toStr(r.nome),
      icone: toNullStr(r.icone),
      rota: toNullStr(r.rota),
      capCount: toNum(r.cap_count),
    }));
  });
}

export async function readCapacidades(client: DatabricksDataClient): Promise<Capacidade[]> {
  return safe("capacidades", async () => {
    const rows = await client.query<{
      id: unknown;
      label: unknown;
      descricao: unknown;
      pagina_id: unknown;
      pagina_nome: unknown;
    }>(
      `SELECT perm.id, perm.label, perm.descricao, perm.pagina_id, p.nome AS pagina_nome
         FROM ${T.permissoes} perm
         LEFT JOIN ${T.paginas} p ON p.id = perm.pagina_id
        ORDER BY perm.pagina_id, perm.id`,
    );

    return rows.map((r) => ({
      id: toNum(r.id),
      label: toStr(r.label),
      descricao: toNullStr(r.descricao),
      paginaId: r.pagina_id == null ? null : toNum(r.pagina_id),
      paginaNome: toNullStr(r.pagina_nome),
    }));
  });
}

export async function readUsuarios(client: DatabricksDataClient): Promise<Usuario[]> {
  return safe("usuarios", async () => {
    // The escopo join resolves the delegated manager's name for display. It is a
    // read of the RH view (2.885 rows), and it only matches for escopo_tipo='gestor'.
    const rows = await client.query<Record<string, unknown>>(
      `SELECT u.id, u.nome, u.email, u.cpf, u.nivel_id, n.nome AS nivel_nome,
              u.ativo, u.sincronizado,
              u.escopo_tipo, u.escopo_cpf, g.nome AS escopo_nome
         FROM ${T.usuarios} u
         LEFT JOIN ${T.niveis} n ON n.id = u.nivel_id
         LEFT JOIN ${HIERARQUIA} g
                ON g.cpf_digits = regexp_replace(u.escopo_cpf, '[^0-9]', '')
        ORDER BY u.nome`,
    );

    return rows.map((r) => ({
      id: toNum(r.id),
      nome: toStr(r.nome),
      email: toStr(r.email),
      cpf: cpfDigits(toNullStr(r.cpf)) || null,
      nivelId: r.nivel_id == null ? null : toNum(r.nivel_id),
      nivelNome: toNullStr(r.nivel_nome),
      ativo: r.ativo === true,
      // `sincronizado` is a nullable tinyint (1 = synced); null/0 → not synced.
      sincronizado: r.sincronizado === true || toNum(r.sincronizado) === 1,
      // A row with no escopo yet reads as `proprio` — never as unrestricted.
      escopoTipo: isScopeKind(r.escopo_tipo) ? r.escopo_tipo : "proprio",
      escopoCpf: cpfDigits(toNullStr(r.escopo_cpf)) || null,
      escopoNome: toNullStr(r.escopo_nome),
    }));
  });
}

export async function readPerms(client: DatabricksDataClient): Promise<string[]> {
  return safe("perms", async () => {
    const rows = await client.query<{ nivel_id: unknown; permissao_id: unknown }>(
      `SELECT nivel_id, permissao_id FROM ${T.permissoesNivel}`,
    );

    return rows.map((r) => `${toNum(r.nivel_id)}:${toNum(r.permissao_id)}`);
  });
}

export type AdminPart = keyof AdminData;

const ALL_PARTS: readonly AdminPart[] = ["niveis", "paginas", "capacidades", "usuarios", "perms"];

/**
 * Read the admin entities a screen actually renders.
 *
 * These run concurrently, so the cost is the SLOWEST part, not the sum — which
 * is why asking for a part you do not render is not free: `usuarios` alone is
 * ~1.2s (its `vw_hierarquia` join) against ~750ms for the rest, so requesting it
 * on a screen that ignores it sets the floor for that screen. Paid on the first
 * render and again on every revalidation.
 */
export async function readAdminData(parts: readonly AdminPart[] = ALL_PARTS): Promise<AdminData> {
  const client = new DatabricksDataClient();
  const wanted = new Set(parts);
  const empty: AdminData = {
    niveis: [],
    paginas: [],
    capacidades: [],
    usuarios: [],
    perms: [],
  };
  const readers: { [K in AdminPart]: () => Promise<AdminData[K]> } = {
    niveis: () => readNiveis(client),
    paginas: () => readPaginas(client),
    capacidades: () => readCapacidades(client),
    usuarios: () => readUsuarios(client),
    perms: () => readPerms(client),
  };
  const selected = ALL_PARTS.filter((part) => wanted.has(part));
  const results = await Promise.all(selected.map((part) => readers[part]()));

  return selected.reduce<AdminData>((acc, part, i) => ({ ...acc, [part]: results[i] }), empty);
}
