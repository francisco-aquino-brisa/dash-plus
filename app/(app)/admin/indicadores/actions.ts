"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/data/admin/types";
import {
  categoriaKey,
  categoriaPrefix,
  nextIndicadorGeralId,
  servicoCode,
  servicoNome,
} from "@/lib/data/indicators/codes";
import { runPreview, type PreviewFilters, type PreviewResult } from "@/lib/data/indicators/engine";
import { CATALOG_PAGES } from "@/lib/data/indicators/pages";
import {
  countServicosDoIndicador,
  indicadorGeralExists,
  indicadorServicoExists,
  paginaIndicadorExists,
  readIndicadorGeralIdsComPrefixo,
  readPaginasCatalogo,
} from "@/lib/data/indicators/read";
import { readSourceColumns } from "@/lib/data/indicators/source-columns";
import { parseSpec, serializeSpec, validateSpec } from "@/lib/data/indicators/spec";
import type { ServicoDraft } from "@/lib/data/indicators/types";
import {
  createIndicadorGeral,
  createIndicadorServico,
  createPaginaIndicador,
  deleteIndicadorGeral,
  deleteIndicadorServico,
  deletePaginaIndicador,
  updatePaginaIndicador,
  updateEspecificacaoCalculo,
  updateIndicadorGeral,
  updateIndicadorServico,
  type IndicadorServicoInput,
} from "@/lib/data/indicators/write";

export type PreviewResponse =
  { ok: true; result: PreviewResult; formato: string; polaridade: string } | { ok: false; error: string };

/**
 * Compute a preview of an indicator from its `especificacao_calculo` JSON + basic
 * filters. Admin-only, read-only (SELECT). Validates the spec against the source
 * columns before running — an invalid/unregistered spec never reaches the engine.
 */
export async function previewIndicador(specJson: string, filters: PreviewFilters): Promise<PreviewResponse> {
  const session = await getSession();

  if (!session?.isAdmin) return { ok: false, error: "Sem permissão administrativa." };

  const spec = parseSpec(specJson);

  if (!spec) return { ok: false, error: "Definição de cálculo inválida." };

  const columnsBySource = await readSourceColumns();
  const issues = validateSpec(spec, columnsBySource);

  if (issues.length > 0) return { ok: false, error: issues[0].message };

  try {
    const result = await runPreview(spec, filters, columnsBySource[spec.fonte] ?? []);

    return { ok: true, result, formato: spec.formato, polaridade: spec.polaridade };
  } catch (err) {
    console.error("[indicators/preview] failed:", err);

    return { ok: false, error: "Não foi possível calcular a prévia." };
  }
}

/**
 * Persist an indicator's `especificacao_calculo` to the catalog. Admin-only,
 * re-validates the spec against the real source columns, writes the canonical
 * serialization, then revalidates the indicator routes.
 */
export async function salvarCalculo(servicoId: string, specJson: string): Promise<ActionResult> {
  const session = await getSession();

  if (!session?.isAdmin) return { ok: false, error: "Sem permissão administrativa." };

  if (!servicoId.trim()) return { ok: false, error: "Serviço inválido." };

  const spec = parseSpec(specJson);

  if (!spec) return { ok: false, error: "Definição de cálculo inválida." };

  const columnsBySource = await readSourceColumns();
  const issues = validateSpec(spec, columnsBySource);

  if (issues.length > 0) return { ok: false, error: issues[0].message };

  try {
    await updateEspecificacaoCalculo(servicoId, serializeSpec(spec));
    revalidatePath("/admin/indicadores", "layout");

    return { ok: true };
  } catch (err) {
    console.error("[indicators/salvar] failed:", err);

    return { ok: false, error: "Não foi possível salvar. Tente novamente." };
  }
}

// ── Indicador (CRUD) ────────────────────────────────────────────────────────────

function orNull(v: string): string | null {
  const t = v.trim();

  return t === "" ? null : t;
}

async function guardAdmin(): Promise<ActionResult | null> {
  const session = await getSession();

  if (!session?.isAdmin) return { ok: false, error: "Sem permissão administrativa." };

  return null;
}

/** The serviço code and default name are derived, never trusted from the client. */
function withDerivedFields(
  draft: ServicoDraft,
  idIndicadorGeral: string,
  indicadorGeral: string,
): ServicoDraft {
  const servico = draft.servico.trim();

  return {
    ...draft,
    id: servicoCode(idIndicadorGeral, servico),
    indicadorServico: draft.indicadorServico.trim() || servicoNome(indicadorGeral, servico),
  };
}

function servicoInput(
  draft: ServicoDraft,
  idIndicadorGeral: string,
  categoria: string,
  indicadorGeral: string,
): IndicadorServicoInput {
  return {
    id: draft.id.trim(),
    idIndicadorGeral,
    categoria,
    indicadorGeral,
    servico: draft.servico.trim(),
    indicadorServico: draft.indicadorServico.trim(),
    descricao: orNull(draft.descricao),
    tabela: orNull(draft.tabela),
    colunas: orNull(draft.colunas),
    formatoDado: draft.formatoDado,
    polaridade: draft.polaridade,
    funcao: orNull(draft.funcao),
    metrica: orNull(draft.metrica),
    status: draft.status,
  };
}

function validateServicoDraft(s: ServicoDraft): string | null {
  if (!s.servico.trim()) return "Informe o serviço (ex.: FTTH, FWA, 5G).";

  if (!s.id.trim()) return "Cada serviço precisa de um código.";

  if (!s.indicadorServico.trim()) return "Informe o nome do indicador para esse serviço.";

  return null;
}

/**
 * Create a new indicador geral with at least one serviço — enforced here (a
 * calculable indicator needs somewhere to hold its fórmula/especificação, and an
 * indicador with zero serviços is not addressable anywhere else in the UI).
 */
export async function criarIndicador(input: {
  id?: string;
  categoria: string;
  nome: string;
  status: string;
  servicos: ServicoDraft[];
}): Promise<ActionResult> {
  const denied = await guardAdmin();

  if (denied) return denied;

  const categoria = categoriaKey(input.categoria);
  const nome = input.nome.trim();

  if (!categoria) return { ok: false, error: "Informe a categoria." };

  if (!input.id?.trim() && categoriaPrefix(categoria).length < 2) {
    return { ok: false, error: "Informe o código do indicador." };
  }

  if (!nome) return { ok: false, error: "Informe o nome do indicador." };

  if (input.servicos.length === 0) return { ok: false, error: "Adicione ao menos um serviço." };

  try {
    const id =
      input.id?.trim() ||
      nextIndicadorGeralId(categoria, await readIndicadorGeralIdsComPrefixo(categoriaPrefix(categoria)));
    const servicos = input.servicos.map((s) => withDerivedFields(s, id, nome));

    for (const s of servicos) {
      const issue = validateServicoDraft(s);

      if (issue) return { ok: false, error: issue };
    }

    const servicoIds = servicos.map((s) => s.id);

    if (new Set(servicoIds).size !== servicoIds.length) {
      return { ok: false, error: "O mesmo serviço foi adicionado mais de uma vez." };
    }

    if (await indicadorGeralExists(id)) {
      return { ok: false, error: `Já existe um indicador com o código "${id}".` };
    }

    for (const sid of servicoIds) {
      if (await indicadorServicoExists(sid)) {
        return { ok: false, error: `Já existe um serviço com o código "${sid}".` };
      }
    }

    await createIndicadorGeral(id, categoria, nome, input.status);

    for (const s of servicos) {
      await createIndicadorServico(servicoInput(s, id, categoria, nome));
    }

    revalidatePath("/admin/indicadores", "layout");

    return { ok: true };
  } catch (err) {
    console.error("[indicators/criar] failed:", err);

    return { ok: false, error: "Não foi possível criar o indicador." };
  }
}

/** Edit the parent's categoria/nome/status — cascades to serviços' denormalized copies. */
export async function salvarIndicadorGeral(input: {
  id: string;
  categoria: string;
  nome: string;
  status: string;
}): Promise<ActionResult> {
  const denied = await guardAdmin();

  if (denied) return denied;

  const nome = input.nome.trim();

  if (!nome) return { ok: false, error: "Informe o nome do indicador." };

  try {
    await updateIndicadorGeral(input.id, input.categoria, nome, input.status);
    revalidatePath("/admin/indicadores", "layout");

    return { ok: true };
  } catch (err) {
    console.error("[indicators/salvarGeral] failed:", err);

    return { ok: false, error: "Não foi possível salvar. Tente novamente." };
  }
}

/** Delete the indicador and every serviço under it (no FK cascade in Delta). */
export async function removerIndicador(id: string): Promise<ActionResult> {
  const denied = await guardAdmin();

  if (denied) return denied;

  try {
    await deleteIndicadorGeral(id);
    revalidatePath("/admin/indicadores", "layout");

    return { ok: true };
  } catch (err) {
    console.error("[indicators/removerIndicador] failed:", err);

    return { ok: false, error: "Não foi possível remover. Tente novamente." };
  }
}

// ── Serviço (CRUD) ──────────────────────────────────────────────────────────────

export async function adicionarServico(
  idIndicadorGeral: string,
  categoria: string,
  indicadorGeral: string,
  input: ServicoDraft,
): Promise<ActionResult> {
  const denied = await guardAdmin();

  if (denied) return denied;

  const draft = withDerivedFields(input, idIndicadorGeral, indicadorGeral);
  const issue = validateServicoDraft(draft);

  if (issue) return { ok: false, error: issue };

  try {
    if (await indicadorServicoExists(draft.id)) {
      return { ok: false, error: `Este indicador já tem o serviço "${draft.servico.trim()}" (${draft.id}).` };
    }

    await createIndicadorServico(servicoInput(draft, idIndicadorGeral, categoria, indicadorGeral));
    revalidatePath("/admin/indicadores", "layout");

    return { ok: true };
  } catch (err) {
    console.error("[indicators/adicionarServico] failed:", err);

    return { ok: false, error: "Não foi possível adicionar o serviço." };
  }
}

/** Edit a serviço's own fields. `id`/`idIndicadorGeral` are immutable — never sent back. */
export async function salvarServico(
  idIndicadorGeral: string,
  categoria: string,
  indicadorGeral: string,
  draft: ServicoDraft,
): Promise<ActionResult> {
  const denied = await guardAdmin();

  if (denied) return denied;

  const issue = validateServicoDraft(draft);

  if (issue) return { ok: false, error: issue };

  try {
    await updateIndicadorServico(servicoInput(draft, idIndicadorGeral, categoria, indicadorGeral));
    revalidatePath("/admin/indicadores", "layout");

    return { ok: true };
  } catch (err) {
    console.error("[indicators/salvarServico] failed:", err);

    return { ok: false, error: "Não foi possível salvar. Tente novamente." };
  }
}

/** Refuses to drop the last serviço of an indicador — remove the indicador itself instead. */
export async function removerServico(servicoId: string, idIndicadorGeral: string): Promise<ActionResult> {
  const denied = await guardAdmin();

  if (denied) return denied;

  try {
    const total = await countServicosDoIndicador(idIndicadorGeral);

    if (total <= 1) {
      return {
        ok: false,
        error: "O indicador precisa de ao menos um serviço — para remover este, exclua o indicador inteiro.",
      };
    }

    await deleteIndicadorServico(servicoId);
    revalidatePath("/admin/indicadores", "layout");

    return { ok: true };
  } catch (err) {
    console.error("[indicators/removerServico] failed:", err);

    return { ok: false, error: "Não foi possível remover. Tente novamente." };
  }
}

// ── Onde aparece ────────────────────────────────────────────────────────────────

function validOrdem(ordem: number): boolean {
  return Number.isInteger(ordem) && ordem >= 0 && ordem <= 999;
}

export async function adicionarPaginaIndicador(input: {
  paginaId: number;
  bloco: string;
  servicoId: string;
  ordem: number;
  padrao: boolean;
}): Promise<ActionResult> {
  const denied = await guardAdmin();

  if (denied) return denied;

  if (!validOrdem(input.ordem)) return { ok: false, error: "Ordem deve ser um número entre 0 e 999." };

  try {
    const pagina = (await readPaginasCatalogo()).find((p) => p.id === input.paginaId);
    const blocos = CATALOG_PAGES.find((p) => p.rota === pagina?.rota)?.blocos ?? [];

    if (!pagina) return { ok: false, error: "Esta página não exibe indicadores do cadastro." };

    if (!blocos.some((b) => b.key === input.bloco))
      return { ok: false, error: "Bloco inválido para a página." };

    if (!(await indicadorServicoExists(input.servicoId))) return { ok: false, error: "Serviço inválido." };

    if (await paginaIndicadorExists(input.paginaId, input.bloco, input.servicoId)) {
      return { ok: false, error: "Este serviço já está nesse bloco da página." };
    }

    await createPaginaIndicador(input);
    revalidatePath("/admin/indicadores", "layout");

    return { ok: true };
  } catch (err) {
    console.error("[indicators/adicionarPagina] failed:", err);

    return { ok: false, error: "Não foi possível adicionar à tela." };
  }
}

export async function salvarPaginaIndicador(
  id: string,
  ordem: number,
  padrao: boolean,
): Promise<ActionResult> {
  const denied = await guardAdmin();

  if (denied) return denied;

  if (!validOrdem(ordem)) return { ok: false, error: "Ordem deve ser um número entre 0 e 999." };

  try {
    await updatePaginaIndicador(id, ordem, padrao);
    revalidatePath("/admin/indicadores", "layout");

    return { ok: true };
  } catch (err) {
    console.error("[indicators/salvarPagina] failed:", err);

    return { ok: false, error: "Não foi possível salvar. Tente novamente." };
  }
}

export async function removerPaginaIndicador(id: string): Promise<ActionResult> {
  const denied = await guardAdmin();

  if (denied) return denied;

  try {
    await deletePaginaIndicador(id);
    revalidatePath("/admin/indicadores", "layout");

    return { ok: true };
  } catch (err) {
    console.error("[indicators/removerPagina] failed:", err);

    return { ok: false, error: "Não foi possível remover da tela." };
  }
}
