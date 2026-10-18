function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function categoriaKey(label: string): string {
  return label.trim().toLowerCase();
}

export function categoriaPrefix(categoria: string): string {
  return stripAccents(categoria)
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Numbering runs over every id sharing the prefix, not only the category's own:
 * two categories can share a prefix ("Base" / "Bairro"), and per-category counting
 * would hand out an id that already exists.
 */
export function nextIndicadorGeralId(categoria: string, existingIds: string[]): string {
  const prefix = categoriaPrefix(categoria);

  if (prefix.length < 2) return "";

  const pattern = new RegExp(`^${prefix}(\\d+)$`, "i");
  let max = 0;

  for (const id of existingIds) {
    const m = pattern.exec(id.trim());

    if (m) max = Math.max(max, Number(m[1]));
  }

  return `${prefix}${String(max + 1).padStart(2, "0")}`;
}

export function servicoCode(idIndicadorGeral: string, servico: string): string {
  const s = servico.replace(/\s+/g, "");

  return idIndicadorGeral && s ? `${idIndicadorGeral}${s}` : "";
}

export function servicoNome(indicadorGeral: string, servico: string): string {
  const g = indicadorGeral.trim();
  const s = servico.trim();

  return g && s ? `${g} - ${s}` : g || s;
}

export const SERVICOS_PADRAO = ["FTTH", "FWA", "5G", "Mix", "Banda Larga"];
