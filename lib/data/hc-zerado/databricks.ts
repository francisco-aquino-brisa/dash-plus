// Databricks adapter for the HC Zerado module. Read-only, aggregated in SQL.
//
// Source (verified): projeto_brisa_performance.vw_producao_hc_zero_venda —
// one row per sale-ish event with the seller's HR attributes attached.
//
// Period dates are laundered through `safeIsoDate` before being inlined as
// DATE literals; every dimension value is bound as an ordinal `?` parameter.
// Ordinal parameters are POSITIONAL: params must be pushed in the same order
// their `?` appears in the SQL text, which is why the row filter (inside the
// `base` CTE) is always built before the sale expression (used further down).

import { getDataClient } from "../client";
import { num } from "../_shared";
import { hcWhere, vendasExpr } from "./filters";
import { dateRangeList, isWeekend, labelDia, previousDay } from "./dates";
import type {
  DiaEixo,
  DiaZerado,
  HcDesempenhoView,
  HcFilters,
  HcFilterOptions,
  MatrizRow,
  PduDia,
  PduMes,
  QuadroGeral,
  RegionalRow,
  Totalizadores,
  VendedorRow,
} from "./types";

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

export async function databricksHcWatermark(): Promise<string> {
  try {
    const r = await q<{ wm: string }>(`SELECT CAST(MAX(data) AS STRING) wm FROM ${FONTE}`, []);

    return r[0]?.wm ?? "unknown";
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
      SELECT CAST(data AS STRING) d, ${dim} nome, servico, ${detalhe} detalhe, SUM(${vendas}) v
      FROM base GROUP BY data, ${dim}, servico
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
  const pessoas = new Map<string, { ultima: PessoaDia; dias: Map<string, number> }>();

  for (const r of rows) {
    if (!r.matricula) continue;

    const cur = pessoas.get(r.matricula) ?? { ultima: r, dias: new Map<string, number>() };

    cur.dias.set(r.d, (cur.dias.get(r.d) ?? 0) + r.v);

    // Identity and status describe the person on their most recent day in the
    // range, so the row reads as the state the reference day would show.
    if (r.d >= cur.ultima.d) cur.ultima = r;

    pessoas.set(r.matricula, cur);
  }

  const out: VendedorRow[] = [];

  for (const [matricula, p] of pessoas) {
    if (p.ultima.ativo !== 1) continue;

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
      consultor: p.ultima.consultor ?? "",
      canal: p.ultima.canal ?? "",
      cidade: p.ultima.cidade ?? "",
      gerente: p.ultima.gerente ?? "",
      coordenacao: p.ultima.coordenacao ?? "",
      situacao: p.ultima.situacao ?? "",
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
    });
  }

  return out.sort((a, b) => b.diasSemVenda - a.diasSemVenda || a.consultor.localeCompare(b.consultor));
}

/** Bloco 6 — daily production matrix for the selected grouping. */
function matriz(rows: ServicoDia[], dias: DiaEixo[]): MatrizRow[] {
  const indice = new Map(dias.map((d, i) => [d.data, i]));
  const acc = new Map<string, MatrizRow>();

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
      } satisfies MatrizRow);
    const i = indice.get(r.d);

    if (i !== undefined) row.valores[i] += r.v;

    row.total += r.v;
    acc.set(key, row);
  }

  return [...acc.values()].sort((a, b) => a.nome.localeCompare(b.nome) || a.servico.localeCompare(b.servico));
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
  const where = hcWhere(f, params);
  const vendas = vendasExpr(f, params);
  const sql = `
    WITH base AS (
      SELECT * FROM ${FONTE} WHERE data <= DATE'${f.to}'${where}
    ),
    mes AS (SELECT date_format(data, 'yyyy-MM') m, MAX(data) maxd FROM base GROUP BY 1),
    -- The headcount of a month is the snapshot of its last day with data.
    hc AS (
      SELECT mes.m m, ${HC_KEY} k
      FROM base JOIN mes ON date_format(base.data, 'yyyy-MM') = mes.m AND base.data = mes.maxd
      WHERE ${ATIVO} = 1
    ),
    hcn AS (SELECT m, COUNT(DISTINCT k) n FROM hc GROUP BY m),
    prod AS (
      SELECT mes.m m, base.servico servico, SUM(${vendas}) v
      FROM base
      JOIN mes ON date_format(base.data, 'yyyy-MM') = mes.m
      JOIN (SELECT DISTINCT m, k FROM hc) h ON h.m = mes.m AND h.k = ${HC_KEY}
      GROUP BY mes.m, base.servico
    ),
    -- Working days: the source flags Sundays and holidays via flag_feriado but
    -- not Saturdays, and the original excluded both weekend days.
    uteis AS (
      SELECT date_format(data, 'yyyy-MM') m,
             COUNT(DISTINCT CASE WHEN ${FERIADO} = 0 AND dayofweek(data) NOT IN (1, 7) THEN data END) d
      FROM base GROUP BY 1
    )
    SELECT mes.m,
           COALESCE(hcn.n, 0) hc,
           COALESCE(uteis.d, 0) dias,
           COALESCE(SUM(CASE WHEN UPPER(prod.servico) = 'INTERNET' THEN prod.v END), 0) ftth,
           COALESCE(SUM(CASE WHEN UPPER(prod.servico) = 'FWA' THEN prod.v END), 0) fwa,
           COALESCE(SUM(CASE WHEN UPPER(prod.servico) = '5G' THEN prod.v END), 0) g5,
           COALESCE(SUM(prod.v), 0) total
    FROM mes
    LEFT JOIN prod ON prod.m = mes.m
    LEFT JOIN uteis ON uteis.m = mes.m
    LEFT JOIN hcn ON hcn.m = mes.m
    GROUP BY mes.m, uteis.d, hcn.n
    ORDER BY mes.m`;

  const rows = await q<{
    m: string;
    hc: number;
    dias: number;
    ftth: number;
    fwa: number;
    g5: number;
    total: number;
  }>(sql, params);

  return rows.map((r) => {
    const hcAtivo = num(r.hc);
    const diasUteis = num(r.dias);
    const total = num(r.total);
    const [ano, mes] = r.m.split("-");

    return {
      mes: r.m,
      label: `${MESES[Number(mes) - 1]} - ${ano}`,
      pdu: diasUteis > 0 && hcAtivo > 0 ? +(total / diasUteis / hcAtivo).toFixed(2) : 0,
      ftth: num(r.ftth),
      fwa: num(r.fwa),
      chips5g: num(r.g5),
      total,
      hcAtivo,
      diasUteis,
    };
  });
}

export type MatrizVisao = "consultor" | "gerencia" | "coordenacao" | "cidade";

export async function databricksHcDesempenho(f: HcFilters, visao: MatrizVisao): Promise<HcDesempenhoView> {
  const d1 = previousDay(f.to);
  const [todasPessoaDia, servicoRows, pdum] = await Promise.all([
    fetchPessoaDia(f),
    fetchServicoDia(f, visao),
    pduMes(f),
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
    vendedores: vendedores(pessoaDia, diasUteis, refDate, await diasUteisDoMes(f.to)),
    matriz: { [visao]: matriz(servicoRows, dias) } as HcDesempenhoView["matriz"],
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

/** Distinct values for the filter panel's dropdowns. */
export async function databricksHcFilterOptions(): Promise<HcFilterOptions> {
  const sql = `
    SELECT
      array_sort(array_distinct(collect_list(NULLIF(TRIM(gerente), '')))) gerentes,
      array_sort(array_distinct(collect_list(NULLIF(TRIM(coordenacao), '')))) coordenacoes,
      array_sort(array_distinct(collect_list(NULLIF(TRIM(supervisao), '')))) supervisoes,
      array_sort(array_distinct(collect_list(NULLIF(TRIM(lider), '')))) lideres,
      array_sort(array_distinct(collect_list(NULLIF(TRIM(cidade_vendedor), '')))) cidades,
      array_sort(array_distinct(collect_list(NULLIF(TRIM(canal), '')))) canais,
      array_sort(array_distinct(collect_list(NULLIF(TRIM(nicho), '')))) nichos,
      array_sort(array_distinct(collect_list(NULLIF(TRIM(servico), '')))) servicos,
      array_sort(array_distinct(collect_list(NULLIF(TRIM(indicador), '')))) indicadores
    FROM ${FONTE}
    WHERE data >= add_months(current_date(), -2)`;

  const [r] = await q<Record<string, string[]>>(sql, []);
  const list = (k: string) => (Array.isArray(r?.[k]) ? r[k].filter(Boolean) : []);

  return {
    gerentes: list("gerentes"),
    coordenacoes: list("coordenacoes"),
    supervisoes: list("supervisoes"),
    lideres: list("lideres"),
    cidades: list("cidades"),
    consultores: [],
    canais: list("canais"),
    nichos: list("nichos"),
    servicos: list("servicos"),
    indicadores: list("indicadores"),
  };
}
