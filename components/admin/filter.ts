/** Accent-insensitive substring match across several fields (admin list search). */
export function textMatches(query: string, ...values: (string | null | undefined)[]): boolean {
  const q = norm(query);

  if (!q) return true;

  return values.some((v) => v != null && norm(v).includes(q));
}

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
