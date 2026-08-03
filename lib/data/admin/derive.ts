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
 * A record is `locked` when it is the seeded default: the `admin` level and the
 * `Administrador` cargo (ADR 0005 — `nome='admin'` is the seeded level). Locked
 * records show a "Padrão" badge instead of edit/delete actions and cannot be
 * removed. There is no `locked` column; it is derived from the name.
 */
export function isLockedNivel(nome: string): boolean {
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

const NEUTRAL: ChipTone = { fg: "var(--s-t2)", bg: "var(--s-sunken)" };
const BRAND: ChipTone = { fg: "var(--s-brand)", bg: "var(--s-brand-weak)" };
const PALETTE: ChipTone[] = [
  { fg: "var(--s-blue)", bg: "var(--s-blue-bg)" },
  { fg: "var(--s-ok)", bg: "var(--s-ok-bg)" },
  { fg: "var(--s-warn)", bg: "var(--s-warn-bg)" },
  NEUTRAL,
];

/**
 * Stable chip tone for an access level. There is no colour column, so the
 * prototype's per-level colour is derived: `admin` pins to brand (orange); every
 * other level hashes deterministically into a small palette so a given name
 * always keeps the same colour across renders.
 */
export function nivelChipTone(nome: string): ChipTone {
  if (isLockedNivel(nome)) return BRAND;

  let hash = 0;

  for (const ch of deburr(nome)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;

  return PALETTE[hash % PALETTE.length];
}

/** Status chip tone: Ativo → ok, Inativo → neutral. */
export function statusChipTone(ativo: boolean): ChipTone {
  return ativo ? { fg: "var(--s-ok)", bg: "var(--s-ok-bg)" } : NEUTRAL;
}
