/**
 * The capability labels the CODE gates on — the contract with the sustentação
 * team, who create the rows in /admin/capacidades (ADR 0007).
 *
 * A gate keys on `tb_permissoes.label`, so the label is an identifier, not a
 * caption: renaming one switches its gate off silently. Listing it here is what
 * makes /admin/capacidades mark the row "usada no código" and warn before a
 * rename. A label listed here but absent from the warehouse denies everyone but
 * admins.
 *
 * Page *visibility* is not in here — that is keyed by `tb_paginas.rota`, so the
 * `visualizar_*` rows can be renamed freely.
 */

export const CAP = {
  /** Justificar HC: the colaborador's own categoria + motivo. Granted to `vendedor`. */
  HC_JUSTIFICATIVA_COLABORADOR: "editar_hc_zerado_justificativa_colaborador",
  /** Justificar HC: aprovação/rejeição + observação. Granted to the four gestor níveis. */
  HC_DEVOLUTIVA_GESTOR: "editar_hc_zerado_devolutiva_gestor",
} as const satisfies Record<string, string>;

export type Capability = (typeof CAP)[keyof typeof CAP];

export const CODE_CAPS: readonly string[] = Object.values(CAP);

export function isCodeCap(label: string): boolean {
  return CODE_CAPS.includes(label.trim());
}
