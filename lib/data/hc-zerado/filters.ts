// Filter parsing and SQL predicates for the HC Zerado module.
//
// The original `filterEngine.getFilteredData()` did two different things to a
// row, and the distinction is the heart of the module:
//
//   - hierarchy/demographic filters DROP the row (the person is out of scope);
//   - sale filters (serviço, indicador, status da venda, agilidade) KEEP the row
//     but ZERO its `total_vendas`, so the headcount still counts and the person
//     simply reads as having sold nothing.
//
// That is why "zerado" is always relative to the sale filters in force. Here the
// first kind becomes a WHERE clause and the second a CASE inside the SUM.

import { safeIsoDate } from "../_shared";
import { EMPTY_SCOPE, scopePredicate } from "../scope-sql";
import { clampRange, defaultHcRange } from "./dates";
import type { Agilidade, Experiencia, HcFilters, PerfilCidade, StatusVenda } from "./types";

type SearchParams = Record<string, string | string[] | undefined>;

const STATUS: StatusVenda[] = ["CRIADO", "EFETIVADO", "INSTALADO"];
const PERFIS: PerfilCidade[] = ["FTTH", "HIBRIDA", "ONLY"];
const EXPERIENCIAS: Experiencia[] = ["Em Exp.", "Efetivo"];

function one(sp: SearchParams, key: string): string {
  const v = sp[key];

  return typeof v === "string" ? v.trim() : "";
}

/** Multi-selects travel as a comma-separated list, capped to keep SQL bounded. */
function many(sp: SearchParams, key: string): string[] {
  return one(sp, key)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 200);
}

export function parseHcFilters(sp: SearchParams): HcFilters {
  const def = defaultHcRange();
  const range = clampRange(safeIsoDate(one(sp, "de")) ?? def.from, safeIsoDate(one(sp, "ate")) ?? def.to);
  const status = one(sp, "status").toUpperCase() as StatusVenda;
  const agilidade = one(sp, "agilidade") as Agilidade;
  const perfil = one(sp, "perfil") as PerfilCidade;
  const experiencia = one(sp, "exp") as Experiencia;

  return {
    from: range.from,
    to: range.to,
    gerente: many(sp, "gerente"),
    coordenacao: many(sp, "coordenacao"),
    supervisao: many(sp, "supervisao"),
    lider: many(sp, "lider"),
    cidade: many(sp, "cidade"),
    consultor: many(sp, "consultor"),
    canal: many(sp, "canal"),
    nicho: many(sp, "nicho"),
    servico: many(sp, "servico"),
    indicador: many(sp, "indicador"),
    experiencia: EXPERIENCIAS.includes(experiencia) ? experiencia : "",
    statusVenda: STATUS.includes(status) ? status : "CRIADO",
    agilidade: agilidade === "efetivado" || agilidade === "instalado" ? agilidade : "",
    perfilCidade: PERFIS.includes(perfil) ? perfil : "",
    cross: {
      vendedor: one(sp, "cf_vendedor"),
      gerencia: one(sp, "cf_gerencia"),
      coordenacao: one(sp, "cf_coordenacao"),
      canal: one(sp, "cf_canal"),
      cidade: one(sp, "cf_cidade"),
      servico: one(sp, "cf_servico"),
    },
    scope: EMPTY_SCOPE,
  };
}

/** Turn a filter set back into a querystring (the client rebuilds links with it). */
export function hcFiltersToQuery(f: HcFilters): string {
  const q = new URLSearchParams();

  const put = (k: string, v: string) => {
    if (v) q.set(k, v);
  };

  put("de", f.from);
  put("ate", f.to);
  put("gerente", f.gerente.join(","));
  put("coordenacao", f.coordenacao.join(","));
  put("supervisao", f.supervisao.join(","));
  put("lider", f.lider.join(","));
  put("cidade", f.cidade.join(","));
  put("consultor", f.consultor.join(","));
  put("canal", f.canal.join(","));
  put("nicho", f.nicho.join(","));
  put("servico", f.servico.join(","));
  put("indicador", f.indicador.join(","));
  put("exp", f.experiencia);
  put("status", f.statusVenda);
  put("agilidade", f.agilidade);
  put("perfil", f.perfilCidade);
  put("cf_vendedor", f.cross.vendedor);
  put("cf_gerencia", f.cross.gerencia);
  put("cf_coordenacao", f.cross.coordenacao);
  put("cf_canal", f.cross.canal);
  put("cf_cidade", f.cross.cidade);
  put("cf_servico", f.cross.servico);

  return q.toString();
}

/**
 * The querystring keys `hcFiltersToQuery` owns. Everything else in the URL
 * belongs to the screen — which matrix, which tab — and has to survive a filter
 * change, so the filter panel re-appends it. Keep in sync with the `put` calls
 * above; `hcFiltersToQuery` is the only writer of these keys.
 */
export const HC_FILTER_PARAMS: ReadonlySet<string> = new Set([
  "de",
  "ate",
  "gerente",
  "coordenacao",
  "supervisao",
  "lider",
  "cidade",
  "consultor",
  "canal",
  "nicho",
  "servico",
  "indicador",
  "exp",
  "status",
  "agilidade",
  "perfil",
  "cf_vendedor",
  "cf_gerencia",
  "cf_coordenacao",
  "cf_canal",
  "cf_cidade",
  "cf_servico",
]);

/**
 * Carry the screen's own querystring into a URL rebuilt from the filters.
 * Without it, touching a filter or clicking a card resets which matrix and
 * which tab the user was looking at, because the filter set does not know
 * those params exist.
 */
export function keepScreenParams(q: URLSearchParams, current: URLSearchParams): URLSearchParams {
  for (const [key, value] of current) if (!HC_FILTER_PARAMS.has(key)) q.set(key, value);

  return q;
}

/**
 * `isStatusLockIgnored` in the original: when every selected service is one the
 * sale-status column does not describe (5G / Renovação), the status filter is
 * bypassed instead of zeroing every 5G sale.
 */
export function statusLockIgnored(servicos: string[]): boolean {
  if (servicos.length === 0) return false;

  return servicos.every((s) => s === "5G" || s === "RENOVAÇÃO" || s === "RENOVACAO");
}

function inList(column: string, values: string[], params: unknown[]): string {
  params.push(...values);

  return `${column} IN (${values.map(() => "?").join(",")})`;
}

/**
 * Row-level predicates — the filters that take a person out of scope entirely.
 * `skipCross` lets the regional table opt out of its own group cross-filters,
 * exactly as the original did, so clicking a row does not empty the table.
 */
export function hcWhere(
  f: HcFilters,
  params: unknown[],
  skipCross: Array<keyof HcFilters["cross"]> = [],
): string {
  const cl: string[] = [];
  const scope = scopePredicate(f.scope, "hash_user");
  const multiFilter: Array<[string, string[]]> = [
    ["gerente", f.gerente],
    ["coordenacao", f.coordenacao],
    ["supervisao", f.supervisao],
    ["lider", f.lider],
    ["cidade_vendedor", f.cidade],
    ["consultor", f.consultor],
    ["canal", f.canal],
    ["nicho", f.nicho],
  ];

  for (const [col, values] of multiFilter) {
    if (values.length) cl.push(inList(col, values, params));
  }

  if (f.perfilCidade) {
    cl.push("tipo_cidade = ?");
    params.push(f.perfilCidade);
  }

  // The original compared the uppercased column against "EXPERIENCIA", which no
  // row ever equals — the source stores "Em Exp." / "Efetivo", so that option
  // silently returned nothing. Compared against the real values here.
  if (f.experiencia) {
    cl.push("TRIM(status_experiencia) = ?");
    params.push(f.experiencia);
  }

  const cross: Array<[keyof HcFilters["cross"], string, string]> = [
    ["vendedor", "CAST(matricula AS STRING)", f.cross.vendedor],
    ["gerencia", "gerente", f.cross.gerencia],
    ["coordenacao", "coordenacao", f.cross.coordenacao],
    ["canal", "canal", f.cross.canal],
    ["cidade", "cidade_vendedor", f.cross.cidade],
  ];

  for (const [key, col, value] of cross) {
    if (value && !skipCross.includes(key)) {
      cl.push(`${col} = ?`);
      params.push(value);
    }
  }

  params.push(...scope.params);

  return (cl.length ? ` AND ${cl.join(" AND ")}` : "") + scope.where;
}

/**
 * The sale-side filters as a WHERE, dropping the row instead of zeroing it —
 * NOT the screen's rule (see the note at the top). `pduMes` only, because the
 * backend it has to agree with applies them as plain `AND col IN (...)`.
 */
export function vendasWhere(f: HcFilters, params: unknown[]): string {
  const cl: string[] = [];

  if (f.servico.length) cl.push(inList("servico", f.servico, params));

  if (f.indicador.length) cl.push(inList("indicador", f.indicador, params));

  // No 5G/Renovação escape here: that backend drops those sales too, which is
  // why the monthly PDU reads far lower than the daily one.
  cl.push("UPPER(status_venda) = ?");
  params.push(f.statusVenda);

  if (f.agilidade === "efetivado") cl.push("UPPER(TRIM(efetivado_mesmo_dia)) = 'SIM'");

  if (f.agilidade === "instalado") cl.push("UPPER(TRIM(instalado_mesmo_dia)) = 'SIM'");

  return ` AND ${cl.join(" AND ")}`;
}

/**
 * The sale-side filters, as a CASE that zeroes `total_vendas` instead of
 * dropping the row — see the note at the top of this file.
 */
export function vendasExpr(f: HcFilters, params: unknown[]): string {
  // Clicking a Totalizadores card does NOT narrow production: the original
  // zeroes against `filters.servico` alone, so the cross-filter only decides
  // whether the status lock applies (below) and which card is highlighted.
  const servicos = f.cross.servico ? [f.cross.servico] : f.servico;
  const cl: string[] = [];

  if (f.servico.length) cl.push(inList("servico", f.servico, params));

  if (f.indicador.length) cl.push(inList("indicador", f.indicador, params));

  // The sale status only describes the wired services; 5G and Renovação carry
  // their own status vocabulary and are left alone.
  if (!statusLockIgnored(servicos)) {
    cl.push("(servico NOT IN ('INTERNET','FWA') OR UPPER(status_venda) = ?)");
    params.push(f.statusVenda);
  }

  if (f.agilidade === "efetivado") cl.push("efetivado_mesmo_dia = 'SIM'");

  if (f.agilidade === "instalado") cl.push("instalado_mesmo_dia = 'SIM'");

  if (!cl.length) return "total_vendas";

  return `CASE WHEN ${cl.join(" AND ")} THEN total_vendas ELSE 0 END`;
}
