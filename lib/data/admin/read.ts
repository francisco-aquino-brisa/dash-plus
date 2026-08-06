import "server-only";

import { DatabricksDataClient } from "@/lib/data/databricks";
import { T } from "./tables";
import { isLockedNivel } from "./derive";
import type { AdminData, Cargo, Capacidade, Nivel, Pagina, Usuario } from "./types";

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
    const rows = await client.query<{ id: unknown; nome: unknown; descricao: unknown; cap_count: unknown }>(
      `SELECT n.id, n.nome, n.descricao, count(pn.permissao_id) AS cap_count
         FROM ${T.niveis} n
         LEFT JOIN ${T.permissoesNivel} pn ON pn.nivel_id = n.id
        GROUP BY n.id, n.nome, n.descricao
        ORDER BY n.id`,
    );

    return rows.map((r) => {
      const nome = toStr(r.nome);

      return {
        id: toNum(r.id),
        nome,
        descricao: toNullStr(r.descricao),
        locked: isLockedNivel(nome),
        capCount: toNum(r.cap_count),
      };
    });
  });
}

export async function readCargos(client: DatabricksDataClient): Promise<Cargo[]> {
  return safe("cargos", async () => {
    const rows = await client.query<{
      id: unknown;
      nome: unknown;
      descricao: unknown;
      padrao: unknown;
      pessoas: unknown;
    }>(
      `SELECT c.id, c.nome, c.descricao, c.padrao, count(u.id) AS pessoas
         FROM ${T.cargos} c
         LEFT JOIN ${T.usuarios} u ON u.cargo_id = c.id
        GROUP BY c.id, c.nome, c.descricao, c.padrao
        ORDER BY c.id`,
    );

    return rows.map((r) => ({
      id: toNum(r.id),
      nome: toStr(r.nome),
      descricao: toNullStr(r.descricao),
      locked: toNum(r.padrao) === 1,
      pessoas: toNum(r.pessoas),
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
    const rows = await client.query<Record<string, unknown>>(
      `SELECT u.id, u.nome, u.email, u.nivel_id, n.nome AS nivel_nome,
              u.cargo_id, c.nome AS cargo_nome, u.ativo, u.sincronizado
         FROM ${T.usuarios} u
         LEFT JOIN ${T.niveis} n ON n.id = u.nivel_id
         LEFT JOIN ${T.cargos} c ON c.id = u.cargo_id
        ORDER BY u.nome`,
    );

    return rows.map((r) => ({
      id: toNum(r.id),
      nome: toStr(r.nome),
      email: toStr(r.email),
      nivelId: r.nivel_id == null ? null : toNum(r.nivel_id),
      nivelNome: toNullStr(r.nivel_nome),
      cargoId: r.cargo_id == null ? null : toNum(r.cargo_id),
      cargoNome: toNullStr(r.cargo_nome),
      ativo: r.ativo === true,
      // `sincronizado` is a nullable tinyint (1 = synced); null/0 → not synced.
      sincronizado: r.sincronizado === true || toNum(r.sincronizado) === 1,
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

/** Read everything the admin area needs in one shot (per request, server-side). */
export async function readAdminData(): Promise<AdminData> {
  const client = new DatabricksDataClient();
  const [niveis, cargos, paginas, capacidades, usuarios, perms] = await Promise.all([
    readNiveis(client),
    readCargos(client),
    readPaginas(client),
    readCapacidades(client),
    readUsuarios(client),
    readPerms(client),
  ]);

  return { niveis, cargos, paginas, capacidades, usuarios, perms };
}
