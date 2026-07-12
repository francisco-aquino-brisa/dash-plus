// Databricks adapter for the Dashboard Vendedor screen (Tela 4). Read-only,
// aggregated in SQL (ADR 0002), scoped to a single vendedor by matricula.
// Sources:
//   - desempenho_hc         → profile, per-tech funnel, renovação, ranking, mix, dias
//   - vw_hc_zerado_vendedor → official PDU + NDU (dias úteis) per serviço
// matricula is a validated integer and dates are app-generated ISO → safe to
// inline (same convention as the produtividade adapter).

import { getDataClient } from "../client";
import { num } from "../_shared";
import { resolveCompetencia } from "./dates";
import {
  AGUARDANDO_POR_SERVICO,
  SERVICOS,
  type DiasZeradosView,
  type MixItem,
  type RankingView,
  type ServicoCard,
  type VendedorFilterOptions,
  type VendedorFilters,
  type VendedorProfile,
  type VendedorView,
} from "./types";

const CAT = process.env.DATABRICKS_SALES_CATALOG ?? "gdb_brisanet_comunidade_dev";
const SCHEMA = process.env.DATABRICKS_SALES_SCHEMA ?? "diego_barros_inteligencia_comercial_e_mercado";
const DH = `\`${CAT}\`.\`${SCHEMA}\`.\`desempenho_hc\``;
const VW = `\`${CAT}\`.\`projeto_brisa_performance\`.\`vw_hc_zerado_vendedor\``;

const q = <T = Record<string, unknown>>(sql: string) => getDataClient().query<T>(sql);
const str = (v: unknown): string => (v == null || v === "" ? "" : String(v));

export async function databricksVendedorWatermark(): Promise<string> {
  try {
    const r = await q<{ wm: string }>(`SELECT CAST(MAX(data) AS STRING) wm FROM ${DH}`);

    return r[0]?.wm ?? "unknown";
  } catch {
    return "unknown";
  }
}

async function fetchProfile(mat: number, from: string, to: string): Promise<VendedorProfile | null> {
  const rows = await q(`
    SELECT MATRICULA, NOME, cidade_atuacao_jwas cidade, UF,
      COALESCE(GERENTE_CANAL, GERENTE_ORG) gerente, COORDENACAO, GERENCIA,
      RESPSUPERVISAO supervisao, nicho, COALESCE(canal_jwas, canal_waves) canal,
      nivel, situacao_jwas situacao, TIPO_CIDADE, TEMPO_EMPRESA,
      CAST(CAST(ADMISSAO AS DATE) AS STRING) admissao
    FROM ${DH}
    WHERE MATRICULA = ${mat} AND data BETWEEN DATE'${from}' AND DATE'${to}'
    ORDER BY data DESC LIMIT 1
  `);
  const r = rows[0];

  if (!r) return null;

  return {
    matricula: num(r.MATRICULA),
    nome: str(r.NOME) || "—",
    cidade: str(r.cidade) || "—",
    uf: str(r.UF),
    canal: str(r.canal) || "—",
    gerente: str(r.gerente) || "—",
    coordenacao: str(r.COORDENACAO) || "—",
    gerencia: str(r.GERENCIA) || "—",
    supervisao: str(r.supervisao) || "—",
    nicho: str(r.nicho) || "—",
    nivel: str(r.nivel) || "—",
    situacao: str(r.situacao) || "—",
    tipoCidade: str(r.TIPO_CIDADE) || "—",
    tempoEmpresa: str(r.TEMPO_EMPRESA) || "—",
    admissao: str(r.admissao),
  };
}

interface ServiceAgg {
  cFtth: number;
  eFtth: number;
  iFtth: number;
  cFwa: number;
  eFwa: number;
  iFwa: number;
  cBl: number;
  eBl: number;
  iBl: number;
  ativ5g: number;
  renov: number;
}

async function fetchServiceAgg(mat: number, from: string, to: string): Promise<ServiceAgg> {
  const rows = await q(`
    SELECT
      SUM(criado_ftth) c_ftth, SUM(efetivado_ftth) e_ftth, SUM(instalado_ftth) i_ftth,
      SUM(criado_fwa) c_fwa, SUM(efetivado_fwa) e_fwa, SUM(instalado_fwa) i_fwa,
      SUM(criado_bl) c_bl, SUM(efetivado_bl) e_bl, SUM(instalado_bl) i_bl,
      SUM(\`5g_ativacao\`) ativ5g, SUM(total_renovacao) renov
    FROM ${DH}
    WHERE MATRICULA = ${mat} AND data BETWEEN DATE'${from}' AND DATE'${to}'
  `);
  const r = rows[0] ?? {};

  return {
    cFtth: num(r.c_ftth),
    eFtth: num(r.e_ftth),
    iFtth: num(r.i_ftth),
    cFwa: num(r.c_fwa),
    eFwa: num(r.e_fwa),
    iFwa: num(r.i_fwa),
    cBl: num(r.c_bl),
    eBl: num(r.e_bl),
    iBl: num(r.i_bl),
    ativ5g: num(r.ativ5g),
    renov: num(r.renov),
  };
}

/** PDU + NDU per serviço from the official view (light: single matricula). */
async function fetchPdu(
  mat: number,
  ym: string,
): Promise<Record<string, { pdu: number; ndu: number; realizado: number }>> {
  const out: Record<string, { pdu: number; ndu: number; realizado: number }> = {};

  try {
    const rows = await q(`
      SELECT servico, MAX(dias_uteis_acumulado) ndu, SUM(total_realizado) realizado
      FROM ${VW}
      WHERE matricula = ${mat} AND date_format(data, 'yyyy-MM') = '${ym}'
      GROUP BY servico
    `);

    for (const r of rows) {
      const svc = str(r.servico);
      const ndu = num(r.ndu);
      const realizado = num(r.realizado);

      out[svc] = { ndu, realizado, pdu: ndu > 0 ? +(realizado / ndu).toFixed(2) : 0 };
    }
  } catch {
    /* view can time out — cards still render without PDU */
  }

  return out;
}

function buildServiceCards(
  agg: ServiceAgg,
  pdu: Record<string, { pdu: number; ndu: number }>,
): ServicoCard[] {
  const nduAny = pdu.FTTH?.ndu || pdu.FWA?.ndu || pdu["5G"]?.ndu || 0;
  const mk = (
    key: ServicoCard["key"],
    criado: number,
    efetivado: number,
    instalado: number,
    pduKey: string,
    indicadores: ServicoCard["indicadores"],
  ): ServicoCard => ({
    key,
    label: key,
    realizado: instalado,
    pdu: pdu[pduKey]?.pdu ?? 0,
    ndu: pdu[pduKey]?.ndu ?? nduAny,
    criado,
    efetivado,
    instalado,
    indicadores,
    aguardando: AGUARDANDO_POR_SERVICO[key],
    metaAvailable: false,
  });

  const funnel = (c: number, e: number, i: number) => [
    { label: "Vendas Criadas", realizado: c, meta: null },
    { label: "Vendas Efetivadas", realizado: e, meta: null },
    { label: "Vendas Instaladas", realizado: i, meta: null },
  ];

  return [
    mk("FTTH", agg.cFtth, agg.eFtth, agg.iFtth, "FTTH", funnel(agg.cFtth, agg.eFtth, agg.iFtth)),
    mk("FWA", agg.cFwa, agg.eFwa, agg.iFwa, "FWA", funnel(agg.cFwa, agg.eFwa, agg.iFwa)),
    mk("5G", 0, 0, agg.ativ5g, "5G", [{ label: "Vendas Ativadas 5G", realizado: agg.ativ5g, meta: null }]),
    mk("Banda", agg.cBl, agg.eBl, agg.iBl, "Banda", funnel(agg.cBl, agg.eBl, agg.iBl)),
  ];
}

function buildMix(agg: ServiceAgg): MixItem[] {
  const items: MixItem[] = [
    { servico: "FTTH", status: "Criado", vendas: agg.cFtth },
    { servico: "FTTH", status: "Efetivado", vendas: agg.eFtth },
    { servico: "FTTH", status: "Instalado", vendas: agg.iFtth },
    { servico: "FWA", status: "Criado", vendas: agg.cFwa },
    { servico: "FWA", status: "Efetivado", vendas: agg.eFwa },
    { servico: "FWA", status: "Instalado", vendas: agg.iFwa },
    { servico: "5G", status: "Instalado", vendas: agg.ativ5g },
    { servico: "Renovação", status: "Instalado", vendas: agg.renov },
  ];

  return items.filter((i) => i.vendas > 0);
}

async function fetchDiasZerados(
  mat: number,
  from: string,
  to: string,
  ym: string,
  hojeDia: number | null,
): Promise<DiasZeradosView> {
  const [y, m] = ym.split("-").map((s) => parseInt(s, 10));
  const rows = await q(`
    SELECT day(data) dia, MAX(feriado) feriado,
      SUM(criado_ftth + efetivado_ftth + instalado_ftth) r_ftth,
      SUM(criado_fwa + efetivado_fwa + instalado_fwa) r_fwa,
      SUM(\`5g_ativacao\`) r_5g,
      SUM(criado_bl + efetivado_bl + instalado_bl) r_banda,
      SUM(criado_bl + efetivado_bl + instalado_bl + \`5g_ativacao\` + total_renovacao) r_tot
    FROM ${DH}
    WHERE MATRICULA = ${mat} AND data BETWEEN DATE'${from}' AND DATE'${to}'
    GROUP BY day(data)
  `);

  const keys = ["Todos", "FTTH", "FWA", "5G", "Banda"] as const;
  const zeradosPorServico: Record<string, number[]> = {};
  const comVendaPorServico: Record<string, number[]> = {};

  for (const k of keys) {
    zeradosPorServico[k] = [];
    comVendaPorServico[k] = [];
  }

  for (const r of rows) {
    const dia = num(r.dia);
    const feriado = str(r.feriado).toUpperCase() === "SIM";

    if (feriado) continue; // holidays are not "zerado"

    const vals: Record<string, number> = {
      Todos: num(r.r_tot),
      FTTH: num(r.r_ftth),
      FWA: num(r.r_fwa),
      "5G": num(r.r_5g),
      Banda: num(r.r_banda),
    };

    for (const k of keys) {
      if (vals[k] > 0) comVendaPorServico[k].push(dia);
      else zeradosPorServico[k].push(dia);
    }
  }

  const resumo = keys.map((k) => ({
    servico: k,
    dias: zeradosPorServico[k].length,
  })) as DiasZeradosView["resumo"];

  return { ano: y, mes: m, hoje: hojeDia, resumo, zeradosPorServico, comVendaPorServico };
}

async function fetchRanking(mat: number, from: string, to: string): Promise<RankingView> {
  try {
    const r = (
      await q(`
      WITH agg AS (
        SELECT MATRICULA,
          MAX(cidade_atuacao_jwas) cidade, MAX(COORDENACAO) coord, MAX(GERENCIA) ger,
          SUM(criado_bl + efetivado_bl + instalado_bl + \`5g_ativacao\`) score
        FROM ${DH}
        WHERE data BETWEEN DATE'${from}' AND DATE'${to}'
        GROUP BY MATRICULA
      ),
      ranked AS (
        SELECT MATRICULA, cidade, coord, ger, score,
          RANK() OVER (PARTITION BY cidade ORDER BY score DESC) r_cidade,
          COUNT(*) OVER (PARTITION BY cidade) n_cidade,
          RANK() OVER (PARTITION BY coord ORDER BY score DESC) r_coord,
          COUNT(*) OVER (PARTITION BY coord) n_coord,
          RANK() OVER (PARTITION BY ger ORDER BY score DESC) r_ger,
          COUNT(*) OVER (PARTITION BY ger) n_ger,
          RANK() OVER (ORDER BY score DESC) r_geral,
          COUNT(*) OVER () n_geral
        FROM agg
      )
      SELECT cidade, coord, ger, r_cidade, n_cidade, r_coord, n_coord,
        r_ger, n_ger, r_geral, n_geral
      FROM ranked WHERE MATRICULA = ${mat}
    `)
    )[0];

    if (!r) return { available: false, metrica: "Mix (BL + 5G) efetivado no período", escopos: [] };

    const esc = (
      escopo: RankingView["escopos"][number]["escopo"],
      label: string,
      contexto: string,
      pos: unknown,
      total: unknown,
    ) => ({
      escopo,
      label,
      contexto: contexto || "—",
      posicao: contexto ? num(pos) : null,
      total: num(total),
    });

    return {
      available: true,
      metrica: "Mix (BL + 5G) no período",
      escopos: [
        esc("cidade", "Cidade", str(r.cidade), r.r_cidade, r.n_cidade),
        esc("coordenacao", "Coordenação", str(r.coord), r.r_coord, r.n_coord),
        esc("gerencia", "Gerência", str(r.ger), r.r_ger, r.n_ger),
        {
          escopo: "geral",
          label: "Geral",
          contexto: "Brisanet",
          posicao: num(r.r_geral),
          total: num(r.n_geral),
        },
      ],
    };
  } catch {
    return { available: false, metrica: "Mix (BL + 5G) no período", escopos: [] };
  }
}

export async function databricksVendedorView(filters: VendedorFilters): Promise<VendedorView> {
  const period = resolveCompetencia(filters.competencia);
  const mat = parseInt(filters.matricula, 10);
  const watermark = await databricksVendedorWatermark();

  const empty: VendedorView = {
    source: "databricks",
    filters,
    competenciaLabel: period.label,
    profile: null,
    servicos: [],
    diasZerados: {
      ano: period.ano,
      mes: period.mes,
      hoje: period.hojeDia,
      resumo: [],
      zeradosPorServico: {},
      comVendaPorServico: {},
    },
    ranking: { available: false, metrica: "", escopos: [] },
    mix: [],
    pendenciasAvailable: false,
    watermark,
  };

  if (!Number.isFinite(mat)) return empty;

  const profile = await fetchProfile(mat, period.from, period.to);

  if (!profile) return empty; // matricula not present in this competência

  const [agg, pdu, diasZerados, ranking] = await Promise.all([
    fetchServiceAgg(mat, period.from, period.to),
    fetchPdu(mat, period.ym),
    fetchDiasZerados(mat, period.from, period.to, period.ym, period.hojeDia),
    fetchRanking(mat, period.from, period.to),
  ]);

  return {
    source: "databricks",
    filters,
    competenciaLabel: period.label,
    profile,
    servicos: buildServiceCards(agg, pdu),
    diasZerados,
    ranking,
    mix: buildMix(agg),
    pendenciasAvailable: false,
    watermark,
  };
}

export async function databricksVendedorFilterOptions(ym: string): Promise<Partial<VendedorFilterOptions>> {
  const period = resolveCompetencia(ym);
  const [vendedores, competencias] = await Promise.all([
    (async () => {
      try {
        const rows = await q(`
          SELECT MATRICULA, MAX(NOME) nome, MAX(cidade_atuacao_jwas) cidade
          FROM ${DH}
          WHERE data BETWEEN DATE'${period.from}' AND DATE'${period.to}' AND NOME IS NOT NULL
          GROUP BY MATRICULA ORDER BY nome LIMIT 3000
        `);

        return rows.map((r) => ({
          matricula: num(r.MATRICULA),
          nome: str(r.nome),
          cidade: str(r.cidade) || "—",
        }));
      } catch {
        return [];
      }
    })(),
    (async () => {
      try {
        const rows = await q(
          `SELECT DISTINCT date_format(data, 'yyyy-MM') ym FROM ${DH} ORDER BY ym DESC LIMIT 24`,
        );

        return rows.map((r) => str(r.ym)).filter(Boolean);
      } catch {
        return [];
      }
    })(),
  ]);

  return { vendedores, competencias };
}
