"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/data/admin/types";
import { runPreview, type PreviewFilters, type PreviewResult } from "@/lib/data/indicators/engine";
import { readSourceColumns } from "@/lib/data/indicators/source-columns";
import { parseSpec, serializeSpec, validateSpec } from "@/lib/data/indicators/spec";
import { updateEspecificacaoCalculo } from "@/lib/data/indicators/write";

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
