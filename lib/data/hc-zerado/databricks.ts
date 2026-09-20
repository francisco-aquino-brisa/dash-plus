// Databricks adapter for the Desempenho HC screen. Read-only, aggregated in
// SQL over the shared source declared in `source.ts`.
//
// Period dates are laundered through `safeIsoDate` before being inlined as
// DATE literals; every dimension value is bound as an ordinal `?` parameter.
// Ordinal parameters are POSITIONAL: params must be pushed in the same order
// their `?` appears in the SQL text, which is why the row filter (inside the
// `base` CTE) is always built before the sale expression (used further down).

import { num } from "../_shared";
import { CIDADE, FERIADO, MONTHS, SOURCE, ATIVO, q } from "./source";
import { scopePredicate, type ScopeFilter } from "../scope-sql";
import { hcWhere, vendasExpr, vendasWhere } from "./filters";
import {
  applyGroupCross,
  baseCte,
  fetchPersonDay,
  regional,
  zeradoByDay,
  type PersonDay,
} from "./person-day";
import { dateRangeList, isWeekend, dayLabel, previousDay } from "./dates";
import type {
  DayAxis,
  HcDesempenhoView,
  HcFilters,
  HcFilterTuple,
  MatrizRow,
  PduDay,
  PduMonth,
  QuadroGeral,
  Totalizadores,
  VendedorRow,
} from "./types";

/** One row per service × day × group — production, for the matrix and totals. */
interface ServicoDay {
  d: string;
  nome: string;
  detalhe: string;
  servico: string;
  indicador: string;
  v: number;
}

async function fetchServicoDay(f: HcFilters, view: MatrizView): Promise<ServicoDay[]> {
  const dim =
    view === "gerencia"
      ? "COALESCE(NULLIF(TRIM(gerente), ''), 'Sem Regional')"
      : view === "coordenacao"
        ? "COALESCE(NULLIF(TRIM(coordenacao), ''), 'Sem Regional')"
        : view === "cidade"
          ? CIDADE
          : "COALESCE(NULLIF(TRIM(consultor), ''), 'Sem Consultor')";
  const detalhe = view === "consultor" ? "MAX(canal)" : "MAX(cidade_vendedor)";
  const params: unknown[] = [];
  const base = baseCte(f, params);
  const vendas = vendasExpr(f, params);
  // The sale expression carries ordinal parameters, so it may appear exactly
  // once in the statement — hence the wrapper instead of a HAVING that repeats it.
  const sql = `
    WITH ${base}
    SELECT * FROM (
      SELECT CAST(data AS STRING) d, ${dim} nome, servico,
             COALESCE(NULLIF(TRIM(indicador), ''), 'Sem indicador') indicador,
             ${detalhe} detalhe, SUM(${vendas}) v
      FROM base GROUP BY data, ${dim}, servico, COALESCE(NULLIF(TRIM(indicador), ''), 'Sem indicador')
    ) WHERE v <> 0`;

  const rows = await q<ServicoDay>(sql, params);

  return rows.map((r) => ({ ...r, v: num(r.v) }));
}

/**
 * Normalize `situacao` into the buckets the original showed. The source stores
 * the same state under accented and unaccented spellings (`FERIAS`/`FÉRIAS`,
 * `AF.PREVIDENCIA`/`AF.PREVIDÊNCIA`), which rendered as duplicated tiles each
 * holding half the count — folding them here is the agreed fix.
 */
function situacaoCategory(raw: string | null): string {
  const s = (raw ?? "").trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  // The source leaves `situacao` empty for the indirect channels, which are not
  // payroll headcount. The original bucketed them as "Outros"; kept as-is.
  if (!s) return "Outros";

  if (["ATIVO", "ATIVOS", "ACTIVE"].includes(s)) return "Ativos";

  if (s === "FERIAS") return "Férias";

  if (s.includes("MATERNIDADE") || s.includes("MATER.")) return "Maternidade";

  if (s === "INSS" || s.includes("PREVIDENCIA")) return "INSS";

  return s.charAt(0) + s.slice(1).toLowerCase();
}

/** Bloco 1 — headcount composition on the last day present in the range. */
function quadroGeral(rows: PersonDay[], refDate: string | null): QuadroGeral {
  if (!refDate) return { total: 0, refDate: null, items: [] };

  const byCategory = new Map<string, Set<string>>();
  const allKeys = new Set<string>();

  for (const r of rows) {
    if (r.d !== refDate || !r.k) continue;

    const cat = situacaoCategory(r.situacao);
    const set = byCategory.get(cat) ?? new Set<string>();

    set.add(r.k);
    byCategory.set(cat, set);
    allKeys.add(r.k);
  }

  const total = allKeys.size;
  const preferred = ["Ativos", "Férias", "Maternidade", "INSS"];
  const others = [...byCategory.keys()].filter((c) => !preferred.includes(c)).sort();

  return {
    total,
    refDate,
    items: [...preferred, ...others]
      .map((label) => {
        const count = byCategory.get(label)?.size ?? 0;

        return {
          id: label.toLowerCase().replace(/\s+/g, "-"),
          label,
          count,
          pct: total > 0 ? Math.round((count / total) * 100) : 0,
        };
      })
      .filter((i) => i.count > 0),
  };
}

/** Bloco 2 — production totals for the period, by service. */
function totalizadores(rows: ServicoDay[]): Totalizadores {
  let ftth = 0;
  let fwa = 0;
  let chips5g = 0;
  let renovacoes: number | null = null;

  for (const r of rows) {
    const s = String(r.servico ?? "").toUpperCase();

    if (s === "INTERNET") ftth += r.v;
    else if (s === "FWA") fwa += r.v;
    else if (s === "5G") chips5g += r.v;
    else if (s === "RENOVAÇÃO" || s === "RENOVACAO") renovacoes = (renovacoes ?? 0) + r.v;
  }

  // `renovacoes` stays null when the source carries no such service — the card
  // then reads "sem dado na fonte" instead of a zero someone would take for
  // "nobody renewed".
  return { ftth, fwa, chips5g, renovacoes };
}

/**
 * Bloco 5 — one row per seller.
 *
 * A "working day" is a day present in the data that is not flagged as a holiday
 * (the source flags Sundays as holidays too). A seller with no row on such a day
 * still counts as zeroed for it — that is the original's rule, and the reason
 * absence reads as idleness.
 */
function vendedores(
  rows: PersonDay[],
  diasUteis: string[],
  refDate: string,
  diasUteisMes: number,
): VendedorRow[] {
  const people = new Map<string, { first: PersonDay; days: Map<string, number> }>();

  for (const r of rows) {
    if (!r.matricula) continue;

    const cur = people.get(r.matricula) ?? { first: r, days: new Map<string, number>() };

    cur.days.set(r.d, (cur.days.get(r.d) ?? 0) + r.v);

    // Identity and status come from the person's FIRST day in the range, so
    // someone active on day 1 who went on leave later still shows as active.
    if (r.d < cur.first.d) cur.first = r;

    people.set(r.matricula, cur);
  }

  const out: VendedorRow[] = [];

  for (const [matricula, p] of people) {
    if (p.first.ativo !== 1) continue;

    let diasComVenda = 0;
    let diasSemVenda = 0;
    let totalVendas = 0;

    for (const day of diasUteis) {
      const v = p.days.get(day) ?? 0;

      totalVendas += v;

      if (v > 0) diasComVenda += 1;
      else diasSemVenda += 1;
    }

    const evaluated = diasComVenda + diasSemVenda;

    out.push({
      matricula,
      consultor: p.first.consultor ?? "",
      canal: p.first.canal ?? "",
      cidade: p.first.cidade ?? "",
      gerente: p.first.gerente ?? "",
      coordenacao: p.first.coordenacao ?? "",
      situacao: p.first.situacao ?? "",
      ativo: true,
      totalVendas,
      diasComVenda,
      diasSemVenda,
      aproveitamento: evaluated > 0 ? Math.round((diasComVenda / evaluated) * 100) : 0,
      // Pace × the month's full working days. The original multiplied by a
      // hard-coded 22 ("month of June 2026"); the real count now comes from the
      // source's own holiday flag.
      projecao: evaluated > 0 ? Math.round((totalVendas / evaluated) * diasUteisMes) : 0,
      vendasByDay: diasUteis.map((d) => p.days.get(d) ?? 0),
      zeradoToday: (p.days.get(refDate) ?? 0) === 0,
      firstDay: p.first.d,
    });
  }

  // First appearance, then matrícula — ordering by idle days ties everyone on
  // a short period and buries whoever actually sold.
  return out.sort((a, b) => a.firstDay.localeCompare(b.firstDay) || a.matricula.localeCompare(b.matricula));
}

/** Bloco 6 — daily production matrix for the selected grouping. */
function matriz(rows: ServicoDay[], days: DayAxis[], order: Map<string, string>): MatrizRow[] {
  const index = new Map(days.map((d, i) => [d.data, i]));
  const acc = new Map<string, MatrizRow>();
  // The name column prints the subject's whole production, not the row's.
  const totalByName = new Map<string, number>();
  const breakdowns = new Map<string, Map<number, Map<string, number>>>();

  for (const r of rows) {
    const servico = String(r.servico ?? "").toUpperCase();
    const key = `${r.nome}||${servico}`;
    const row =
      acc.get(key) ??
      ({
        id: key,
        nome: r.nome,
        detalhe: r.detalhe ?? "",
        servico,
        values: days.map(() => 0),
        total: 0,
        subjectTotal: 0,
        breakdown: {},
      } satisfies MatrizRow);
    const i = index.get(r.d);

    if (i !== undefined) {
      row.values[i] += r.v;

      const byDay = breakdowns.get(key) ?? new Map<number, Map<string, number>>();
      const byIndicador = byDay.get(i) ?? new Map<string, number>();

      byIndicador.set(r.indicador, (byIndicador.get(r.indicador) ?? 0) + r.v);
      byDay.set(i, byIndicador);
      breakdowns.set(key, byDay);
    }

    row.total += r.v;
    totalByName.set(r.nome, (totalByName.get(r.nome) ?? 0) + r.v);
    acc.set(key, row);
  }

  for (const [key, row] of acc) {
    row.subjectTotal = totalByName.get(row.nome) ?? 0;

    for (const [i, byIndicador] of breakdowns.get(key) ?? []) {
      row.breakdown[String(i)] = [...byIndicador.entries()]
        .map(([indicador, value]) => ({ indicador, value }))
        .sort((a, b) => b.value - a.value);
    }
  }

  // Same key as Bloco 5, so both blocks list people in the same sequence.
  return [...acc.values()].sort(
    (a, b) =>
      (order.get(a.nome) ?? "9999").localeCompare(order.get(b.nome) ?? "9999") ||
      a.nome.localeCompare(b.nome) ||
      SERVICO_ORDER.indexOf(a.servico) - SERVICO_ORDER.indexOf(b.servico),
  );
}

const SERVICO_ORDER = ["INTERNET", "FWA", "5G", "RENOVACAO"];

/** First day each matrix subject appears — the ordering key. */
function subjectOrder(rows: PersonDay[], view: MatrizView): Map<string, string> {
  const key = (r: PersonDay) =>
    view === "gerencia"
      ? r.gerente
      : view === "coordenacao"
        ? r.coordenacao
        : view === "cidade"
          ? r.cidade
          : r.consultor;
  const out = new Map<string, string>();

  for (const r of rows) {
    const k = key(r);

    if (!k) continue;

    const current = out.get(k);

    if (current === undefined || r.d < current) out.set(k, r.d);
  }

  return out;
}

/** Bloco 7 — cumulative daily PDU: (Σ sales ÷ Σ business days) ÷ active HC. */
function pduDay(servicoRows: ServicoDay[], days: DayAxis[], totalHc: number): PduDay[] {
  const byDay = new Map<string, number>();

  for (const r of servicoRows) byDay.set(r.d, (byDay.get(r.d) ?? 0) + r.v);

  let cumulativeVendas = 0;
  let cumulativeDays = 0;

  return days.map((day) => {
    if (!day.fimDeSemana && !day.feriado) cumulativeDays += 1;

    const producao = byDay.get(day.data) ?? 0;

    cumulativeVendas += producao;

    return {
      label: day.label.replace(" - ", "-").toLowerCase(),
      pdu: cumulativeDays > 0 && totalHc > 0 ? +(cumulativeVendas / cumulativeDays / totalHc).toFixed(2) : 0,
      producao,
    };
  });
}

/**
 * Bloco 7 (monthly) — one point per month up to the range's end date.
 *
 * This block deliberately ignores the start date: the original widened it to
 * "2000-01-01" to draw a 12-month history. The source only holds 2026 onward, so
 * the chart shows the months that exist rather than padding empty ones.
 */
async function pduMonth(f: HcFilters): Promise<PduMonth[]> {
  const params: unknown[] = [];
  const where = hcWhere(f, params) + vendasWhere(f, params);
  const sql = `
    WITH base AS (
      SELECT date_format(data, 'yyyy-MM') m, data, hash_user, situacao,
             UPPER(TRIM(servico)) servico, total_vendas, dias_trabalhado
      FROM ${SOURCE}
      WHERE data >= add_months(DATE'${f.to}', -11) AND data <= DATE'${f.to}'
        AND UPPER(TRIM(flag_feriado)) = 'NAO'${where}
    ),
    -- One row per person per day; peso is the day's weight (0, 0.5 or 1).
    dia AS (
      SELECT m, data, hash_user,
             MAX(dias_trabalhado) peso,
             SUM(total_vendas) v,
             SUM(CASE WHEN servico = 'INTERNET' THEN total_vendas ELSE 0 END) ftth,
             SUM(CASE WHEN servico = 'FWA' THEN total_vendas ELSE 0 END) fwa,
             SUM(CASE WHEN servico = '5G' THEN total_vendas ELSE 0 END) g5,
             SUM(CASE WHEN servico IN ('RENOVACAO', 'RENOVAÇÃO') THEN total_vendas ELSE 0 END) renov,
             MAX(${ATIVO}) ativo
      FROM base GROUP BY m, data, hash_user
    )
    SELECT m,
           COUNT(DISTINCT data) dias,
           COUNT(DISTINCT CASE WHEN ativo = 1 THEN hash_user END) hc,
           SUM(peso) worked,
           SUM(v) total,
           SUM(ftth) ftth, SUM(fwa) fwa, SUM(g5) g5, SUM(renov) renov
    FROM dia GROUP BY m ORDER BY m`;

  const rows = await q<{
    m: string;
    days: number;
    hc: number;
    worked: number;
    total: number;
    ftth: number;
    fwa: number;
    g5: number;
    renov: number;
  }>(sql, params);

  return rows.map((r) => {
    const total = num(r.total);
    const worked = num(r.worked);
    const [year, month] = r.m.split("-");

    return {
      month: r.m,
      label: `${MONTHS[Number(month) - 1]} - ${year}`,
      // Production per WORKED person-day: `dias_trabalhado` already weighs a
      // half day as 0.5 and an absence as 0. Matches the app being replaced.
      pdu: worked > 0 ? +(total / worked).toFixed(2) : 0,
      ftth: num(r.ftth),
      fwa: num(r.fwa),
      chips5g: num(r.g5),
      renovacoes: num(r.renov),
      total,
      hcAtivo: num(r.hc),
      diasUteis: num(r.days),
    };
  });
}

export type MatrizView = "consultor" | "gerencia" | "coordenacao" | "cidade";

export async function databricksHcDesempenho(f: HcFilters, view: MatrizView): Promise<HcDesempenhoView> {
  const d1 = previousDay(f.to);
  // Every leg is independent — one round trip's latency for all of them.
  const [todasPessoaDia, servicoRows, pdum, diasUteisMes] = await Promise.all([
    fetchPersonDay(f),
    fetchServicoDay(f, view),
    pduMonth(f),
    diasUteisInMonth(f.to),
  ]);

  // The regional block keeps every group visible even when one is cross-filtered;
  // every other block sees the narrowed set.
  const personDay = applyGroupCross(todasPessoaDia, f).filter((r) => r.d >= f.from);
  const ofPeriod = todasPessoaDia.filter((r) => r.d >= f.from);
  const byDay = new Map<string, PersonDay[]>();

  for (const r of personDay) byDay.set(r.d, [...(byDay.get(r.d) ?? []), r]);

  const periodDays = dateRangeList(f.from, f.to);
  const zerado = zeradoByDay(byDay, periodDays);
  const holidayByDay = new Map(zerado.map((z) => [z.data, z.feriado]));
  const days: DayAxis[] = periodDays.map((data) => ({
    data,
    label: dayLabel(data),
    feriado: holidayByDay.get(data) ?? false,
    fimDeSemana: isWeekend(data),
  }));
  // The original's fn_FiltroDiaUtil: days that exist in the data and are not
  // flagged as a holiday.
  const withData = new Set(personDay.map((r) => r.d));
  const diasUteis = periodDays.filter((d) => withData.has(d) && !holidayByDay.get(d));
  const refDate = diasUteis[diasUteis.length - 1] ?? f.to;
  const hcAtivo = new Set(personDay.filter((r) => r.ativo === 1 && r.k).map((r) => r.k));

  return {
    days,
    quadroGeral: quadroGeral(personDay, refDate),
    totalizadores: totalizadores(servicoRows),
    zeradoByDay: zerado,
    regional: {
      gerencia: regional(ofPeriod, (r) => r.gerente, days, f.to, d1),
      coordenacao: regional(ofPeriod, (r) => r.coordenacao, days, f.to, d1),
      cidade: regional(ofPeriod, (r) => r.cidade, days, f.to, d1),
    },
    vendedores: vendedores(personDay, diasUteis, refDate, diasUteisMes),
    matriz: {
      [view]: matriz(servicoRows, days, subjectOrder(personDay, view)),
    } as HcDesempenhoView["matriz"],
    pduDay: pduDay(servicoRows, days, hcAtivo.size),
    pduMonth: pdum,
    diasUteisElapsed: diasUteis.length,
    refDate,
  };
}

/**
 * Working days in the whole month the range ends in — the denominator the
 * monthly projection extrapolates to. Counted from the source's own holiday
 * flag, replacing the hard-coded 22 the original carried.
 *
 * Deliberately NOT scoped: this is a calendar, not people. September had the
 * working days it had, and a denominator that shrank with the reader's scope
 * would make the same person's PDU read differently to their manager.
 */
async function diasUteisInMonth(to: string): Promise<number> {
  const rows = await q<{ d: number }>(
    `SELECT COUNT(DISTINCT CASE WHEN ${FERIADO} = 0 AND dayofweek(data) NOT IN (1, 7) THEN data END) d
     FROM ${SOURCE}
     WHERE date_format(data, 'yyyy-MM') = date_format(DATE'${to}', 'yyyy-MM')`,
    [],
  );

  return num(rows[0]?.d);
}

/**
 * Raw material for the cascading dropdowns: one row per attribute combination in
 * the range (~16k for a month). Cascaded in Node and cached per period, so a
 * filter click costs no query. Never reaches the browser.
 */
export function databricksHcFilterTuples(
  from: string,
  to: string,
  scope: ScopeFilter,
): Promise<HcFilterTuple[]> {
  // Scoped like every other query: a dropdown that offered a gerência the user
  // cannot open would be a list of names they are not allowed to see, and
  // picking one would return an empty screen with no explanation.
  const sc = scopePredicate(scope, "hash_user");
  const sql = `
    SELECT DISTINCT
      TRIM(gerente) gerente,
      TRIM(coordenacao) coordenacao,
      TRIM(supervisao) supervisao,
      TRIM(lider) lider,
      TRIM(cidade_vendedor) cidade,
      CAST(matricula AS STRING) matricula,
      TRIM(consultor) consultor,
      TRIM(canal) canal,
      TRIM(nicho) nicho,
      TRIM(servico) servico,
      TRIM(indicador) indicador,
      TRIM(tipo_cidade) perfil,
      TRIM(status_experiencia) experiencia
    FROM ${SOURCE}
    WHERE data BETWEEN DATE'${from}' AND DATE'${to}'${sc.where}`;

  return q<HcFilterTuple>(sql, sc.params);
}
