// Databricks adapter for the Análise de Produtividade screen (Tela 2).
//
// Both tabs span the twelve months ending on the filtered `to`, not the filtered
// period: the period filter only moves the window's end. The origin downloaded
// those months and pivoted them in the browser; here each tab is one aggregation
// keyed by (filters, grouping).
//
// The sale filters follow the module's rule and ZERO a sale instead of dropping
// its row (see `filters.ts`) — the backend being replaced drops it, which on
// this screen left 5G and Renovação permanently blank, since neither service
// ever carries a `CRIADO` status. Recorded in docs/hc-zerado-origem-v2.md.

import { num } from "../_shared";
import { ATIVO, CIDADE, HC_KEY, SOURCE, q } from "./source";
import { monthWindow, monthWindowStart } from "./dates";
import { hcWhere, vendasExpr } from "./filters";
import type {
  HcFilters,
  HcProdutividadeView,
  HcZeradosView,
  ProdutividadeGrouping,
  ProdutividadeRow,
  ZeradosRow,
} from "./types";

/** Indicators kept per cell — the tooltip lists them, it does not audit them. */
const BREAKDOWN_LIMIT = 3;

/** The grouped-by expression, and the label to print for it. */
function dimension(grouping: ProdutividadeGrouping): { id: string; nome: string } {
  switch (grouping) {
    case "gerencia":
      return { id: `COALESCE(NULLIF(TRIM(gerente), ''), 'Sem Regional')`, nome: "id" };
    case "coordenacao":
      return { id: `COALESCE(NULLIF(TRIM(coordenacao), ''), 'Sem Regional')`, nome: "id" };
    case "cidade":
      return { id: CIDADE, nome: "id" };
    default:
      // Sellers are keyed by the source's own identity and labelled by the name
      // on their most recent day — people are renamed, re-hired and re-keyed.
      //
      // Production with no identity at all is not a person: it is a system
      // integration ("INTEGRACAO - SITE -> NOVOREVAN"), and it is ~23% of the
      // FTTH in the source. Keying it by its label keeps this tab's total equal
      // to the hierarchy tabs' instead of quietly losing it.
      return {
        id: `COALESCE(${HC_KEY}, CONCAT('SEM-HC:', NULLIF(TRIM(consultor), '')))`,
        nome: `COALESCE(NULLIF(TRIM(MAX_BY(consultor, data)), ''), 'Sem Consultor')`,
      };
  }
}

interface SubjectRow {
  id: string;
  nome: string;
  canal: string | null;
  experiencia: string | null;
  dias_exp: number | null;
  pessoas: number;
}

interface CellRow {
  m: string;
  id: string;
  servico: string;
  indicador: string;
  v: number;
}

/**
 * Aba "Produtividade Mensal": production per subject × serviço × month, plus
 * every subject present in the window — including the ones who sold nothing,
 * which is the point of an idleness screen.
 */
export async function databricksHcProdutividade(
  f: HcFilters,
  grouping: ProdutividadeGrouping,
): Promise<HcProdutividadeView> {
  const months = monthWindow(f.to);
  const from = monthWindowStart(f.to);
  const dim = dimension(grouping);
  const isSeller = grouping === "vendedor";

  const subjectParams: unknown[] = [];
  const subjectSql = `
    WITH base AS (
      SELECT * FROM ${SOURCE}
      WHERE data BETWEEN DATE'${from}' AND DATE'${f.to}'${hcWhere(f, subjectParams)}
    )
    SELECT ${dim.id} id,
           ${dim.nome === "id" ? `${dim.id}` : dim.nome} nome,
           MAX_BY(canal, data) canal,
           MAX_BY(TRIM(status_experiencia), data) experiencia,
           MAX_BY(dias_restantes_experiencia, data) dias_exp,
           COUNT(DISTINCT ${HC_KEY}) pessoas
    FROM base
    WHERE ${dim.id} IS NOT NULL
    GROUP BY ${dim.id}`;

  const cellParams: unknown[] = [];
  const cellBase = hcWhere(f, cellParams);
  const vendas = vendasExpr(f, cellParams);
  // The sale expression carries ordinal parameters, so it may appear exactly
  // once in the statement — hence the wrapper instead of a HAVING that repeats it.
  const cellSql = `
    WITH base AS (
      SELECT * FROM ${SOURCE}
      WHERE data BETWEEN DATE'${from}' AND DATE'${f.to}'${cellBase}
    )
    SELECT * FROM (
      SELECT date_format(data, 'yyyy-MM') m, ${dim.id} id, UPPER(TRIM(servico)) servico,
             COALESCE(NULLIF(TRIM(indicador), ''), 'Sem indicador') indicador,
             SUM(${vendas}) v
      FROM base
      WHERE ${dim.id} IS NOT NULL
      GROUP BY 1, 2, 3, 4
    ) WHERE v <> 0`;

  const [subjects, cells] = await Promise.all([
    q<SubjectRow>(subjectSql, subjectParams),
    q<CellRow>(cellSql, cellParams),
  ]);

  const index = new Map(months.map((m, i) => [m.month, i]));
  const rows = new Map<string, ProdutividadeRow>();

  for (const s of subjects) {
    rows.set(s.id, {
      id: s.id,
      nome: s.nome,
      detalhe: isSeller ? (s.canal ?? "") : `${num(s.pessoas)} consultores`,
      experiencia: isSeller ? (s.experiencia ?? "") : "",
      diasExperiencia: isSeller && s.dias_exp != null ? num(s.dias_exp) : null,
      total: 0,
      values: {},
      totals: {},
      breakdown: {},
    });
  }

  // Indicators are accumulated apart so a cell can be trimmed to its top few
  // only once every row has been read.
  const indicators = new Map<string, Map<string, number>>();

  for (const c of cells) {
    const row = rows.get(c.id);
    const i = index.get(c.m);

    if (!row || i === undefined) continue;

    const servico = String(c.servico ?? "").toUpperCase();
    const value = num(c.v);
    const series = (row.values[servico] ??= months.map(() => 0));

    series[i] += value;
    row.totals[servico] = (row.totals[servico] ?? 0) + value;
    row.total += value;

    const key = `${c.id}|${servico}|${i}`;
    const cell = indicators.get(key) ?? new Map<string, number>();

    cell.set(c.indicador, (cell.get(c.indicador) ?? 0) + value);
    indicators.set(key, cell);
  }

  for (const [key, cell] of indicators) {
    const cut = key.indexOf("|");
    const row = rows.get(key.slice(0, cut));

    if (!row) continue;

    row.breakdown[key.slice(cut + 1)] = [...cell.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, BREAKDOWN_LIMIT);
  }

  return { months, rows: [...rows.values()].sort(byName) };
}

function byName(a: { nome: string }, b: { nome: string }): number {
  return a.nome.localeCompare(b.nome, "pt-BR");
}

interface IdleRow {
  m: string;
  k: string;
  grupo: string | null;
  consultor: string | null;
  canal: string | null;
  experiencia: string | null;
  dias_exp: number | null;
  zeros: number;
  dias_uf: number | null;
  dias_geral: number;
}

/**
 * Aba "Média de Zerados": how many business days each subject went without
 * selling, month by month.
 *
 * A business day is any day the source carries that is not flagged a holiday —
 * Saturdays included, Sundays excluded because they are flagged. The calendar is
 * counted per UF (a state holiday shortens only that state's month) and globally,
 * and is deliberately built BEFORE the filters: narrowing to one manager must not
 * shorten the month.
 */
export async function databricksHcZerados(
  f: HcFilters,
  grouping: ProdutividadeGrouping,
): Promise<HcZeradosView> {
  const months = monthWindow(f.to);
  const from = monthWindowStart(f.to);
  const window = `data BETWEEN DATE'${from}' AND DATE'${f.to}' AND UPPER(TRIM(flag_feriado)) = 'NAO'`;
  const grupo =
    grouping === "gerencia"
      ? `COALESCE(NULLIF(TRIM(gerente), ''), 'Sem Regional')`
      : grouping === "coordenacao"
        ? `COALESCE(NULLIF(TRIM(coordenacao), ''), 'Sem Regional')`
        : grouping === "cidade"
          ? CIDADE
          : "NULL";

  const params: unknown[] = [];
  const where = hcWhere(f, params);
  const vendas = vendasExpr(f, params);
  const sql = `
    WITH cal AS (
      SELECT date_format(data, 'yyyy-MM') m, TRIM(uf_cidade_vendedor) uf, data
      FROM ${SOURCE} WHERE ${window}
    ),
    dias_uf AS (SELECT m, uf, COUNT(DISTINCT data) d FROM cal GROUP BY m, uf),
    dias_geral AS (SELECT m, COUNT(DISTINCT data) d FROM cal GROUP BY m),
    base AS (SELECT * FROM ${SOURCE} WHERE ${window}${where}),
    dia AS (
      SELECT date_format(data, 'yyyy-MM') m, data, ${HC_KEY} k,
             MAX(TRIM(uf_cidade_vendedor)) uf,
             MAX(${grupo}) grupo,
             MAX(consultor) consultor,
             MAX(canal) canal,
             MAX(TRIM(status_experiencia)) experiencia,
             MAX(dias_restantes_experiencia) dias_exp,
             SUM(${vendas}) v
      FROM base
      WHERE ${ATIVO} = 1 AND ${HC_KEY} IS NOT NULL
      GROUP BY date_format(data, 'yyyy-MM'), data, ${HC_KEY}
    ),
    pessoa AS (
      SELECT m, k,
             MAX(uf) uf, MAX(grupo) grupo, MAX(consultor) consultor, MAX(canal) canal,
             MAX(experiencia) experiencia, MAX(dias_exp) dias_exp,
             SUM(CASE WHEN v = 0 THEN 1 ELSE 0 END) zeros
      FROM dia GROUP BY m, k
    )
    SELECT p.m, p.k, p.grupo, p.consultor, p.canal, p.experiencia, p.dias_exp, p.zeros,
           u.d dias_uf, g.d dias_geral
    FROM pessoa p
    LEFT JOIN dias_uf u ON u.m = p.m AND u.uf = p.uf
    JOIN dias_geral g ON g.m = p.m`;

  const rows = await q<IdleRow>(sql, params);
  const index = new Map(months.map((m, i) => [m.month, i]));

  return {
    months,
    rows:
      grouping === "vendedor"
        ? sellerIdleness(rows, index, months.length)
        : groupIdleness(rows, index, months.length, grouping),
  };
}

/**
 * One row per seller: the count of business days they sold nothing, over their
 * own state's calendar. Months the person was absent count as zero days, not as
 * a full month — so the consolidated average only divides by the months they
 * were actually there.
 */
function sellerIdleness(rows: IdleRow[], index: Map<string, number>, span: number): ZeradosRow[] {
  interface Acc {
    row: ZeradosRow;
    zeros: number;
    dias: number;
    meses: number;
  }

  const out = new Map<string, Acc>();

  for (const r of rows) {
    const i = index.get(r.m);

    if (i === undefined) continue;

    const acc = out.get(r.k) ?? {
      row: {
        ...emptyRow(r.k, r.consultor ?? "Sem nome", r.canal ?? "", span),
        experiencia: r.experiencia ?? "",
        diasExperiencia: r.dias_exp != null ? num(r.dias_exp) : null,
      },
      zeros: 0,
      dias: 0,
      meses: 0,
    };
    const zeros = num(r.zeros);
    const dias = num(r.dias_uf) || num(r.dias_geral);

    acc.row.values[i] = zeros;
    acc.row.pcts[i] = share(zeros, dias);
    acc.zeros += zeros;
    acc.dias += dias;
    acc.meses += 1;
    out.set(r.k, acc);
  }

  return [...out.values()]
    .map(({ row, zeros, dias, meses }) => ({
      ...row,
      consolidado: meses > 0 ? round(zeros / meses) : 0,
      consolidadoPct: share(zeros, dias),
    }))
    .sort(byName);
}

/**
 * One row per group: the headcount idle on an average business day (idle
 * person-days ÷ business days). Gerência and coordenação span states, so they
 * read against the global calendar; a city sits in one state and uses its own.
 */
function groupIdleness(
  rows: IdleRow[],
  index: Map<string, number>,
  span: number,
  grouping: ProdutividadeGrouping,
): ZeradosRow[] {
  interface Acc {
    row: ZeradosRow;
    /** Idle person-days per month, before the calendar divides them. */
    idle: number[];
    /** The month's business days — one calendar for the whole group. */
    dias: number[];
    team: Set<string>;
  }

  const perUf = grouping === "cidade";
  const out = new Map<string, Acc>();

  for (const r of rows) {
    const i = index.get(r.m);
    const name = r.grupo;

    if (i === undefined || !name) continue;

    const acc = out.get(name) ?? {
      row: emptyRow(name, name, "", span),
      idle: new Array<number>(span).fill(0),
      dias: new Array<number>(span).fill(0),
      team: new Set<string>(),
    };

    acc.idle[i] += num(r.zeros);
    acc.dias[i] = perUf ? num(r.dias_uf) || num(r.dias_geral) : num(r.dias_geral);
    acc.team.add(r.k);
    out.set(name, acc);
  }

  return [...out.values()]
    .map(({ row, idle, dias, team }) => {
      const size = team.size || 1;
      let zeros = 0;
      let uteis = 0;

      for (let i = 0; i < span; i++) {
        zeros += idle[i];
        uteis += dias[i];
        row.values[i] = dias[i] > 0 ? round(idle[i] / dias[i]) : 0;
        row.pcts[i] = round(row.values[i] / size);
      }

      const consolidado = uteis > 0 ? round(zeros / uteis) : 0;

      return {
        ...row,
        detalhe: `${size} consultores`,
        consolidado,
        consolidadoPct: round(consolidado / size),
      };
    })
    .sort(byName);
}

/** Four decimals: these are read as a percentage or to one decimal place. */
function round(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

function share(part: number, whole: number): number {
  return whole > 0 ? round(part / whole) : 0;
}

function emptyRow(id: string, nome: string, detalhe: string, span: number): ZeradosRow {
  return {
    id,
    nome,
    detalhe,
    experiencia: "",
    diasExperiencia: null,
    values: new Array<number>(span).fill(0),
    pcts: new Array<number>(span).fill(0),
    consolidado: 0,
    consolidadoPct: 0,
  };
}
