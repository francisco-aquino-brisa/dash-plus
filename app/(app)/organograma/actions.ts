"use server";

import { getSession } from "@/lib/auth/session";
import { searchHierarquiaPessoas, type HierarquiaPessoa } from "@/lib/data/admin/hierarquia";
import { getOrgChartForCpf } from "@/lib/data/organograma/repository";
import type { OrgChartResult } from "@/lib/data/organograma/types";

/**
 * "Ver como outra pessoa" — admin-only, so a regular user can never browse
 * someone else's tree. Same guard shape as `searchUsuarioPessoas`
 * (app/(app)/admin/actions.ts): returns an empty/null result rather than
 * throwing, so the client control just shows nothing for a non-admin.
 */
export async function searchOrgPessoas(query: string): Promise<HierarquiaPessoa[]> {
  const session = await getSession();

  if (!session?.isAdmin) return [];

  return searchHierarquiaPessoas(query ?? "");
}

export async function loadOrgChartForCpf(cpf: string): Promise<OrgChartResult | null> {
  const session = await getSession();

  if (!session?.isAdmin) return null;

  return getOrgChartForCpf(cpf);
}
