"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { describeScope } from "@/lib/auth/scope";
import { nivelRhLabel, normalizeCapabilityLabel } from "@/lib/data/admin/derive";
import {
  findHierarquiaCandidate,
  findHierarquiaPessoa,
  findHierarquiaPessoaByEmail,
  readUsuarioIdentity,
  searchHierarquiaCandidates,
  searchHierarquiaPessoas,
  type HierarquiaCandidate,
  type HierarquiaPessoa,
} from "@/lib/data/admin/hierarquia";
import {
  filterCidadesValidas,
  readCidadesDosNos,
  readSupervisoesDaCoordenacao,
  resolveNos,
} from "@/lib/data/admin/estrutura-cidades";
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
  "/admin/cidades",
  "/admin/niveis",
  "/admin/paginas",
  "/admin/capacidades",
  "/admin/permissoes",
];

async function guard(): Promise<ActionResult | null> {
  const session = await getSession();

  if (!session?.isAdmin) return { ok: false, error: "Sem permissão administrativa." };

  return null;
}

/**
 * Wrap a mutation with the admin guard, error normalization and revalidation.
 *
 * `paths` narrows what gets revalidated. It matters for latency, not just
 * tidiness: revalidating the route the caller is ON makes Next re-render it into
 * the action's response, and an admin screen's reads are serialized Databricks
 * round-trips. A screen that already holds the new state optimistically should
 * leave itself out.
 */
async function mutate(
  op: () => Promise<void>,
  paths: readonly string[] = ADMIN_PATHS,
): Promise<ActionResult> {
  const denied = await guard();

  if (denied) return denied;

  try {
    await op();

    for (const p of paths) revalidatePath(p);

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

/**
 * Search hierarchy candidates for the "Vincular usuário" picker (admin-only).
 * Returns [] when unauthorized so the client control degrades to empty.
 */
export async function searchUsuarioCandidates(query: string): Promise<HierarquiaCandidate[]> {
  const session = await getSession();

  if (!session?.isAdmin) return [];

  return searchHierarquiaCandidates(query ?? "");
}

/**
 * Search people for the "vê o mesmo que" picker (admin-only). Unlike the
 * candidate search this includes people already registered — the person you
 * delegate to is usually a manager who is already a user.
 */
export async function searchUsuarioPessoas(query: string): Promise<HierarquiaPessoa[]> {
  const session = await getSession();

  if (!session?.isAdmin) return [];

  return searchHierarquiaPessoas(query ?? "");
}

/**
 * Resolve the escopo the client asked for into what is safe to store.
 *
 * The delegated CPF is re-validated against the hierarchy here, never trusted
 * from the client: pointing a user at a CPF that is not in the view would grant
 * a scope nobody can audit. Anything unrecognized collapses to `proprio`, the
 * closed end — an escopo must never widen by accident.
 */
async function resolveEscopo(
  escopoTipo: unknown,
  escopoCpf: unknown,
): Promise<{ fields: write.UsuarioFields["escopoTipo"]; cpf: string | null } | { error: string }> {
  if (escopoTipo === "todos") return { fields: "todos", cpf: null };

  if (escopoTipo !== "gestor") return { fields: "proprio", cpf: null };

  const pessoa = await findHierarquiaPessoa(typeof escopoCpf === "string" ? escopoCpf : "");

  if (!pessoa) {
    return { error: "Selecione uma pessoa válida da hierarquia para o escopo delegado." };
  }

  return { fields: "gestor", cpf: pessoa.cpf };
}

export interface EscopoPreview {
  /** Node labels, e.g. `["supervisão CIDADE - CAMOCIM/CE"]`. Empty ⇒ only itself. */
  nos: string[];
  pessoas: number;
  /** The CPF is not in `vw_hierarquia` (CLT-only) — the scope resolves to nothing. */
  foraDaHierarquia: boolean;
}

/**
 * What the chosen escopo resolves to right now, shown under the field so the
 * admin sees the consequence before saving. `proprio` resolves the person being
 * edited (by CPF on edit, by the picked e-mail on create).
 */
export async function previewEscopo(input: {
  escopoTipo?: string;
  escopoCpf?: string | null;
  /** The user's own CPF (edit) — falls back to `email` on create. */
  cpf?: string | null;
  email?: string | null;
}): Promise<EscopoPreview | null> {
  const session = await getSession();

  if (!session?.isAdmin || input.escopoTipo === "todos") return null;

  let cpf = input.escopoTipo === "gestor" ? (input.escopoCpf ?? "") : (input.cpf ?? "");

  if (!cpf && input.escopoTipo !== "gestor" && input.email) {
    cpf = (await findHierarquiaPessoaByEmail(input.email))?.cpf ?? "";
  }

  if (!cpf) return { nos: [], pessoas: 0, foraDaHierarquia: true };

  const { nodes, people, inHierarchy } = await describeScope(cpf);

  return {
    nos: nodes.map((n) => `${nivelRhLabel(n.nivel)} ${n.nome}`),
    pessoas: people,
    foraDaHierarquia: !inHierarchy,
  };
}

export async function saveUsuario(input: {
  id?: number;
  /** Selected candidate e-mail (create only) — re-validated against the hierarchy. */
  email?: string;
  nivelId: number | null;
  ativo?: boolean;
  escopoTipo?: string;
  /** CPF of the person whose view is delegated — only read when `escopoTipo === "gestor"`. */
  escopoCpf?: string | null;
}): Promise<ActionResult> {
  const denied = await guard();

  if (denied) return denied;

  const escopo = await resolveEscopo(input.escopoTipo, input.escopoCpf);

  if ("error" in escopo) return { ok: false, error: escopo.error };

  const fields = {
    nivelId: input.nivelId,
    escopoTipo: escopo.fields,
    escopoCpf: escopo.cpf,
  };

  if (input.id) {
    // Edit: only nível/status/escopo change. Nome/e-mail come from the stored
    // row, never the client, so a forged payload cannot rewrite another identity.
    const identity = await readUsuarioIdentity(input.id);

    if (!identity) return { ok: false, error: "Usuário não encontrado." };

    return mutate(() => write.updateUsuario(input.id!, identity, { ...fields, ativo: input.ativo ?? true }));
  }

  // Create: bind a person selected from the hierarchy. The e-mail is resolved back
  // to its canonical identity server-side (must exist there and not be registered).
  const candidate = await findHierarquiaCandidate(input.email ?? "");

  if (!candidate) {
    return {
      ok: false,
      error: "Selecione um usuário válido da hierarquia (com e-mail e ainda não cadastrado).",
    };
  }

  return mutate(() =>
    write.createUsuario(
      {
        nome: candidate.nome,
        email: candidate.email,
        // Digits only: the CPF is the scope key, and it is stored from the start
        // so the user resolves to their own position on first login.
        cpf: (candidate.cpf ?? "").replace(/\D/g, "") || null,
        matricula: candidate.matricula,
      },
      fields,
    ),
  );
}

export async function removeUsuario(id: number): Promise<ActionResult> {
  return mutate(() => write.deleteUsuario(id));
}

// ── Matriz de permissões ──────────────────────────────────────────────────────

export async function togglePerm(nivelId: number, capId: number, granted: boolean): Promise<ActionResult> {
  // Not /admin/permissoes: the matrix commits its own state, and revalidating it
  // would re-read the whole screen into this response for nothing.
  return mutate(() => write.setPerm(nivelId, capId, granted), ["/admin/niveis"]);
}

// ── Cidades por supervisão ───────────────────────────────────────────────────

/**
 * Apply a batch of (nó, cidade) moves — the unit every pivot of the screen
 * produces, since binding a city to a supervisão and binding a supervisão to a
 * city are the same row.
 *
 * Everything is re-resolved server-side (nodes against the current RH load,
 * cities against the current organograma, the pool against what is stored)
 * because this is a data-scope grant: a forged payload would otherwise widen
 * what a whole branch can read.
 */
export async function salvarVinculos(
  alteracoes: { codigoLocal: string; cidadeId: number; vincular: boolean }[],
): Promise<ActionResult> {
  const denied = await guard();

  if (denied) return denied;

  const moves = alteracoes
    .map((a) => ({ ...a, codigoLocal: clean(a.codigoLocal) }))
    .filter((a) => a.codigoLocal && Number.isInteger(a.cidadeId));

  if (moves.length === 0) return { ok: false, error: "Nenhuma alteração para salvar." };

  const codigos = [...new Set(moves.map((a) => a.codigoLocal))];
  const cidades = [...new Set(moves.map((a) => a.cidadeId))];
  const [nos, cidadesValidas] = await Promise.all([resolveNos(codigos), filterCidadesValidas(cidades)]);

  if (nos.size !== codigos.length) {
    return { ok: false, error: "Alguma coordenação ou supervisão não está na carga atual do RH." };
  }

  if (cidadesValidas.length !== cidades.length) {
    return { ok: false, error: "Alguma cidade não está na lista de cidades operadas." };
  }

  // The pool a supervisão draws from is the coordenação's state AFTER this same
  // batch: adding a city to the coordenação and handing it to a supervisão in
  // one save is legitimate, and checking against the stored pool would reject it.
  const coordenacoes = [
    ...new Set(
      moves.map((a) => {
        const no = nos.get(a.codigoLocal)!;

        return no.nivel === "coordenacao" ? no.codigoLocal : (no.paiCodigoLocal ?? "");
      }),
    ),
  ].filter(Boolean);
  const stored = await readCidadesDosNos(coordenacoes);

  const poolOf = (codigo: string) => {
    const pool = new Set(stored.get(codigo) ?? []);

    for (const a of moves) {
      if (a.codigoLocal !== codigo) continue;

      if (a.vincular) pool.add(a.cidadeId);
      else pool.delete(a.cidadeId);
    }

    return pool;
  };

  for (const a of moves) {
    const no = nos.get(a.codigoLocal)!;

    if (!a.vincular || no.nivel !== "supervisao") continue;

    if (!poolOf(no.paiCodigoLocal ?? "").has(a.cidadeId)) {
      return { ok: false, error: "Só dá para atribuir à supervisão uma cidade que está na coordenação." };
    }
  }

  // Dropping a city from a coordenação drops it from the supervisões below too:
  // the screen confirms the count, but the cascade itself is recomputed here.
  const dropped = moves.filter((a) => !a.vincular && nos.get(a.codigoLocal)?.nivel === "coordenacao");
  const filhas = await readSupervisoesDaCoordenacao([...new Set(dropped.map((a) => a.codigoLocal))]);
  const cascade = dropped.flatMap((a) =>
    (filhas.get(a.codigoLocal) ?? []).map((codigoLocal) => ({ codigoLocal, cidadeId: a.cidadeId })),
  );
  const pairs = (vincular: boolean) =>
    moves
      .filter((a) => a.vincular === vincular)
      .map((a) => ({ codigoLocal: a.codigoLocal, cidadeId: a.cidadeId }));
  const toRemove = dedupePairs([...pairs(false), ...cascade]);
  const session = await getSession();

  return mutate(async () => {
    await write.unlinkParesCidades(toRemove);
    await write.linkParesCidades(pairs(true), session?.email ?? null);
  });
}

function dedupePairs(pares: { codigoLocal: string; cidadeId: number }[]) {
  const seen = new Set<string>();

  return pares.filter((p) => {
    const key = `${p.codigoLocal}|${p.cidadeId}`;

    if (seen.has(key)) return false;

    seen.add(key);

    return true;
  });
}

/** Clear a binding left behind by a node that is no longer bindable. */
export async function limparVinculoOrfao(codigoLocal: string): Promise<ActionResult> {
  const key = clean(codigoLocal);

  if (!key) return { ok: false, error: "Vínculo não informado." };

  return mutate(() => write.clearCidades(key));
}
