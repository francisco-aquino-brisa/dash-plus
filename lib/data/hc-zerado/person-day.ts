// The person × day grain — one row per person, per day, per management tuple —
// and the blocks derived straight from it. Shared by the Desempenho screen and
// the Matriz Gerencial, which read the same scan for different questions.

import { num } from "../_shared";
import { ATIVO, FERIADO, HC_KEY, CIDADE, SOURCE, q } from "./source";
import { hcWhere, vendasExpr } from "./filters";
import { dayLabel, previousDay } from "./dates";
import type { DayAxis, HcFilters, RegionalRow, ZeradoDay } from "./types";

/** `base` CTE: every row in the period that survives the row-level filters. */
export function baseCte(
  f: HcFilters,
  params: unknown[],
  skipCross: Parameters<typeof hcWhere>[2] = [],
): string {
  return `base AS (
    SELECT * FROM ${SOURCE}
    WHERE data BETWEEN DATE'${f.from}' AND DATE'${f.to}'${hcWhere(f, params, skipCross)}
  )`;
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
export interface PersonDay {
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

export async function fetchPersonDay(f: HcFilters): Promise<PersonDay[]> {
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
           ${CIDADE} cidade,
           MAX(consultor) consultor,
           MAX(canal) canal,
           MAX(situacao) situacao
    FROM base
    GROUP BY data, ${HC_KEY}, CAST(matricula AS STRING),
             COALESCE(NULLIF(TRIM(gerente), ''), 'Sem Regional'),
             COALESCE(NULLIF(TRIM(coordenacao), ''), 'Sem Regional'),
             ${CIDADE}`;

  const rows = await q<PersonDay>(sql, params);

  return rows.map((r) => ({ ...r, ativo: num(r.ativo), feriado: num(r.feriado), v: num(r.v) }));
}

/** Drop the rows the regional scan deliberately kept (see `fetchPessoaDia`). */
export function applyGroupCross(rows: PersonDay[], f: HcFilters): PersonDay[] {
  const { gerencia, coordenacao, cidade } = f.cross;

  if (!gerencia && !coordenacao && !cidade) return rows;

  return rows.filter(
    (r) =>
      (!gerencia || r.gerente === gerencia) &&
      (!coordenacao || r.coordenacao === coordenacao) &&
      (!cidade || r.cidade === cidade),
  );
}

/** Active HC and zeroed HC for one day, deduplicated by person. */
export function countDay(rows: PersonDay[]): { ativos: number; zerados: number } {
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
export function zeradoByDay(byDay: Map<string, PersonDay[]>, days: string[]): ZeradoDay[] {
  return days.map((data) => {
    const ofDay = byDay.get(data) ?? [];
    const { ativos, zerados } = countDay(ofDay);

    return {
      data,
      label: dayLabel(data),
      ativos,
      zerados,
      ativosRestantes: Math.max(0, ativos - zerados),
      pctZerado: ativos > 0 ? +((zerados / ativos) * 100).toFixed(1) : 0,
      feriado: ofDay.some((r) => r.feriado === 1),
    };
  });
}

/** Bloco 4 / Matriz Gerencial — one row per management group. */
export function regional(
  rows: PersonDay[],
  key: (r: PersonDay) => string,
  days: DayAxis[],
  d0: string,
  d1: string,
): RegionalRow[] {
  const groups = new Map<string, Map<string, PersonDay[]>>();

  for (const r of rows) {
    const nome = key(r) || "Sem Regional";
    const byDay = groups.get(nome) ?? new Map<string, PersonDay[]>();

    byDay.set(r.d, [...(byDay.get(r.d) ?? []), r]);
    groups.set(nome, byDay);
  }

  return [...groups.entries()]
    .map(([nome, byDay]) => {
      const activeToday = new Map<string, number>();

      for (const r of byDay.get(d0) ?? []) {
        if (r.k && r.ativo === 1) activeToday.set(r.k, (activeToday.get(r.k) ?? 0) + r.v);
      }

      const totalAtivo = activeToday.size;
      let totalWithSales = 0;

      for (const v of activeToday.values()) if (v > 0) totalWithSales += 1;

      const totalZerado = totalAtivo - totalWithSales;
      const yesterday = countDay(byDay.get(d1) ?? []);

      return {
        id: nome,
        nome,
        totalAtivo,
        totalWithSales,
        pctVendeu: totalAtivo > 0 ? Math.round((totalWithSales / totalAtivo) * 100) : 0,
        totalZerado,
        pctZerado: totalAtivo > 0 ? Math.round((totalZerado / totalAtivo) * 100) : 0,
        countZeradoD0: totalZerado,
        countZeradoD1: yesterday.zerados,
        d1Status:
          totalZerado < yesterday.zerados
            ? ("melhora" as const)
            : totalZerado > yesterday.zerados
              ? ("piora" as const)
              : ("estavel" as const),
        serieZerados: days.map((day) => countDay(byDay.get(day.data) ?? []).zerados),
      };
    })
    .sort((a, b) => b.totalZerado - a.totalZerado);
}
