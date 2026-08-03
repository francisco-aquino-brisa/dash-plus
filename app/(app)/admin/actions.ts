"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { deriveEmail, normalizeCapabilityLabel } from "@/lib/data/admin/derive";
import type { ActionResult } from "@/lib/data/admin/types";
import * as write from "@/lib/data/admin/write";

/**
 * Server actions for the Administração CRUD. Each one re-checks the admin claim
 * (defense in depth — the middleware already guards /admin, but an action can be
 * invoked directly), validates/normalizes input server-side, calls the write
 * layer, then revalidates every admin route so cross-screen counts stay in sync.
 *
 * Writes are not testable locally (the read-only guard blocks the dev tooling);
 * they run against the app-owned tables in production. See ADR 0005 + plan §6.
 */

const ADMIN_PATHS = [
  "/admin/usuarios",
  "/admin/niveis",
  "/admin/cargos",
  "/admin/paginas",
  "/admin/capacidades",
  "/admin/permissoes",
];

async function guard(): Promise<ActionResult | null> {
  const session = await getSession();

  if (!session?.isAdmin) return { ok: false, error: "Sem permissão administrativa." };

  return null;
}

function revalidateAdmin(): void {
  for (const p of ADMIN_PATHS) revalidatePath(p);
}

/** Wrap a mutation with the admin guard, error normalization and revalidation. */
async function mutate(op: () => Promise<void>): Promise<ActionResult> {
  const denied = await guard();

  if (denied) return denied;

  try {
    await op();
    revalidateAdmin();

    return { ok: true };
  } catch (err) {
    console.error("[admin/action] mutation failed:", err);

    return { ok: false, error: "Não foi possível salvar. Tente novamente." };
  }
}

function clean(v: string): string {
  return v.trim();
}

function orNull(v: string): string | null {
  const t = v.trim();

  return t === "" ? null : t;
}

// ── Níveis ──────────────────────────────────────────────────────────────────

export async function saveNivel(input: {
  id?: number;
  nome: string;
  descricao: string;
}): Promise<ActionResult> {
  const nome = clean(input.nome);

  if (!nome) return { ok: false, error: "Informe o nome do nível." };

  return mutate(() =>
    input.id
      ? write.updateNivel(input.id, nome, orNull(input.descricao))
      : write.createNivel(nome, orNull(input.descricao)),
  );
}

export async function removeNivel(id: number): Promise<ActionResult> {
  return mutate(() => write.deleteNivel(id));
}

// ── Cargos ──────────────────────────────────────────────────────────────────

export async function saveCargo(input: {
  id?: number;
  nome: string;
  descricao: string;
}): Promise<ActionResult> {
  const nome = clean(input.nome);

  if (!nome) return { ok: false, error: "Informe o nome do cargo." };

  return mutate(() =>
    input.id
      ? write.updateCargo(input.id, nome, orNull(input.descricao))
      : write.createCargo(nome, orNull(input.descricao)),
  );
}

export async function removeCargo(id: number): Promise<ActionResult> {
  return mutate(() => write.deleteCargo(id));
}

// ── Páginas ─────────────────────────────────────────────────────────────────

export async function savePagina(input: {
  id?: number;
  nome: string;
  icone: string;
  rota: string;
}): Promise<ActionResult> {
  const nome = clean(input.nome);

  if (!nome) return { ok: false, error: "Informe o nome da página." };

  return mutate(() =>
    input.id
      ? write.updatePagina(input.id, nome, orNull(input.icone), orNull(input.rota))
      : write.createPagina(nome, orNull(input.icone), orNull(input.rota)),
  );
}

export async function removePagina(id: number): Promise<ActionResult> {
  return mutate(() => write.deletePagina(id));
}

// ── Capacidades ───────────────────────────────────────────────────────────────

export async function saveCapacidade(input: {
  id?: number;
  label: string;
  descricao: string;
  paginaId: number | null;
}): Promise<ActionResult> {
  const label = normalizeCapabilityLabel(input.label);

  if (!label) return { ok: false, error: "Informe o identificador da capacidade." };

  return mutate(() =>
    input.id
      ? write.updateCapacidade(input.id, label, orNull(input.descricao), input.paginaId)
      : write.createCapacidade(label, orNull(input.descricao), input.paginaId),
  );
}

export async function removeCapacidade(id: number): Promise<ActionResult> {
  return mutate(() => write.deleteCapacidade(id));
}

// ── Usuários ──────────────────────────────────────────────────────────────────

export async function saveUsuario(input: {
  id?: number;
  nome: string;
  nivelId: number | null;
  cargoId: number | null;
  ativo?: boolean;
}): Promise<ActionResult> {
  const nome = clean(input.nome);

  if (!nome) return { ok: false, error: "Informe o nome do usuário." };

  // Email is derived from the name (DESIGN_SYSTEM §5), never taken from the client.
  const email = deriveEmail(nome);

  if (!email) return { ok: false, error: "Não foi possível derivar o e-mail a partir do nome." };

  return mutate(() =>
    input.id
      ? write.updateUsuario(input.id, nome, email, input.nivelId, input.cargoId, input.ativo ?? true)
      : write.createUsuario(nome, email, input.nivelId, input.cargoId),
  );
}

export async function removeUsuario(id: number): Promise<ActionResult> {
  return mutate(() => write.deleteUsuario(id));
}

// ── Matriz de permissões ──────────────────────────────────────────────────────

export async function togglePerm(nivelId: number, capId: number, granted: boolean): Promise<ActionResult> {
  return mutate(() => write.setPerm(nivelId, capId, granted));
}
