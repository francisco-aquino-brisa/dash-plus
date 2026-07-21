// Deterministic mock for the Dashboard Vendedor screen (Tela 4), shaped to the
// same VendedorView the Databricks adapter returns so the DATA_SOURCE swap stays
// transparent. Per-vendedor metas / plano mix / current orçamentos do not exist
// in the real base, so those stay under flags here too.

import { hashStr, mulberry32 } from "../_random";
import { resolveCompetencia, lastCompetencias } from "./dates";
import {
  type DiasZeradosView,
  type IndicadorFormato,
  type IndicadorVM,
  type MixOferta,
  type ServicoCard,
  type VendedorFilterOptions,
  type VendedorFilters,
  type VendedorProfile,
  type VendedorView,
} from "./types";

/** Build a mock IndicadorVM, mirroring the shape the Databricks path returns. */
function mkInd(
  id: string,
  label: string,
  formato: IndicadorFormato,
  polaridade: "up" | "down",
  meta: number,
  realizado: number,
  disponivel = true,
): IndicadorVM {
  const real = disponivel ? realizado : 0;
  const atingimento = disponivel && meta > 0 ? (real / meta) * 100 : 0;
  const falta = disponivel && polaridade === "up" ? Math.max(meta - real, 0) : 0;

  return { id, label, meta, realizado: real, atingimento, falta, formato, polaridade, disponivel };
}

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
    indicadores: IndicadorVM[],
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
  });

  // meta ≈ base value, realizado a fraction/multiple of it (deterministic rng).
  const p = (base: number) => {
    const meta = Math.max(1, Math.round(base));

    return [meta, Math.round(meta * (0.4 + rng() * 0.9))] as const;
  };

  const servicos = [
    mk("FTTH", ftth, ftth.instalado, [
      mkInd("VE03", "Vendas Instaladas - FTTH", "qtd", "up", ...p(ftth.instalado)),
      mkInd("VE15", "Vendas instaladas Combo 1 Chip - FTTH", "qtd", "up", ...p(ftth.instalado * 0.5)),
      mkInd("VE49", "Vendas instaladas avulso - FTTH", "qtd", "up", ...p(ftth.instalado * 0.4)),
      mkInd("VE30", "Renovação Geral", "qtd", "up", ...p(ftth.instalado * 0.9)),
      mkInd("VE52", "Renovação Incremento de Receita", "R$", "up", 800, 620 + Math.round(rng() * 900)),
      mkInd("RE02", "Ticket Médio Oferta - FTTH", "R$", "up", 85, 84 + Math.round(rng() * 14)),
      mkInd("CA08", "Churn Safra - FTTH", "%", "down", 0.15, +(0.03 + rng() * 0.1).toFixed(3)),
    ]),
    mk("FWA", fwa, fwa.instalado, [
      mkInd("VE03", "Vendas Instaladas - FWA", "qtd", "up", ...p(fwa.instalado)),
    ]),
    mk("5G", { criado: 0, efetivado: 0, instalado: ativ5g }, ativ5g, [
      mkInd("VE04", "Vendas Ativadas - 5G", "qtd", "up", ...p(ativ5g)),
      mkInd("VE51", "Ativação 5G avulso", "qtd", "up", ...p(ativ5g * 0.7)),
      mkInd("RE02", "Ticket Médio Oferta - 5G", "R$", "up", 29, 26 + Math.round(rng() * 10)),
      mkInd("CA10", "Churn Safra com Bloqueio - 5G", "%", "down", 0.15, +(0.05 + rng() * 0.12).toFixed(3)),
      // Portabilidade (VE32): fonte portabilidade_5g ainda sem acesso → indisponível.
      mkInd("VE32", "Portabilidade", "qtd", "up", 30, 0, false),
    ]),
    mk("Banda", bl, bl.instalado, [
      mkInd("VE49", "Vendas instaladas avulso - Banda Larga", "qtd", "up", ...p(bl.instalado)),
      mkInd("RE01", "Ticket Médio Entrada - Banda Larga", "R$", "up", 80, 78 + Math.round(rng() * 14)),
    ]),
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

function mockMix(agg: Record<string, number>): MixOferta[] {
  const out: MixOferta[] = [];

  const add = (titulo: string, servico: MixOferta["servico"], c: number, e: number, i: number) => {
    if (c > 0) out.push({ titulo, servico, status: "Criado", vendas: c });

    if (e > 0) out.push({ titulo, servico, status: "Efetivado", vendas: e });

    if (i > 0) out.push({ titulo, servico, status: "Instalado", vendas: i });
  };

  add("OFERTA COMBO 500MB ESSENCIAL C/ APPS", "FTTH", agg.cFtth, agg.eFtth, agg.iFtth);
  add("OFERTA PF 700MB COMBO FAMÍLIA", "FWA", agg.cFwa, agg.eFwa, agg.iFwa);
  add("OFERTA COMBO 20GB ESSENCIAL", "5G", 0, 0, agg.ativ5g);

  return out;
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
