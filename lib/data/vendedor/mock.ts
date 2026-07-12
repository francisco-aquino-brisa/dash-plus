// Deterministic mock for the Dashboard Vendedor screen (Tela 4), shaped to the
// same VendedorView the Databricks adapter returns so the DATA_SOURCE swap stays
// transparent. Per-vendedor metas / plano mix / current orçamentos do not exist
// in the real base, so those stay under flags here too.

import { hashStr, mulberry32 } from "../_random";
import { resolveCompetencia, lastCompetencias } from "./dates";
import {
  AGUARDANDO_POR_SERVICO,
  type DiasZeradosView,
  type MixItem,
  type ServicoCard,
  type VendedorFilterOptions,
  type VendedorFilters,
  type VendedorProfile,
  type VendedorView,
} from "./types";

const NOMES = [
  "Ana Lima",
  "Bruno Sá",
  "Carla Dias",
  "Diego Melo",
  "Elaine Rocha",
  "Felipe Brito",
  "Gabriela Pires",
  "Heitor Vaz",
  "Igor Nunes",
  "Joana Reis",
  "Kelly Mota",
  "Lucas Aragão",
  "Marina Pinto",
  "Nilo Castro",
  "Olívia Ramos",
];
const CIDADES = [
  "Fortaleza / CE",
  "Sobral / CE",
  "Natal / RN",
  "João Pessoa / PB",
  "Recife / PE",
  "Maceió / AL",
  "Aracaju / SE",
  "Teresina / PI",
];
const CANAIS = ["PAP", "Loja", "Online", "NGC"];
const COORDS = ["Ceará Norte", "Ceará Sul", "RN Litoral", "PB Interior", "PE Capital"];
const GERENCIAS = ["G10", "G11", "G12", "G13"];
const SUPERVISORES = ["Natália Alves", "José Valmir", "Francisco Tiago", "Marcos Aurélio"];
const NICHOS = ["PAP Região Ceará Norte", "PAP Região Sergipe", "NGC Maceió", "NGC João Pessoa"];

/** 15 stable mock vendedores, matricula 10001..10015. */
function mockVendedores() {
  return NOMES.map((nome, i) => ({ matricula: 10001 + i, nome, cidade: CIDADES[i % CIDADES.length] }));
}

function mockProfile(mat: number): VendedorProfile | null {
  const idx = mat - 10001;

  if (!Number.isInteger(idx) || idx < 0 || idx >= NOMES.length) return null;

  const s = hashStr(NOMES[idx]);
  const anos = Math.floor(s * 4);
  const meses = Math.floor((s * 100) % 12);

  return {
    matricula: mat,
    nome: NOMES[idx],
    cidade: CIDADES[idx % CIDADES.length],
    uf: CIDADES[idx % CIDADES.length].split(" / ")[1] ?? "",
    canal: CANAIS[idx % CANAIS.length],
    gerente: ["Christiano Bomfim", "Rose Varejo", "Paulo Cesar", "Suiane Online"][idx % 4],
    coordenacao: COORDS[idx % COORDS.length],
    gerencia: GERENCIAS[idx % GERENCIAS.length],
    supervisao: SUPERVISORES[idx % SUPERVISORES.length],
    nicho: NICHOS[idx % NICHOS.length],
    nivel: idx % 5 === 0 ? "OPERADOR" : "VENDEDOR",
    situacao: "ATIVO",
    tipoCidade: ["ONLY", "HÍBRIDA", "FTTH"][idx % 3],
    tempoEmpresa: `${anos} anos ${meses} meses`,
    admissao: `${2026 - anos}-0${(idx % 8) + 1}-15`,
  };
}

function mockServiceCards(
  mat: number,
  rng: () => number,
): { servicos: ServicoCard[]; agg: Record<string, number> } {
  const base = 40 + Math.floor(hashStr(String(mat)) * 120);
  const gen = (mult: number) => {
    const criado = Math.round(base * mult * (0.8 + rng() * 0.6));
    const efetivado = Math.round(criado * (0.7 + rng() * 0.2));
    const instalado = Math.round(efetivado * (0.7 + rng() * 0.2));

    return { criado, efetivado, instalado };
  };
  const ftth = gen(1);
  const fwa = gen(0.5);
  const ativ5g = Math.round(base * 0.6 * (0.8 + rng() * 0.6));
  const renov = Math.round(base * 0.4 * (0.8 + rng() * 0.6));
  const bl = {
    criado: ftth.criado + fwa.criado,
    efetivado: ftth.efetivado + fwa.efetivado,
    instalado: ftth.instalado + fwa.instalado,
  };
  const ndu = 18 + Math.floor(rng() * 4);

  const mk = (
    key: ServicoCard["key"],
    f: { criado: number; efetivado: number; instalado: number },
    realizadoForPdu: number,
    indicadores: ServicoCard["indicadores"],
  ): ServicoCard => ({
    key,
    label: key,
    realizado: f.instalado,
    pdu: +(realizadoForPdu / ndu).toFixed(2),
    ndu,
    criado: f.criado,
    efetivado: f.efetivado,
    instalado: f.instalado,
    indicadores,
    aguardando: AGUARDANDO_POR_SERVICO[key],
    metaAvailable: false,
  });
  const funnel = (f: { criado: number; efetivado: number; instalado: number }) => [
    { label: "Vendas Criadas", realizado: f.criado, meta: null },
    { label: "Vendas Efetivadas", realizado: f.efetivado, meta: null },
    { label: "Vendas Instaladas", realizado: f.instalado, meta: null },
  ];

  const servicos = [
    mk("FTTH", ftth, ftth.instalado, funnel(ftth)),
    mk("FWA", fwa, fwa.instalado, funnel(fwa)),
    mk("5G", { criado: 0, efetivado: 0, instalado: ativ5g }, ativ5g, [
      { label: "Vendas Ativadas 5G", realizado: ativ5g, meta: null },
    ]),
    mk("Banda", bl, bl.instalado, funnel(bl)),
  ];

  return {
    servicos,
    agg: {
      cFtth: ftth.criado,
      eFtth: ftth.efetivado,
      iFtth: ftth.instalado,
      cFwa: fwa.criado,
      eFwa: fwa.efetivado,
      iFwa: fwa.instalado,
      ativ5g,
      renov,
    },
  };
}

function mockMix(agg: Record<string, number>): MixItem[] {
  return [
    { servico: "FTTH", status: "Criado", vendas: agg.cFtth },
    { servico: "FTTH", status: "Efetivado", vendas: agg.eFtth },
    { servico: "FTTH", status: "Instalado", vendas: agg.iFtth },
    { servico: "FWA", status: "Criado", vendas: agg.cFwa },
    { servico: "FWA", status: "Efetivado", vendas: agg.eFwa },
    { servico: "FWA", status: "Instalado", vendas: agg.iFwa },
    { servico: "5G", status: "Instalado", vendas: agg.ativ5g },
    { servico: "Renovação", status: "Instalado", vendas: agg.renov },
  ].filter((i) => i.vendas > 0) as MixItem[];
}

function mockDiasZerados(
  mat: number,
  ano: number,
  mes: number,
  hojeDia: number | null,
  rng: () => number,
): DiasZeradosView {
  const lastDay = new Date(ano, mes, 0).getDate();
  const upto = hojeDia ?? lastDay;
  const keys = ["Todos", "FTTH", "FWA", "5G", "Banda"] as const;
  const zeradosPorServico: Record<string, number[]> = {};
  const comVendaPorServico: Record<string, number[]> = {};
  for (const k of keys) {
    zeradosPorServico[k] = [];
    comVendaPorServico[k] = [];
  }
  for (let d = 1; d <= upto; d++) {
    const dow = new Date(ano, mes - 1, d).getDay();

    if (dow === 0) continue; // Sundays not counted as working days in the mock

    for (const k of keys) {
      const zeroed = rng() < (k === "Todos" ? 0.12 : 0.25);
      (zeroed ? zeradosPorServico : comVendaPorServico)[k].push(d);
    }
  }
  const resumo = keys.map((k) => ({
    servico: k,
    dias: zeradosPorServico[k].length,
  })) as DiasZeradosView["resumo"];

  return { ano, mes, hoje: hojeDia, resumo, zeradosPorServico, comVendaPorServico };
}

function mockRanking(mat: number, profile: VendedorProfile) {
  const s = hashStr(String(mat));
  const pos = (n: number) => Math.max(1, Math.round(s * n));

  return {
    available: true,
    metrica: "Mix (BL + 5G) no período",
    escopos: [
      { escopo: "cidade" as const, label: "Cidade", contexto: profile.cidade, posicao: pos(8), total: 12 },
      {
        escopo: "coordenacao" as const,
        label: "Coordenação",
        contexto: profile.coordenacao,
        posicao: pos(40),
        total: 68,
      },
      {
        escopo: "gerencia" as const,
        label: "Gerência",
        contexto: profile.gerencia,
        posicao: pos(120),
        total: 210,
      },
      { escopo: "geral" as const, label: "Geral", contexto: "Brisanet", posicao: pos(900), total: 1480 },
    ],
  };
}

export function mockVendedorView(filters: VendedorFilters): VendedorView {
  const period = resolveCompetencia(filters.competencia);
  const mat = parseInt(filters.matricula, 10);
  const empty: VendedorView = {
    source: "mock",
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
    watermark: "mock:vendedor",
  };
  const profile = Number.isNaN(mat) ? null : mockProfile(mat);

  if (!profile) return empty;

  const rng = mulberry32((mat * 1000 + period.mes) >>> 0);
  const { servicos, agg } = mockServiceCards(mat, rng);

  return {
    source: "mock",
    filters,
    competenciaLabel: period.label,
    profile,
    servicos,
    diasZerados: mockDiasZerados(mat, period.ano, period.mes, period.hojeDia, rng),
    ranking: mockRanking(mat, profile),
    mix: mockMix(agg),
    pendenciasAvailable: false,
    watermark: "mock:vendedor",
  };
}

export function mockVendedorFilterOptions(): VendedorFilterOptions {
  return { vendedores: mockVendedores(), competencias: lastCompetencias(6) };
}
