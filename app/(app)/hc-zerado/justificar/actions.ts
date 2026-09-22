"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { hasCap } from "@/lib/auth/permissions";
import { CAP } from "@/lib/auth/capabilities";
import { resolveUserId } from "@/lib/auth/gate";
import { safeIsoDate } from "@/lib/data/_shared";
import { isCategoria, isStatus } from "@/lib/data/hc-zerado/catalog";
import {
  avaliarJustificativa,
  deleteJustificativa,
  updateRegras,
  upsertJustificativa,
} from "@/lib/data/hc-zerado/write";
import type { ActionResult } from "@/lib/data/admin/types";

/**
 * Server actions for Tela 4 — the module's only writes.
 *
 * Who may write: any signed-in user, for anyone, including their own
 * justification and their own verdict on it. That is the origin's model and it
 * was kept deliberately; what the app adds is the trail, so every row now says
 * who wrote it and who judged it (`autor_id` / `avaliador_id`, both 100% null in
 * everything the origin ever wrote).
 *
 * Every value from the request is validated here before it reaches SQL, and
 * reaches it as an ordinal `?`. Dates go through `safeIsoDate`.
 */

/**
 * Who to stamp on the row. The cookie is the fast path; a session minted before
 * `SessionUser.id` existed carries null, and stamping that null would leave the
 * audit columns as empty as the origin left them — so fall back to the e-mail.
 */
const idByEmail = new Map<string, number | null>();

async function autorId(session: { id: number | null; email: string }): Promise<number | null> {
  if (session.id != null) return session.id;

  // Memoised: a person's `tb_usuarios.id` does not change, and this fallback
  // would otherwise add a Databricks round-trip to every single save.
  if (idByEmail.has(session.email)) return idByEmail.get(session.email) ?? null;

  const id = await resolveUserId(session.email);

  idByEmail.set(session.email, id);

  return id;
}

const MOTIVO_MIN = 15;
const MOTIVO_MAX = 400;
const OBSERVACAO_MAX = 400;

const STATUS_VENDA = ["CRIADO", "EFETIVADO", "INSTALADO"];
const AGILIDADE = ["Todos", "Efetivado", "Instalado"];
/** The services the source actually carries — verified, not guessed. */
const SERVICOS = ["INTERNET", "FWA", "5G", "RENOVACAO"];

function revalidate(): void {
  // Both screens read `justificativas_hc_zerado`; a save on one has to move the other.
  revalidatePath("/hc-zerado/justificar");
  revalidatePath("/hc-zerado/auditar");
}

/** A matrícula is the business key on an INT column — reject anything that is not digits. */
function matricula(value: string): string | null {
  const trimmed = value.trim();

  return /^\d{1,9}$/.test(trimmed) ? trimmed : null;
}

export interface JustificativaFormInput {
  matricula: string;
  dataOcorrencia: string;
  categoria: string;
  motivo: string;
  status: string;
  observacaoLider: string;
}

/**
 * Save one justification, and its verdict when the form carries one.
 *
 * Two statements, in this order, exactly as the origin: the MERGE always lands
 * the text and resets the verdict, then the evaluation re-applies it. So a
 * justification edited without touching the leader panel ends up back in "Em
 * Análise" — which is the point: the previous approval was given for text that
 * no longer exists.
 */
export async function salvarJustificativa(input: JustificativaFormInput): Promise<ActionResult> {
  const session = await getSession();

  if (!session) return { ok: false, error: "Sessão expirada. Recarregue a página." };

  // The form posts both halves whoever is saving, so the capabilities — not the
  // payload — decide which half is actually written (ADR 0007).
  const podeColaborador = hasCap(session, CAP.HC_JUSTIFICATIVA_COLABORADOR);
  const podeGestor = hasCap(session, CAP.HC_DEVOLUTIVA_GESTOR);

  if (!podeColaborador && !podeGestor) {
    return { ok: false, error: "Você não tem permissão para editar esta justificativa." };
  }

  const mat = matricula(input.matricula);

  if (!mat) return { ok: false, error: "Matrícula inválida." };

  const data = safeIsoDate(input.dataOcorrencia);

  if (!data) return { ok: false, error: "Data da ocorrência inválida." };

  const status = podeGestor ? input.status.trim() : "Em Análise";

  if (!isStatus(status)) return { ok: false, error: "Status da ocorrência inválido." };

  const observacao = podeGestor ? input.observacaoLider.trim() : "";

  if (observacao.length > OBSERVACAO_MAX) {
    return { ok: false, error: `A observação passa de ${OBSERVACAO_MAX} caracteres.` };
  }

  // A verdict is "the leader touched the panel": a status other than the default,
  // or a note. Without one the row goes back to Em Análise with no reviewer.
  const avaliado = status !== "Em Análise" || observacao.length > 0;
  const usuarioId = await autorId(session);

  try {
    if (!podeColaborador) {
      const answered = await avaliarJustificativa({
        matricula: mat,
        dataOcorrencia: data,
        status,
        observacaoLider: observacao || null,
        avaliado,
        usuarioId,
      });

      if (!answered) {
        return { ok: false, error: "Não há justificativa registrada neste dia para avaliar." };
      }

      revalidate();

      return { ok: true };
    }

    const categoria = input.categoria.trim();

    if (!isCategoria(categoria)) {
      return { ok: false, error: "Selecione uma categoria da lista." };
    }

    const motivo = input.motivo.trim();

    if (motivo.length < MOTIVO_MIN) {
      return { ok: false, error: `Descreva o motivo com pelo menos ${MOTIVO_MIN} caracteres.` };
    }

    if (motivo.length > MOTIVO_MAX) {
      return { ok: false, error: `O motivo passa de ${MOTIVO_MAX} caracteres.` };
    }

    await upsertJustificativa({
      matricula: mat,
      dataOcorrencia: data,
      categoria,
      motivo,
      status,
      observacaoLider: observacao || null,
      avaliado,
      usuarioId,
    });

    revalidate();

    return { ok: true };
  } catch (err) {
    console.error("[hc-zerado/salvarJustificativa] failed:", err);

    return { ok: false, error: "Não foi possível salvar. Tente novamente." };
  }
}

/**
 * Delete a justification. Destructive and not undoable, so the UI confirms
 * before calling — and, unlike the edit path, this leaves no trace behind: the
 * row is gone, not marked. Open to any signed-in user, like the rest of the
 * screen (see the note at the top); if the business wants deletion restricted,
 * that is the first rule worth putting behind a capability.
 */
export async function excluirJustificativa(
  matriculaRaw: string,
  dataOcorrenciaRaw: string,
): Promise<ActionResult> {
  const session = await getSession();

  if (!session) return { ok: false, error: "Sessão expirada. Recarregue a página." };

  if (!hasCap(session, CAP.HC_JUSTIFICATIVA_COLABORADOR)) {
    return { ok: false, error: "Você não tem permissão para excluir esta justificativa." };
  }

  const mat = matricula(matriculaRaw);

  if (!mat) return { ok: false, error: "Matrícula inválida." };

  const data = safeIsoDate(dataOcorrenciaRaw);

  if (!data) return { ok: false, error: "Data da ocorrência inválida." };

  try {
    await deleteJustificativa(mat, data);
    revalidate();

    return { ok: true };
  } catch (err) {
    console.error("[hc-zerado/excluirJustificativa] failed:", err);

    return { ok: false, error: "Não foi possível excluir. Tente novamente." };
  }
}

export interface RegrasFormInput {
  servicos: string[];
  statusVenda: string;
  agilidade: string;
}

/**
 * Edit the global rules — what counts as a sale for the whole company on this
 * screen. Open to any signed-in user, as in the origin; the values themselves
 * are restricted to what the source can actually answer, so a typo cannot
 * silently mark everybody idle.
 */
export async function salvarRegras(input: RegrasFormInput): Promise<ActionResult> {
  const session = await getSession();

  if (!session) return { ok: false, error: "Sessão expirada. Recarregue a página." };

  const servicos = [...new Set(input.servicos.map((s) => s.trim().toUpperCase()))].filter((s) =>
    SERVICOS.includes(s),
  );

  if (servicos.length === 0) return { ok: false, error: "Selecione ao menos um serviço obrigatório." };

  const statusVenda = input.statusVenda.trim().toUpperCase();

  if (!STATUS_VENDA.includes(statusVenda)) return { ok: false, error: "Status da venda inválido." };

  const agilidade = input.agilidade.trim();

  if (!AGILIDADE.includes(agilidade)) return { ok: false, error: "Agilidade inválida." };

  try {
    await updateRegras({ servicos, statusVenda, agilidade });
    revalidate();

    return { ok: true };
  } catch (err) {
    console.error("[hc-zerado/salvarRegras] failed:", err);

    return { ok: false, error: "Não foi possível salvar a regra global." };
  }
}
