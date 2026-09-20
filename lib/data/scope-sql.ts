/**
 * Data scope — the pure half: types, prefix algebra and SQL fragments.
 *
 * A user sees the people under the node(s) they manage in the RH hierarchy.
 * `vw_hierarquia_rh.id_estrutura` is a materialized path (`1.9.22.2929.255`),
 * so "everything under a node" is a prefix test rather than a recursive CTE,
 * and `vw_hierarquia.idestruturahierarquia` places each person on that same
 * path — deeper than the deepest node, which is why sellers are covered even
 * though the tree stops at `lideranca`.
 *
 * Resolution (the IO half) lives in `lib/auth/scope.ts`. Keeping the fragments
 * here means they can be read and reasoned about without a warehouse round-trip.
 */

const CAT = process.env.DATABRICKS_CITIES_CATALOG ?? "gdb_brisanet_comunidade_dev";
const SCHEMA = process.env.DATABRICKS_CITIES_SCHEMA ?? "projeto_brisa_performance";

/** People → position. Current state only; the view is overwritten every load. */
export const HIERARQUIA = `\`${CAT}\`.\`${SCHEMA}\`.\`vw_hierarquia\``;
/** The structure tree. We only ever read its latest `data_carga`. */
export const HIERARQUIA_RH = `\`${CAT}\`.\`${SCHEMA}\`.\`vw_hierarquia_rh\``;

export interface ScopeFilter {
  /** Unrestricted — emit no predicate at all. */
  all: boolean;
  /** `id_estrutura` prefixes, already collapsed (no redundant descendant). */
  paths: string[];
  /** CPFs whose point of view the user takes; the fallback when no node resolves. */
  cpfs: string[];
}

export const UNRESTRICTED_SCOPE: ScopeFilter = { all: true, paths: [], cpfs: [] };
/** Resolves to nothing at all — the safe failure mode (a user with no CPF). */
export const EMPTY_SCOPE: ScopeFilter = { all: false, paths: [], cpfs: [] };

/** Digits only, so a CPF typed as `066.212.443-24` still matches the warehouse's. */
export function cpfDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/**
 * Drop paths already covered by an ancestor: `['1.9.22', '1.9.22.2929']` →
 * `['1.9.22']`. A manager answering for several nodes usually answers for a
 * parent and some of its children, and the redundant branches would only widen
 * the SQL.
 */
export function collapsePrefixes(paths: string[]): string[] {
  const unique = [...new Set(paths.filter(Boolean))].sort();

  return unique.filter((p, i) => !unique.slice(0, i).some((a) => p === a || p.startsWith(`${a}.`)));
}

export interface ScopeSql {
  /** Appended to an existing WHERE (may be empty). Always starts with ` AND`. */
  where: string;
  /** Ordinal params for `where`, in order. */
  params: unknown[];
}

const NO_SCOPE_SQL: ScopeSql = { where: "", params: [] };

/** Which column of `vw_hierarquia` the fact's person column matches. */
export type ScopeKey = "hash_cpf" | "matricula" | "cpf";

/**
 * The hierarchy with every column renamed `sh_*`.
 *
 * This aliasing is load-bearing, not cosmetic. The predicate below is a
 * correlated subquery, and an unqualified fact column inside it resolves
 * against the INNER scope first — case-insensitively. So `desempenho_hc.CPF`
 * matched against a bare `vw_hierarquia` bound to the view's own `cpf` and the
 * predicate became `cpf = cpf`: true for every row, scope silently gone, no
 * error. Fail-open, in the one place that must never fail open.
 *
 * With `sh_`-prefixed names there is nothing in the inner scope for a fact
 * column to collide with, whatever the caller passes and whether or not they
 * remembered to qualify it with an alias.
 */
const HIER_ALIASED = `(SELECT hash_cpf AS sh_hash_cpf,
                 cpf_digits AS sh_cpf,
                 CAST(matricula AS STRING) AS sh_matricula,
                 idestruturahierarquia AS sh_path
            FROM ${HIERARQUIA}) sh`;

function keyMatch(key: ScopeKey, factKey: string): string {
  if (key === "matricula") return `sh.sh_matricula = CAST(${factKey} AS STRING)`;

  // A hierarquia já entrega `cpf_digits` normalizado (desde 20/09/2026); o lado
  // do fato continua normalizado aqui, porque cada fonte guarda o CPF do seu
  // jeito — umas com pontuação, outras sem.
  if (key === "cpf") return `sh.sh_cpf = regexp_replace(${factKey}, '[^0-9]', '')`;

  return `sh.sh_hash_cpf = ${factKey}`;
}

/**
 * Narrow a fact query to the user's scope.
 *
 * The facts carry the person (`hash_user`, `matricula`), never the structure, so
 * the predicate is a semi-join against the current hierarchy — never an `IN`
 * list, which for a gerência executiva would carry 1.564 CPFs.
 *
 * `EXISTS` rather than a `JOIN` on purpose: `vw_hierarquia` is one row per
 * person today, but the day it stops being 1:1 a join would multiply the fact
 * rows and silently inflate every SUM on the screen. `EXISTS` cannot, whatever
 * the view's grain becomes — and it needs no FROM-clause surgery, so it drops
 * into an existing WHERE the same way every other filter does.
 */
export function scopePredicate(scope: ScopeFilter, factKey: string, key: ScopeKey = "hash_cpf"): ScopeSql {
  if (scope.all) return NO_SCOPE_SQL;

  const exists = (cond: string) =>
    ` AND EXISTS (SELECT 1 FROM ${HIER_ALIASED} WHERE ${keyMatch(key, factKey)} AND ${cond})`;

  // Not a manager: the scope is the person themselves. With no CPF either there
  // is nobody to scope to, so the query must return nothing rather than
  // everything — `IN ()` is not valid SQL, hence the explicit false.
  if (scope.paths.length === 0) {
    if (scope.cpfs.length === 0) return { where: " AND 1 = 0", params: [] };

    const marks = scope.cpfs.map(() => "?").join(", ");

    return { where: exists(`sh.sh_cpf IN (${marks})`), params: [...scope.cpfs] };
  }

  const cond = "(sh.sh_path = ? OR sh.sh_path LIKE ?)";

  return {
    where: exists(`(${scope.paths.map(() => cond).join(" OR ")})`),
    params: scope.paths.flatMap((p) => [p, `${p}.%`]),
  };
}

/**
 * How a fact table identifies the person — everything a source needs to declare
 * to become scopable.
 *
 * `"none"` is not an oversight, it is a statement: this source carries no
 * person at all (a city cube, a channel target), so no per-person predicate can
 * narrow it. Every source has to say which it is, because the failure mode of
 * forgetting is showing the whole company.
 */
export type ScopeAnchor = { column: string; on?: ScopeKey } | "none";

/**
 * The predicate for a declared anchor. A source with no person anchor cannot be
 * narrowed, so it resolves to `1 = 0` for a restricted reader rather than to the
 * whole table: a number the reader is not entitled to is worse than a missing
 * one, especially next to a scoped one it would be compared against.
 */
export function anchorPredicate(scope: ScopeFilter, anchor: ScopeAnchor): ScopeSql {
  if (scope.all) return NO_SCOPE_SQL;

  if (anchor === "none") return { where: " AND 1 = 0", params: [] };

  return scopePredicate(scope, anchor.column, anchor.on ?? "hash_cpf");
}

/**
 * Cache-key fragment. Two users with different scopes must never share a cached
 * aggregation, so every key that covers scoped data carries this.
 */
export function scopeToken(scope: ScopeFilter): string {
  if (scope.all) return "all";

  if (scope.paths.length) return `p:${scope.paths.join("+")}`;

  if (scope.cpfs.length) return `c:${scope.cpfs.join("+")}`;

  return "none";
}
