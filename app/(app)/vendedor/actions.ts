"use server";

import { getSession } from "@/lib/auth/session";
import { searchVendedores as repoSearchVendedores } from "@/lib/data/vendedor/repository";
import type { VendedorOption } from "@/lib/data/vendedor/types";

/**
 * Server-side vendedor search for the picker (max 100), scoped to a competência.
 * Any authenticated user may search; returns [] when there is no session.
 */
export async function searchVendedores(query: string, competencia: string): Promise<VendedorOption[]> {
  const session = await getSession();

  if (!session) return [];

  return repoSearchVendedores(competencia, query ?? "");
}
