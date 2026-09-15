// The justification vocabulary: the categories the form offers and the three
// verdicts a justification can carry.
//
// Kept apart from `justificativas.ts` on purpose — that module reaches the
// Databricks client through `source.ts`, and the justification modal is a client
// component. Importing the catalogue from there dragged `@databricks/sql` (and
// its `fs` import) into the browser bundle and broke the build. Nothing here may
// import anything that touches the data client.

import type { JustificativaStatus } from "./types";

/**
 * A fixed list, as in the origin, but reconciled with what the table already
 * stores: the origin offered "Atestado Médico" while every stored row spells it
 * "Atestado médico / Licença", and "Outros motivos" exists in the data without
 * ever being offered. Writing the origin's spelling would have split one
 * category into two that mean the same thing.
 */
export const CATEGORIAS = [
  "Falta de Estoque",
  "Falta de Abordagem",
  "Falta de Lead",
  "Problema Sistêmico",
  "Treinamento",
  "Ausência",
  "Férias",
  "Atestado médico / Licença",
  "Clima",
  "Preço da Concorrência",
  "Feriado",
  "Outros motivos",
] as const;

export const STATUSES: JustificativaStatus[] = ["Em Análise", "Aprovado", "Rejeitado"];

export function isStatus(value: string): value is JustificativaStatus {
  return (STATUSES as string[]).includes(value);
}

export function isCategoria(value: string): boolean {
  return (CATEGORIAS as readonly string[]).includes(value);
}
