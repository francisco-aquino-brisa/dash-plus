// Reads behind Tela 4 (Justificar HC) and Tela 5 (Auditar Justificativas).
//
// What sets these two apart from the first three screens: "zerado" here is NOT
// relative to the sale filters in the panel. It is decided by the single row of
// `regras_justificativa_hc` — a global lock, so the day a person has to justify
// is the same day for everyone who opens the screen. `filters.ts` still supplies
// the row-level predicates (who is in scope); the sale side comes from the rules.

import { T } from "../admin/tables";
import { isStatus } from "./catalog";
import { hcWhere } from "./filters";
import { ATIVO, CIDADE, FERIADO, JUSTIFICATIVAS, REGRAS, SOURCE, q } from "./source";
import type {
  AuditoriaRow,
  HcAuditarView,
  HcFilters,
  HcJustificarView,
  HcRegras,
  Justificativa,
  JustificarStats,
  PessoaMeta,
  PessoaZerada,
} from "./types";

/**
 * Used when `regras_justificativa_hc` is empty. Mirrors the row the table
 * actually carries today rather than inventing a laxer rule — a missing lock must
 * not silently make everybody compliant.
 */
const DEFAULT_REGRAS: HcRegras = {
  servicos: ["INTERNET", "5G", "FWA", "RENOVACAO"],
  statusVenda: "CRIADO",
  agilidade: "Todos",
  atualizadoEm: null,
};

function str(v: unknown): string {
  return v == null ? "" : String(v);
}

function orNull(v: unknown): string | null {
  const s = str(v).trim();

  return s === "" ? null : s;
}

// ── Regras globais ────────────────────────────────────────────────────────────

export async function fetchRegras(): Promise<HcRegras> {
  const rows = await q<{
    servicos_obrigatorios: unknown;
    status_venda_obrigatorio: unknown;
    agilidade_obrigatoria: unknown;
    atualizado_em: unknown;
  }>(
    `SELECT servicos_obrigatorios, status_venda_obrigatorio, agilidade_obrigatoria,
            CAST(atualizado_em AS STRING) atualizado_em
       FROM ${REGRAS} WHERE id = 1 LIMIT 1`,
    [],
  );

  const r = rows[0];

  if (!r) return DEFAULT_REGRAS;

  const servicos = str(r.servicos_obrigatorios)
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  return {
    servicos: servicos.length ? servicos : DEFAULT_REGRAS.servicos,
    statusVenda: str(r.status_venda_obrigatorio).trim() || DEFAULT_REGRAS.statusVenda,
    agilidade: str(r.agilidade_obrigatoria).trim() || DEFAULT_REGRAS.agilidade,
    atualizadoEm: orNull(r.atualizado_em),
  };
}

/**
 * `total_vendas`, zeroed unless the sale satisfies the global rules — the SQL
 * form of the origin's three `continue`s.
 *
 * The sale status is charged to INTERNET and FWA only. That is not a liberty we
 * took: `status_venda` describes the wired services, and 5G / Renovação carry
 * their own vocabulary (`5G ATIVO`, `RENOVACAO EFETIVADA`), so charging them
 * `CRIADO` — the value the rules row holds today — would silently zero every one
 * of their sales and mark the whole 5G force as idle.
 */
function regrasExpr(regras: HcRegras, params: unknown[]): string {
  const cl: string[] = [];

  if (regras.servicos.length) {
    cl.push(`UPPER(TRIM(servico)) IN (${regras.servicos.map(() => "?").join(",")})`);
    params.push(...regras.servicos);
  }

  cl.push("(servico NOT IN ('INTERNET','FWA') OR UPPER(status_venda) = ?)");
  params.push(regras.statusVenda.toUpperCase());

  if (regras.agilidade.toUpperCase() === "EFETIVADO") cl.push("UPPER(TRIM(efetivado_mesmo_dia)) = 'SIM'");

  if (regras.agilidade.toUpperCase() === "INSTALADO") cl.push("UPPER(TRIM(instalado_mesmo_dia)) = 'SIM'");

  return `CASE WHEN ${cl.join(" AND ")} THEN total_vendas ELSE 0 END`;
}

/** The services the rules charge, as a predicate over one row — for the day's chips. */
function servicoCobrado(regras: HcRegras, params: unknown[]): string {
  if (!regras.servicos.length) return "TRUE";

  params.push(...regras.servicos);

  return `UPPER(TRIM(servico)) IN (${regras.servicos.map(() => "?").join(",")})`;
}

// ── Dias zerados (Tela 4) ─────────────────────────────────────────────────────

/** One zeroed person-day, straight from SQL — the unit the repository caches. */
export interface ZeroedRow {
  d: string;
  matricula: string;
  consultor: string;
  cargo: string;
  cidade: string;
  coordenacao: string;
  servicos: string;
  feriado: number;
}

/**
 * Every person × business day in the period where the person was ACTIVE and the
 * rules counted no sale.
 *
 * Business day here means **Monday to Friday, holidays included** — the origin's
 * effective rule, and what this screen has to agree with:
 *
 *  - **Saturday is not a business day.** Telas 1–3 count it (the source's
 *    `flag_feriado` only marks Sunday), so this screen's zeroed-day count reads
 *    lower than Tela 1's for the same period. Confirmed as intended.
 *  - **A holiday still has to be justified.** The origin filtered holidays out
 *    against a hardcoded JS list that holds two dates in jun/2026, so in practice
 *    it never excluded one. Using the warehouse's `flag_feriado` instead looked
 *    like an upgrade, but it silently dropped a third of the list: in 01–14/09/2026
 *    it cut 07/09 (Independência, a Monday) and with it 742 zeroed days and 176
 *    people — 2.003/654 against the origin's 2.745/830. Parity wins here; if the
 *    business would rather not charge a holiday, the fix is one predicate
 *    (`AND feriado = 0` below) plus the same change in the origin.
 *
 * The person grain is the matrícula, not `HC_KEY`: the justification table keys
 * by `matricula`, so anything without one cannot be justified and is dropped.
 */
export function fetchDiasZerados(f: HcFilters, regras: HcRegras): Promise<ZeroedRow[]> {
  const params: unknown[] = [];
  const where = hcWhere(f, params);
  const vendas = regrasExpr(regras, params);
  const cobrado = servicoCobrado(regras, params);
  const sql = `
    WITH base AS (
      SELECT * FROM ${SOURCE}
      WHERE data BETWEEN DATE'${f.from}' AND DATE'${f.to}'
        AND dayofweek(data) NOT IN (1, 7)
        AND matricula IS NOT NULL${where}
    ),
    dias AS (
      SELECT CAST(data AS STRING) d,
             CAST(matricula AS STRING) matricula,
             MAX(${ATIVO}) ativo,
             MAX(${FERIADO}) feriado,
             SUM(${vendas}) v,
             MAX(TRIM(consultor)) consultor,
             MAX(TRIM(cargo)) cargo,
             MAX(${CIDADE}) cidade,
             MAX(TRIM(coordenacao)) coordenacao,
             array_join(
               array_sort(collect_set(CASE WHEN ${cobrado} THEN UPPER(TRIM(servico)) END)), ','
             ) servicos
      FROM base
      GROUP BY data, matricula
    )
    SELECT d, matricula, consultor, cargo, cidade, coordenacao, servicos, feriado
    FROM dias
    WHERE ativo = 1 AND v = 0
    ORDER BY consultor, d`;

  return q<ZeroedRow>(sql, params);
}

/** Group the day rows into the screen's list: one entry per person, days ascending. */
export function groupPessoas(rows: ZeroedRow[], justificativas: Map<string, Justificativa>): PessoaZerada[] {
  const byMatricula = new Map<string, PessoaZerada>();

  for (const r of rows) {
    const pessoa = byMatricula.get(r.matricula) ?? {
      matricula: r.matricula,
      consultor: str(r.consultor) || `Matrícula ${r.matricula}`,
      cargo: str(r.cargo) || "Não informado",
      cidade: str(r.cidade) || "Sem Cidade",
      coordenacao: str(r.coordenacao) || "Sem Regional",
      dias: [],
    };

    pessoa.dias.push({
      data: r.d,
      // The origin fell back to INTERNET/FWA when the day carried no chargeable
      // service — a person with no rows at all cannot reach here, so this only
      // covers a day whose services were all outside the rules.
      servicos: str(r.servicos) ? str(r.servicos).split(",") : ["INTERNET", "FWA"],
      feriado: Number(r.feriado) === 1,
      justificativa: justificativas.get(dayKey(r.matricula, r.d)) ?? null,
    });
    byMatricula.set(r.matricula, pessoa);
  }

  for (const p of byMatricula.values()) p.dias.sort((a, b) => a.data.localeCompare(b.data));

  return [...byMatricula.values()].sort((a, b) => a.consultor.localeCompare(b.consultor, "pt-BR"));
}

export function dayKey(matricula: string, data: string): string {
  return `${matricula}|${data}`;
}

// ── Justificativas gravadas ───────────────────────────────────────────────────

/**
 * The justifications of the period. Deliberately NOT cached: the zeroed-day scan
 * is keyed by the source watermark, which does not move when somebody saves a
 * justification — caching this alongside it would keep showing the old status
 * after a write. It reads one small app-owned table, so it costs little.
 *
 * `autor_id`/`avaliador_id` resolve to names through `tb_usuarios`; both are null
 * for every row written before the app started filling them (the origin never did).
 */
export async function fetchJustificativas(from: string, to: string): Promise<Justificativa[]> {
  const rows = await q<Record<string, unknown>>(
    `SELECT CAST(j.matricula AS STRING) matricula,
            CAST(j.data_ocorrencia AS STRING) data_ocorrencia,
            j.categoria, j.motivo, j.status, j.observacao_lider,
            autor.nome autor, avaliador.nome avaliador,
            CAST(j.avaliado_em AS STRING) avaliado_em,
            CAST(j.atualizado_em AS STRING) atualizado_em
       FROM ${JUSTIFICATIVAS} j
       LEFT JOIN ${T.usuarios} autor ON autor.id = j.autor_id
       LEFT JOIN ${T.usuarios} avaliador ON avaliador.id = j.avaliador_id
      WHERE j.data_ocorrencia BETWEEN DATE'${from}' AND DATE'${to}'
      ORDER BY j.data_ocorrencia DESC
      LIMIT 5000`,
    [],
  );

  return rows.map((r) => {
    const status = str(r.status).trim();

    return {
      matricula: str(r.matricula),
      dataOcorrencia: str(r.data_ocorrencia),
      categoria: str(r.categoria).trim() || "Outros motivos",
      motivo: str(r.motivo),
      status: isStatus(status) ? status : "Em Análise",
      observacaoLider: str(r.observacao_lider),
      autor: orNull(r.autor),
      avaliador: orNull(r.avaliador),
      avaliadoEm: orNull(r.avaliado_em),
      atualizadoEm: orNull(r.atualizado_em),
    };
  });
}

export function indexByDay(rows: Justificativa[]): Map<string, Justificativa> {
  return new Map(rows.map((j) => [dayKey(j.matricula, j.dataOcorrencia), j]));
}

// ── Diretório de pessoas (Tela 5) ─────────────────────────────────────────────

/**
 * Who each matrícula is, across the whole period — no filters applied.
 *
 * Tela 5 crosses justifications against this by matrícula and then filters in
 * memory, which is what lets a justification whose matrícula has no row in the
 * period stay visible instead of vanishing (the origin's `hasMeta` guard). Keeping
 * the query filter-free also makes it cacheable by period alone.
 */
export function fetchPessoas(from: string, to: string): Promise<PessoaMeta[]> {
  return q<PessoaMeta>(
    `SELECT CAST(matricula AS STRING) matricula,
            MAX(TRIM(consultor)) consultor,
            MAX(TRIM(cargo)) cargo,
            MAX(${CIDADE}) cidade,
            MAX(TRIM(coordenacao)) coordenacao,
            MAX(TRIM(gerente)) gerente,
            MAX(TRIM(supervisao)) supervisao,
            MAX(TRIM(lider)) lider,
            MAX(TRIM(canal)) canal,
            MAX(TRIM(nicho)) nicho
       FROM ${SOURCE}
      WHERE data BETWEEN DATE'${from}' AND DATE'${to}' AND matricula IS NOT NULL
      GROUP BY matricula`,
    [],
  );
}

// ── Montagem das views ────────────────────────────────────────────────────────

/**
 * Tela 4's view-model. The two halves arrive separately on purpose: the
 * zeroed-day scan is cached by the source watermark, the justifications are not
 * (see `fetchJustificativas`), and the join happens here where both are fresh.
 */
export function buildJustificar(
  regras: HcRegras,
  rows: ZeroedRow[],
  justificativas: Justificativa[],
): HcJustificarView {
  const pessoas = groupPessoas(rows, indexByDay(justificativas));

  return { regras, pessoas, stats: stats(pessoas) };
}

/**
 * Tela 5. The person filters are applied here, in memory, and only to the
 * justifications whose matrícula the period knows — an unknown matrícula stays
 * visible rather than being silently filtered out by a hierarchy it has no
 * attributes for.
 */
export function buildAuditar(
  f: HcFilters,
  justificativas: Justificativa[],
  pessoas: PessoaMeta[],
): HcAuditarView {
  const byMatricula = new Map(pessoas.map((p) => [p.matricula, p]));
  const rows: AuditoriaRow[] = [];

  for (const justificativa of justificativas) {
    const pessoa = byMatricula.get(justificativa.matricula) ?? null;

    if (pessoa && !matchesFilters(pessoa, f)) continue;

    rows.push({ justificativa, pessoa });
  }

  const categorias = [...new Set(rows.map((r) => r.justificativa.categoria))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
  const porStatus = {
    Todos: rows.length,
    "Em Análise": 0,
    Aprovado: 0,
    Rejeitado: 0,
  };

  for (const r of rows) porStatus[r.justificativa.status] += 1;

  return { rows, categorias, porStatus };
}

function matchesFilters(p: PessoaMeta, f: HcFilters): boolean {
  const has = (selected: string[], value: string) => selected.length === 0 || selected.includes(value);

  return (
    has(f.gerente, p.gerente) &&
    has(f.coordenacao, p.coordenacao) &&
    has(f.supervisao, p.supervisao) &&
    has(f.lider, p.lider) &&
    has(f.consultor, p.consultor) &&
    has(f.canal, p.canal) &&
    has(f.nicho, p.nicho) &&
    has(f.cidade, p.cidade) &&
    (!f.cross.vendedor || p.matricula === f.cross.vendedor) &&
    (!f.cross.gerencia || p.gerente === f.cross.gerencia) &&
    (!f.cross.coordenacao || p.coordenacao === f.cross.coordenacao) &&
    (!f.cross.canal || p.canal === f.cross.canal) &&
    (!f.cross.cidade || p.cidade === f.cross.cidade)
  );
}

function stats(pessoas: PessoaZerada[]): JustificarStats {
  let diasZerados = 0;
  let justificados = 0;
  let emAnalise = 0;
  let aprovados = 0;
  let rejeitados = 0;

  for (const p of pessoas) {
    for (const d of p.dias) {
      diasZerados += 1;

      if (!d.justificativa) continue;

      justificados += 1;

      if (d.justificativa.status === "Aprovado") aprovados += 1;
      else if (d.justificativa.status === "Rejeitado") rejeitados += 1;
      else emAnalise += 1;
    }
  }

  return {
    pessoas: pessoas.length,
    diasZerados,
    justificados,
    pendentes: diasZerados - justificados,
    emAnalise,
    aprovados,
    rejeitados,
    conclusao: diasZerados > 0 ? Math.round((justificados / diasZerados) * 100) : 0,
  };
}
