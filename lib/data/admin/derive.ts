/**
 * Pure, client-safe helpers that encode the Administração form rules
 * (DESIGN_SYSTEM §5). No Databricks import — the CRUD forms use these for live
 * validation/preview and the read layer uses them to derive fields the schema
 * does not store (`locked`, chip colour).
 */

const EMAIL_DOMAIN = "timebrisa.com.br";

/** Strip diacritics and lowercase. `"José António"` → `"jose antonio"`. */
function deburr(input: string): string {
  return input.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Canonical capability `label` (DESIGN_SYSTEM §5): lowercase, no accents, every
 * non-alphanumeric run collapses to a single `_`, and no leading/trailing/
 * duplicate `_`. `"Ver todas as Gerências!"` → `"ver_todas_as_gerencias"`. Applied
 * server-side on save (the source of truth).
 */
export function normalizeCapabilityLabel(input: string): string {
  return deburr(input)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Live variant used while the user types: same rules but keeps a single trailing
 * `_` so a word separator survives until the next character is typed (stripping
 * it eagerly would swallow the space between words). The final value is canonicalized
 * server-side by `normalizeCapabilityLabel`.
 */
export function normalizeCapabilityLabelInput(input: string): string {
  return deburr(input)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_/, "");
}

/**
 * Derive the corporate email from a full name (DESIGN_SYSTEM §5): first token +
 * last token, `nome.sobrenome@timebrisa.com.br`. Shown as read-only confirmation
 * under the name field — it is never an editable field. Returns "" for an empty
 * name so the form can gate on it.
 */
export function deriveEmail(nome: string): string {
  const parts = deburr(nome)
    .split(/\s+/)
    .map((p) => p.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);

  if (parts.length === 0) return "";

  const first = parts[0];
  const last = parts.length > 1 ? parts[parts.length - 1] : "";

  return `${last ? `${first}.${last}` : first}@${EMAIL_DOMAIN}`;
}

/**
 * A nível is `locked` when it is a seeded default that must not be edited or
 * deleted (shows a "Padrão" badge instead of actions). There is no `locked`
 * column on `tb_niveis`; it is derived from the name — the `admin` and `vendedor`
 * levels are locked (ADR 0005 — `admin` is the seeded level). Cargos, by contrast,
 * carry a real `padrao` column and derive `locked` from it in the read layer.
 */
export function isLockedNivel(nome: string): boolean {
  const n = deburr(nome).trim();

  return n === "admin" || n === "vendedor";
}

/**
 * The `admin` level alone is FULLY locked in the permission matrix: it holds every
 * capability and cannot be toggled. `vendedor` is record-locked (no rename/delete)
 * but its capabilities ARE editable — so the matrix uses this, not `isLockedNivel`.
 */
export function isAdminNivel(nome: string): boolean {
  return deburr(nome).trim() === "admin";
}

export function isLockedCargo(nome: string): boolean {
  const n = deburr(nome).trim();

  return n === "administrador" || n === "admin";
}

export interface ChipTone {
  fg: string;
  bg: string;
}

/** Salmon (brand) — the uniform tone for a nível chip in the Usuários table (design §5). */
export const BRAND_TONE: ChipTone = { fg: "var(--s-brand)", bg: "var(--s-brand-weak)" };
/** Blue — marks a "padrão" (locked) nível on the Níveis screen (SCREENS §6). */
export const BLUE_TONE: ChipTone = { fg: "var(--s-blue)", bg: "var(--s-blue-bg)" };
const NEUTRAL_TONE: ChipTone = { fg: "var(--s-t2)", bg: "var(--s-sunken)" };

/**
 * Chip tone for an access level. The design uses a single salmon chip for every
 * nível (there is no per-level colour column); the "padrão" blue variant is
 * applied per-screen where the spec calls for it, not here.
 */
export function nivelChipTone(): ChipTone {
  return BRAND_TONE;
}

/** Status chip tone: Ativo → ok, Inativo → neutral. */
export function statusChipTone(ativo: boolean): ChipTone {
  return ativo ? { fg: "var(--s-ok)", bg: "var(--s-ok-bg)" } : NEUTRAL_TONE;
}
