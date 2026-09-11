// Databricks adapter for the Matriz Gerencial screen (Tela 3).
//
// Unlike the other screens this one answers about a SINGLE day — the range's
// end. The period still matters: it draws the sparkline in the Cidade view and
// decides which rows the scan reads. Everything comes from the person × day
// grain the Desempenho screen already pulls, so this is one query.

import { dateRangeList, dayLabel, isWeekend, previousDay } from "./dates";
import { applyGroupCross, fetchPersonDay, regional, zeradoByDay, type PersonDay } from "./person-day";
import type { DayAxis, HcFilters, HcMatrizView, OciosidadeGrouping, OciosidadeGroup } from "./types";

export async function databricksHcMatriz(f: HcFilters, grouping: OciosidadeGrouping): Promise<HcMatrizView> {
  const all = await fetchPersonDay(f);
  // The regional table keeps every group visible when one is clicked; the cards
  // read the narrowed set. Same split as Bloco 4.
  const ofPeriod = all.filter((r) => r.d >= f.from);
  const personDay = applyGroupCross(all, f).filter((r) => r.d >= f.from);
  const byDay = new Map<string, PersonDay[]>();

  for (const r of personDay) byDay.set(r.d, [...(byDay.get(r.d) ?? []), r]);

  const periodDays = dateRangeList(f.from, f.to);
  const holiday = new Map(zeradoByDay(byDay, periodDays).map((z) => [z.data, z.feriado]));
  const days: DayAxis[] = periodDays.map((data) => ({
    data,
    label: dayLabel(data),
    feriado: holiday.get(data) ?? false,
    fimDeSemana: isWeekend(data),
  }));

  return {
    d0: f.to,
    days,
    grupos: grouping === "cidade" ? [] : ociosidade(personDay, grouping, f.to),
    cidades: grouping === "cidade" ? regional(ofPeriod, (r) => r.cidade, days, f.to, previousDay(f.to)) : [],
  };
}

/**
 * One card per group: who was active on `d0`, who sold that day and who did not.
 *
 * The reference day is the range's end, exactly as in the origin — so a day the
 * warehouse has only half-loaded reads as idleness. The card prints its active
 * headcount for that reason: a number far below the usual is the tell.
 */
function ociosidade(rows: PersonDay[], grouping: OciosidadeGrouping, d0: string): OciosidadeGroup[] {
  const groupOf = (r: PersonDay) => (grouping === "gerencia" ? r.gerente : r.coordenacao);
  const detailOf = (r: PersonDay) => (grouping === "gerencia" ? r.coordenacao : r.cidade);
  const groups = new Map<string, Map<string, { vendas: number; person: PersonDay }>>();

  for (const r of rows) {
    if (r.d !== d0 || r.ativo !== 1 || !r.k) continue;

    const nome = groupOf(r) || "Sem Regional";
    const people = groups.get(nome) ?? new Map<string, { vendas: number; person: PersonDay }>();
    const current = people.get(r.k);

    people.set(r.k, { vendas: (current?.vendas ?? 0) + r.v, person: current?.person ?? r });
    groups.set(nome, people);
  }

  return [...groups.entries()]
    .map(([nome, people]) => {
      const zerados: OciosidadeGroup["zerados"] = [];
      let totalVenderam = 0;

      for (const { vendas, person } of people.values()) {
        if (vendas > 0) totalVenderam += 1;
        else
          zerados.push({
            matricula: person.matricula ?? "",
            consultor: person.consultor || "Sem nome",
            detalhe: detailOf(person) || "—",
          });
      }

      const totalAtivo = people.size;

      return {
        nome,
        totalAtivo,
        totalVenderam,
        totalZerado: zerados.length,
        pctZerado: totalAtivo > 0 ? +((zerados.length / totalAtivo) * 100).toFixed(1) : 0,
        zerados: zerados.sort((a, b) => a.consultor.localeCompare(b.consultor, "pt-BR")),
      };
    })
    .sort((a, b) => b.pctZerado - a.pctZerado || a.nome.localeCompare(b.nome, "pt-BR"));
}
