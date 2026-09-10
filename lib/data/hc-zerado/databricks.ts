// Databricks adapter for the HC Zerado module. Read-only, aggregated in SQL.
//
// Source (verified): projeto_brisa_performance.tb_producao_hc_zero_venda —
// one row per sale-ish event with the seller's HR attributes attached.
//
// Period dates are laundered through `safeIsoDate` before being inlined as
// DATE literals; every dimension value is bound as an ordinal `?` parameter.
// Ordinal parameters are POSITIONAL: params must be pushed in the same order
// their `?` appears in the SQL text, which is why the row filter (inside the
// `base` CTE) is always built before the sale expression (used further down).

import { getDataClient } from "../client";
import { num } from "../_shared";
import { hcWhere, vendasExpr, vendasWhere } from "./filters";
import { dateRangeList, isWeekend, labelDia, previousDay } from "./dates";
import type {
  DiaEixo,
  DiaZerado,
  HcDesempenhoView,
  HcFilters,
  HcFilterTuple,
  MatrizRow,
  PduDia,
  PduMes,
  QuadroGeral,
  RegionalRow,
  Totalizadores,
  VendedorRow,
} from "./types";

/**
 * Part of the cache key. Constant in production (ADR 0002 unchanged); in dev it
 * is re-evaluated on every recompile, so editing an aggregation invalidates what
 * the previous version of it cached without needing a manual version bump.
 */
export const HC_ADAPTER_BUILD = process.env.NODE_ENV === "production" ? "prod" : String(Date.now());

const CAT = process.env.DATABRICKS_CITIES_CATALOG ?? "gdb_brisanet_comunidade_dev";
const SCHEMA = process.env.DATABRICKS_HC_SCHEMA ?? "projeto_brisa_performance";
// The materialized table, NOT `vw_producao_hc_zero_venda`. The view rebuilds a
// long CTE chain (waves + 5G + renovação FULL OUTER JOINed against the payroll
// snapshot) on every read — the same one-month aggregate takes ~8s through the
// view and ~0s through the table. Same 44 columns, same totals; the table trails
// the view by a refresh cycle.
const FONTE = `\`${CAT}\`.\`${SCHEMA}\`.\`${process.env.DATABRICKS_HC_TABLE ?? "tb_producao_hc_zero_venda"}\``;

/**
 * Stable identity of one HC. `documento_hc` is the source's own key; the
 * matrícula fallback covers the rows where it is blank. When neither exists the
 * key is NULL and the row drops out of the DISTINCT counts instead of collapsing
 * every anonymous row into a single fake person — the original used two
 * different fallback prefixes (`CPF-` / `MAT-`) in different blocks, which meant
 * the same person could be counted twice across blocks.
 */
const HC_KEY = `CASE
  WHEN documento_hc IS NOT NULL AND TRIM(documento_hc) <> '' THEN TRIM(documento_hc)
  WHEN matricula IS NOT NULL THEN CONCAT('MAT-', CAST(matricula AS STRING))
END`;

/** The original accepted three spellings of "active". */
const ATIVO = `CASE WHEN UPPER(TRIM(situacao)) IN ('ATIVO','ATIVOS','ACTIVE') THEN 1 ELSE 0 END`;

const FERIADO = `CASE WHEN UPPER(TRIM(flag_feriado)) LIKE 'SIM%' THEN 1 ELSE 0 END`;

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function q<T>(sql: string, params: unknown[]): Promise<T[]> {
  return getDataClient().query<T>(sql, params);
}

/** `base` CTE: every row in the period that survives the row-level filters. */
function baseCte(f: HcFilters, params: unknown[], skipCross: Parameters<typeof hcWhere>[2] = []): string {
  return `base AS (
    SELECT * FROM ${FONTE}
    WHERE data BETWEEN DATE'${f.from}' AND DATE'${f.to}'${hcWhere(f, params, skipCross)}
  )`;
}

// Asked for twice per render (the view and the filter options) for a source
// that only advances hourly.
const WM_TTL_MS = 60_000;
const gWm = globalThis as unknown as { __hcWatermark?: { value: string; at: number } };

export async function databricksHcWatermark(): Promise<string> {
  const memo = gWm.__hcWatermark;

  if (memo && Date.now() - memo.at < WM_TTL_MS) return memo.value;

  try {
    const r = await q<{ wm: string }>(`SELECT CAST(MAX(data) AS STRING) wm FROM ${FONTE}`, []);
    const value = r[0]?.wm ?? "unknown";

    gWm.__hcWatermark = { value, at: Date.now() };

    return value;
  } catch {
    return "unknown";
  }
}

/**
 * One row per person × day × management tuple — the grain every headcount block
 * is derived from. A single month is ~27k rows, so the whole set is aggregated
 * here in Node rather than in one SQL round-trip per block: the view is large
 * enough that concurrent scans of it contend with each other, and the blocks all
 * want the same scan.
 *
 * The range is widened to include D-1 (the regional comparison needs yesterday)
 * and the three group cross-filters are deliberately NOT pushed down — the
 * regional table must keep showing every group when one of its rows is clicked,
 * exactly as the original did. Every other block re-applies them in memory.
 */
interface PessoaDia {
  d: string;
  k: string;
  matricula: string | null;
  ativo: number;
  feriado: number;
  v: number;
  gerente: string;
  coordenacao: string;
  cidade: string;
  consultor: string;
  canal: string;
  situacao: string;
}

async function fetchPessoaDia(f: HcFilters): Promise<PessoaDia[]> {
  const d1 = previousDay(f.to);
  const wide: HcFilters = { ...f, from: d1 < f.from ? d1 : f.from };
  const params: unknown[] = [];
  const base = baseCte(wide, params, ["gerencia", "coordenacao", "cidade"]);
  const vendas = vendasExpr(wide, params);
  const sql = `
    WITH ${base}
    SELECT CAST(data AS STRING) d,
           ${HC_KEY} k,
           CAST(matricula AS STRING) matricula,
           MAX(${ATIVO}) ativo,
           MAX(${FERIADO}) feriado,
           SUM(${vendas}) v,
           COALESCE(NULLIF(TRIM(gerente), ''), 'Sem Regional') gerente,
           COALESCE(NULLIF(TRIM(coordenacao), ''), 'Sem Regional') coordenacao,
           COALESCE(NULLIF(TRIM(cidade_vendedor), ''), 'Sem Regional') cidade,
           MAX(consultor) consultor,
           MAX(canal) canal,
           MAX(situacao) situacao
    FROM base
    GROUP BY data, ${HC_KEY}, CAST(matricula AS STRING),
             COALESCE(NULLIF(TRIM(gerente), ''), 'Sem Regional'),
             COALESCE(NULLIF(TRIM(coordenacao), ''), 'Sem Regional'),
             COALESCE(NULLIF(TRIM(cidade_vendedor), ''), 'Sem Regional')`;

  const rows = await q<PessoaDia>(sql, params);

  return rows.map((r) => ({ ...r, ativo: num(r.ativo), feriado: num(r.feriado), v: num(r.v) }));
}

/** One row per service × day × group — production, for the matrix and totals. */
interface ServicoDia {
  d: string;
  nome: string;
  detalhe: string;
  servico: string;
  indicador: string;
  v: number;
}

async function fetchServicoDia(f: HcFilters, visao: MatrizVisao): Promise<ServicoDia[]> {
  const dim =
    visao === "gerencia"
      ? "COALESCE(NULLIF(TRIM(gerente), ''), 'Sem Regional')"
      : visao === "coordenacao"
        ? "COALESCE(NULLIF(TRIM(coordenacao), ''), 'Sem Regional')"
        : visao === "cidade"
          ? "COALESCE(NULLIF(TRIM(cidade_vendedor), ''), 'Sem Cidade')"
          : "COALESCE(NULLIF(TRIM(consultor), ''), 'Sem Consultor')";
  const detalhe = visao === "consultor" ? "MAX(canal)" : "MAX(cidade_vendedor)";
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

  const rows = await q<ServicoDia>(sql, params);

  return rows.map((r) => ({ ...r, v: num(r.v) }));
}

/** Drop the rows the regional scan deliberately kept (see `fetchPessoaDia`). */
function aplicaCrossDeGrupo(rows: PessoaDia[], f: HcFilters): PessoaDia[] {
  const { gerencia, coordenacao, cidade } = f.cross;

  if (!gerencia && !coordenacao && !cidade) return rows;

  return rows.filter(
    (r) =>
      (!gerencia || r.gerente === gerencia) &&
      (!coordenacao || r.coordenacao === coordenacao) &&
      (!cidade || r.cidade === cidade),
  );
}

/**
 * Normalize `situacao` into the buckets the original showed. The source stores
 * the same state under accented and unaccented spellings (`FERIAS`/`FÉRIAS`,
 * `AF.PREVIDENCIA`/`AF.PREVIDÊNCIA`), which rendered as duplicated tiles each
 * holding half the count — folding them here is the agreed fix.
 */
function categoriaSituacao(raw: string | null): string {
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
function quadroGeral(rows: PessoaDia[], refDate: string | null): QuadroGeral {
  if (!refDate) return { total: 0, refDate: null, items: [] };

  const porCategoria = new Map<string, Set<string>>();
  const todos = new Set<string>();

  for (const r of rows) {
    if (r.d !== refDate || !r.k) continue;

    const cat = categoriaSituacao(r.situacao);
    const set = porCategoria.get(cat) ?? new Set<string>();

    set.add(r.k);
    porCategoria.set(cat, set);
    todos.add(r.k);
  }

  const total = todos.size;
  const preferida = ["Ativos", "Férias", "Maternidade", "INSS"];
  const outras = [...porCategoria.keys()].filter((c) => !preferida.includes(c)).sort();

  return {
    total,
    refDate,
    items: [...preferida, ...outras]
      .map((label) => {
        const count = porCategoria.get(label)?.size ?? 0;

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
function totalizadores(rows: ServicoDia[]): Totalizadores {
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

/** Active HC and zeroed HC for one day, deduplicated by person. */
function contaDia(rows: PessoaDia[]): { ativos: number; zerados: number } {
  const ativo = new Map<string, number>();

  for (const r of rows) {
    if (!r.k) continue;

    if (r.ativo === 1) ativo.set(r.k, (ativo.get(r.k) ?? 0) + r.v);
  }

  let zerados = 0;

  for (const v of ativo.values()) if (v === 0) zerados += 1;

  return { ativos: ativo.size, zerados };
}

/** Bloco 3 — active vs zeroed HC per day. */
function zeradoPorDia(porDia: Map<string, PessoaDia[]>, dias: string[]): DiaZerado[] {
  return dias.map((data) => {
    const doDia = porDia.get(data) ?? [];
    const { ativos, zerados } = contaDia(doDia);

    return {
      data,
      label: labelDia(data),
      ativos,
      zerados,
      ativosRestantes: Math.max(0, ativos - zerados),
      pctZerado: ativos > 0 ? +((zerados / ativos) * 100).toFixed(1) : 0,
      feriado: doDia.some((r) => r.feriado === 1),
    };
  });
}

/** Bloco 4 / Matriz Gerencial — one row per management group. */
function regional(
  rows: PessoaDia[],
  chave: (r: PessoaDia) => string,
  dias: DiaEixo[],
  d0: string,
  d1: string,
): RegionalRow[] {
  const grupos = new Map<string, Map<string, PessoaDia[]>>();

  for (const r of rows) {
    const nome = chave(r) || "Sem Regional";
    const porDia = grupos.get(nome) ?? new Map<string, PessoaDia[]>();

    porDia.set(r.d, [...(porDia.get(r.d) ?? []), r]);
    grupos.set(nome, porDia);
  }

  return [...grupos.entries()]
    .map(([nome, porDia]) => {
      const ativoHoje = new Map<string, number>();

      for (const r of porDia.get(d0) ?? []) {
        if (r.k && r.ativo === 1) ativoHoje.set(r.k, (ativoHoje.get(r.k) ?? 0) + r.v);
      }

      const totalAtivo = ativoHoje.size;
      let totalVenderam = 0;

      for (const v of ativoHoje.values()) if (v > 0) totalVenderam += 1;

      const totalZerado = totalAtivo - totalVenderam;
      const ontem = contaDia(porDia.get(d1) ?? []);

      return {
        id: nome,
        nome,
        totalAtivo,
        totalVenderam,
        pctVendeu: totalAtivo > 0 ? Math.round((totalVenderam / totalAtivo) * 100) : 0,
        totalZerado,
        pctZerado: totalAtivo > 0 ? Math.round((totalZerado / totalAtivo) * 100) : 0,
        countZeradoD0: totalZerado,
        countZeradoD1: ontem.zerados,
        d1Status:
          totalZerado < ontem.zerados
            ? ("melhora" as const)
            : totalZerado > ontem.zerados
              ? ("piora" as const)
              : ("estavel" as const),
        serieZerados: dias.map((dia) => contaDia(porDia.get(dia.data) ?? []).zerados),
      };
    })
    .sort((a, b) => b.totalZerado - a.totalZerado);
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
  rows: PessoaDia[],
  diasUteis: string[],
  refDate: string,
  diasUteisMes: number,
): VendedorRow[] {
  const people = new Map<string, { first: PessoaDia; dias: Map<string, number> }>();

  for (const r of rows) {
    if (!r.matricula) continue;

    const cur = people.get(r.matricula) ?? { first: r, dias: new Map<string, number>() };

    cur.dias.set(r.d, (cur.dias.get(r.d) ?? 0) + r.v);

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

    for (const dia of diasUteis) {
      const v = p.dias.get(dia) ?? 0;

      totalVendas += v;

      if (v > 0) diasComVenda += 1;
      else diasSemVenda += 1;
    }

    const avaliados = diasComVenda + diasSemVenda;

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
      aproveitamento: avaliados > 0 ? Math.round((diasComVenda / avaliados) * 100) : 0,
      // Pace × the month's full working days. The original multiplied by a
      // hard-coded 22 ("month of June 2026"); the real count now comes from the
      // source's own holiday flag.
      projecao: avaliados > 0 ? Math.round((totalVendas / avaliados) * diasUteisMes) : 0,
      vendasPorDia: diasUteis.map((d) => p.dias.get(d) ?? 0),
      zerouHoje: (p.dias.get(refDate) ?? 0) === 0,
      firstDay: p.first.d,
    });
  }

  // First appearance, then matrícula — ordering by idle days ties everyone on
  // a short period and buries whoever actually sold.
  return out.sort((a, b) => a.firstDay.localeCompare(b.firstDay) || a.matricula.localeCompare(b.matricula));
}

/** Bloco 6 — daily production matrix for the selected grouping. */
function matriz(rows: ServicoDia[], dias: DiaEixo[], order: Map<string, string>): MatrizRow[] {
  const indice = new Map(dias.map((d, i) => [d.data, i]));
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
        valores: dias.map(() => 0),
        total: 0,
        subjectTotal: 0,
        breakdown: {},
      } satisfies MatrizRow);
    const i = indice.get(r.d);

    if (i !== undefined) {
      row.valores[i] += r.v;

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
function subjectOrder(rows: PessoaDia[], visao: MatrizVisao): Map<string, string> {
  const key = (r: PessoaDia) =>
    visao === "gerencia"
      ? r.gerente
      : visao === "coordenacao"
        ? r.coordenacao
        : visao === "cidade"
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
function pduDia(servicoRows: ServicoDia[], dias: DiaEixo[], totalHc: number): PduDia[] {
  const porDia = new Map<string, number>();

  for (const r of servicoRows) porDia.set(r.d, (porDia.get(r.d) ?? 0) + r.v);

  let vendasAcum = 0;
  let diasAcum = 0;

  return dias.map((dia) => {
    if (!dia.fimDeSemana && !dia.feriado) diasAcum += 1;

    const producao = porDia.get(dia.data) ?? 0;

    vendasAcum += producao;

    return {
      label: dia.label.replace(" - ", "-").toLowerCase(),
      pdu: diasAcum > 0 && totalHc > 0 ? +(vendasAcum / diasAcum / totalHc).toFixed(2) : 0,
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
async function pduMes(f: HcFilters): Promise<PduMes[]> {
  const params: unknown[] = [];
  const where = hcWhere(f, params) + vendasWhere(f, params);
  const sql = `
    WITH base AS (
      SELECT date_format(data, 'yyyy-MM') m, data, hash_user, situacao,
             UPPER(TRIM(servico)) servico, total_vendas, dias_trabalhado
      FROM ${FONTE}
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
    dias: number;
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
    const [ano, mes] = r.m.split("-");

    return {
      mes: r.m,
      label: `${MESES[Number(mes) - 1]} - ${ano}`,
      // Production per WORKED person-day: `dias_trabalhado` already weighs a
      // half day as 0.5 and an absence as 0. Matches the app being replaced.
      pdu: worked > 0 ? +(total / worked).toFixed(2) : 0,
      ftth: num(r.ftth),
      fwa: num(r.fwa),
      chips5g: num(r.g5),
      renovacoes: num(r.renov),
      total,
      hcAtivo: num(r.hc),
      diasUteis: num(r.dias),
    };
  });
}

export type MatrizVisao = "consultor" | "gerencia" | "coordenacao" | "cidade";

export async function databricksHcDesempenho(f: HcFilters, visao: MatrizVisao): Promise<HcDesempenhoView> {
  const d1 = previousDay(f.to);
  // Every leg is independent — one round trip's latency for all of them.
  const [todasPessoaDia, servicoRows, pdum, diasUteisMes] = await Promise.all([
    fetchPessoaDia(f),
    fetchServicoDia(f, visao),
    pduMes(f),
    diasUteisDoMes(f.to),
  ]);

  // The regional block keeps every group visible even when one is cross-filtered;
  // every other block sees the narrowed set.
  const pessoaDia = aplicaCrossDeGrupo(todasPessoaDia, f).filter((r) => r.d >= f.from);
  const doPeriodo = todasPessoaDia.filter((r) => r.d >= f.from);
  const porDia = new Map<string, PessoaDia[]>();

  for (const r of pessoaDia) porDia.set(r.d, [...(porDia.get(r.d) ?? []), r]);

  const diasDoPeriodo = dateRangeList(f.from, f.to);
  const zerado = zeradoPorDia(porDia, diasDoPeriodo);
  const feriadoPorDia = new Map(zerado.map((z) => [z.data, z.feriado]));
  const dias: DiaEixo[] = diasDoPeriodo.map((data) => ({
    data,
    label: labelDia(data),
    feriado: feriadoPorDia.get(data) ?? false,
    fimDeSemana: isWeekend(data),
  }));
  // The original's fn_FiltroDiaUtil: days that exist in the data and are not
  // flagged as a holiday.
  const comDados = new Set(pessoaDia.map((r) => r.d));
  const diasUteis = diasDoPeriodo.filter((d) => comDados.has(d) && !feriadoPorDia.get(d));
  const refDate = diasUteis[diasUteis.length - 1] ?? f.to;
  const hcAtivo = new Set(pessoaDia.filter((r) => r.ativo === 1 && r.k).map((r) => r.k));

  return {
    dias,
    quadroGeral: quadroGeral(pessoaDia, refDate),
    totalizadores: totalizadores(servicoRows),
    zeradoPorDia: zerado,
    regional: {
      gerencia: regional(doPeriodo, (r) => r.gerente, dias, f.to, d1),
      coordenacao: regional(doPeriodo, (r) => r.coordenacao, dias, f.to, d1),
      cidade: regional(doPeriodo, (r) => r.cidade, dias, f.to, d1),
    },
    vendedores: vendedores(pessoaDia, diasUteis, refDate, diasUteisMes),
    matriz: {
      [visao]: matriz(servicoRows, dias, subjectOrder(pessoaDia, visao)),
    } as HcDesempenhoView["matriz"],
    pduDia: pduDia(servicoRows, dias, hcAtivo.size),
    pduMes: pdum,
    diasUteisDecorridos: diasUteis.length,
    refDate,
  };
}

/**
 * Working days in the whole month the range ends in — the denominator the
 * monthly projection extrapolates to. Counted from the source's own holiday
 * flag, replacing the hard-coded 22 the original carried.
 */
async function diasUteisDoMes(to: string): Promise<number> {
  const rows = await q<{ d: number }>(
    `SELECT COUNT(DISTINCT CASE WHEN ${FERIADO} = 0 AND dayofweek(data) NOT IN (1, 7) THEN data END) d
     FROM ${FONTE}
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
export function databricksHcFilterTuples(from: string, to: string): Promise<HcFilterTuple[]> {
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
    FROM ${FONTE}
    WHERE data BETWEEN DATE'${from}' AND DATE'${to}'`;

  return q<HcFilterTuple>(sql, []);
}
