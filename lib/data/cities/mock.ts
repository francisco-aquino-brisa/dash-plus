// Deterministic mock for the Cities screen, shaped to the REAL
// `indicadores_cidades` schema so the swap to Databricks is transparent
// (see ADR 0002). Seeded RNG keeps values stable across renders.
//
// Honors the real tipo_cidade → tecnologia rule:
//   FTTH    → FTTH only
//   ONLY    → 5G only
//   HÍBRIDA → FTTH + FWA + 5G

import { mulberry32 } from "../_random";
import type { CityDataset, CityIndicatorRecord, CityMetaRecord, Tecnologia, TipoCidade } from "./types";

interface CityDef {
  nome: string;
  uf: string;
  tipo: TipoCidade;
  gerencia: string;
  coordenacao: string;
}

const CITIES: CityDef[] = [
  { nome: "Fortaleza", uf: "CE", tipo: "HÍBRIDA", gerencia: "Ceará", coordenacao: "Fortaleza" },
  { nome: "Sobral", uf: "CE", tipo: "HÍBRIDA", gerencia: "Ceará", coordenacao: "Ceará Norte" },
  { nome: "Juazeiro do Norte", uf: "CE", tipo: "HÍBRIDA", gerencia: "Ceará", coordenacao: "Cariri" },
  { nome: "Crato", uf: "CE", tipo: "FTTH", gerencia: "Ceará", coordenacao: "Cariri" },
  { nome: "Iguatu", uf: "CE", tipo: "ONLY", gerencia: "Ceará", coordenacao: "Centro Sul" },
  { nome: "Nova Russas", uf: "CE", tipo: "ONLY", gerencia: "Ceará", coordenacao: "Ibiapaba" },
  { nome: "Natal", uf: "RN", tipo: "HÍBRIDA", gerencia: "Rio Grande do Norte", coordenacao: "RN Litoral" },
  { nome: "Mossoró", uf: "RN", tipo: "HÍBRIDA", gerencia: "Rio Grande do Norte", coordenacao: "RN Oeste" },
  {
    nome: "Pau dos Ferros",
    uf: "RN",
    tipo: "ONLY",
    gerencia: "Rio Grande do Norte",
    coordenacao: "Alto Oeste",
  },
  { nome: "Macaíba", uf: "RN", tipo: "HÍBRIDA", gerencia: "Rio Grande do Norte", coordenacao: "RN Litoral" },
  { nome: "João Pessoa", uf: "PB", tipo: "HÍBRIDA", gerencia: "Paraíba", coordenacao: "Paraíba Litoral" },
  { nome: "Campina Grande", uf: "PB", tipo: "HÍBRIDA", gerencia: "Paraíba", coordenacao: "Paraíba Agreste" },
  { nome: "Patos", uf: "PB", tipo: "FTTH", gerencia: "Paraíba", coordenacao: "Paraíba Sertão" },
  { nome: "Recife", uf: "PE", tipo: "HÍBRIDA", gerencia: "Pernambuco", coordenacao: "Recife" },
  { nome: "Caruaru", uf: "PE", tipo: "HÍBRIDA", gerencia: "Pernambuco", coordenacao: "PE Agreste" },
  { nome: "Petrolina", uf: "PE", tipo: "FTTH", gerencia: "Pernambuco", coordenacao: "PE Sertão" },
  { nome: "Belo Jardim", uf: "PE", tipo: "HÍBRIDA", gerencia: "Pernambuco", coordenacao: "PE Sertão" },
  { nome: "Maceió", uf: "AL", tipo: "FTTH", gerencia: "Alagoas", coordenacao: "Alagoas" },
  { nome: "Arapiraca", uf: "AL", tipo: "FTTH", gerencia: "Alagoas", coordenacao: "Alagoas" },
  { nome: "Aracaju", uf: "SE", tipo: "HÍBRIDA", gerencia: "Sergipe", coordenacao: "Sergipe" },
  { nome: "Tobias Barreto", uf: "SE", tipo: "FTTH", gerencia: "Sergipe", coordenacao: "Sergipe" },
  {
    nome: "Canindé de São Francisco",
    uf: "SE",
    tipo: "HÍBRIDA",
    gerencia: "Sergipe",
    coordenacao: "Sergipe",
  },
  { nome: "Camaçari", uf: "BA", tipo: "FTTH", gerencia: "Bahia", coordenacao: "Bahia Litoral" },
  { nome: "Feira de Santana", uf: "BA", tipo: "HÍBRIDA", gerencia: "Bahia", coordenacao: "Bahia Litoral" },
  { nome: "Teresina", uf: "PI", tipo: "HÍBRIDA", gerencia: "Piauí", coordenacao: "Piauí" },
  { nome: "Picos", uf: "PI", tipo: "FTTH", gerencia: "Piauí", coordenacao: "Piauí" },
  { nome: "Parnaíba", uf: "PI", tipo: "HÍBRIDA", gerencia: "Piauí", coordenacao: "Piauí" },
  { nome: "Timon", uf: "MA", tipo: "HÍBRIDA", gerencia: "Maranhão", coordenacao: "Maranhão" },
  { nome: "Imperatriz", uf: "MA", tipo: "ONLY", gerencia: "Maranhão", coordenacao: "Maranhão" },
  { nome: "São Luís", uf: "MA", tipo: "HÍBRIDA", gerencia: "Maranhão", coordenacao: "Maranhão" },
];

function techsFor(tipo: TipoCidade): Tecnologia[] {
  if (tipo === "FTTH") return ["FTTH"];

  if (tipo === "ONLY") return ["5G"];

  return ["FTTH", "FWA", "5G"]; // HÍBRIDA
}

function lastNMonths(n: number): string[] {
  const out: string[] = [];
  const d = new Date();

  d.setDate(1);

  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);

    out.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}-01`);
  }

  return out;
}

function generate(months: string[]): CityIndicatorRecord[] {
  const rng = mulberry32(20260613);
  const out: CityIndicatorRecord[] = [];

  for (let ci = 0; ci < CITIES.length; ci++) {
    const c = CITIES[ci];
    const sizeFactor = 0.3 + rng() * 0.9; // city scale

    for (const tec of techsFor(c.tipo)) {
      const techFactor = tec === "FTTH" ? 1 : tec === "FWA" ? 0.4 : 0.25;
      const baseHP = Math.round(80000 * sizeFactor * techFactor * (0.8 + rng() * 0.4));
      let baseAtiva = Math.round(baseHP * (0.25 + rng() * 0.25));

      for (const competencia of months) {
        const baseAnterior = baseAtiva;
        const cresc = Math.round((rng() - 0.35) * baseAtiva * 0.03);

        baseAtiva = Math.max(0, baseAtiva + cresc);
        const fechados = Math.round(baseAtiva * (0.008 + rng() * 0.015));
        const fechadoProblemaTecnico = Math.round(fechados * (0.1 + rng() * 0.15));
        const bloqueados = Math.round(baseAtiva * (0.02 + rng() * 0.03));
        const desativadoAuto = Math.round(fechados * (0.4 + rng() * 0.2));
        const desativadoS = Math.round(fechados * (0.3 + rng() * 0.2));
        const reativacoesBloq = Math.round(bloqueados * (0.15 + rng() * 0.2));
        const cancelamentos = fechados;
        const cancelVol = Math.round(cancelamentos * (0.5 + rng() * 0.2));
        const metaCresc = Math.max(50, Math.round(Math.abs(cresc) * (0.9 + rng() * 0.6) + baseAtiva * 0.01));
        const metaBaseAtiva = Math.round(baseAtiva * (0.98 + rng() * 0.08));
        const vCriadas = Math.round(baseAtiva * (0.04 + rng() * 0.03));
        const vEfet = Math.round(vCriadas * (0.55 + rng() * 0.25));
        const vInst = Math.round(vEfet * (0.7 + rng() * 0.2));
        // Churn safra cohort (installed 4 months ago + its cancellations).
        const inst4m = Math.round(vInst * (0.85 + rng() * 0.3));
        const canc4m = Math.round(inst4m * (0.02 + rng() * 0.05));
        const is5g = tec === "5G";
        const ativacaoMes = is5g ? Math.round(vInst * 0.8) : 0;

        out.push({
          competencia,
          id_cidade: `${c.uf}-${ci}`,
          id_cidade_src: `${competencia}-${c.uf}-${ci}`,
          cidade: `${c.nome} / ${c.uf}`,
          uf: c.uf,
          gerencia: c.gerencia,
          coordenacao: c.coordenacao,
          tipo_cidade: c.tipo,
          tecnologia: tec,
          base_ativa: baseAtiva,
          base_ativa_anterior: baseAnterior,
          crescimento: cresc,
          fechados,
          fechado_problema_tecnico: fechadoProblemaTecnico,
          bloqueados,
          desativado_auto: desativadoAuto,
          desativado_s: desativadoS,
          reativacoes_bloqueados: reativacoesBloq,
          reativacoes_total: reativacoesBloq + Math.round(bloqueados * rng() * 0.1),
          cancelamentos,
          cancelamentos_voluntarios: cancelVol,
          cancelamentos_com_consumo: is5g ? Math.round(cancelamentos * 0.6) : 0,
          cancelamentos_sem_consumo: is5g ? Math.round(cancelamentos * 0.4) : 0,
          ativacao_mes: ativacaoMes,
          chips_combo: is5g ? Math.round(ativacaoMes * (0.3 + rng() * 0.15)) : 0,
          vendas_criadas: vCriadas,
          vendas_efetivadas: vEfet,
          vendas_instaladas: vInst,
          instalados_4_mes: inst4m,
          cancelados_4_mes: canc4m,
          total_de_hp: baseHP,
          meta_crescimento: metaCresc,
          meta_base_ativa: metaBaseAtiva,
          meta_vendas_criadas: Math.round(vCriadas * (0.9 + rng() * 0.3)),
          meta_vendas_efetivadas: Math.round(vEfet * (0.9 + rng() * 0.3)),
          meta_vendas_instaladas: Math.round(vInst * (0.9 + rng() * 0.3)),
          meta_ativacao: is5g ? Math.round(vInst * (0.9 + rng() * 0.3)) : 0,
        });
      }
    }
  }

  return out;
}

/** Deterministic jitter in [1-spread, 1+spread] seeded by a string. */
function jitter(seed: string, spread = 0.12): number {
  let h = 0;

  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;

  return 1 - spread + mulberry32(h)() * 2 * spread;
}

/**
 * Synthesize metas_cidades-shaped targets for the cataloged indicators so the
 * mock exercises the same join as Databricks. Percent metas are stored as
 * fractions (compute multiplies by 100), matching the real table.
 */
function buildMockMetas(records: CityIndicatorRecord[]): CityMetaRecord[] {
  const out: CityMetaRecord[] = [];
  const groups = new Map<string, CityIndicatorRecord[]>();

  for (const r of records) {
    const k = `${r.competencia}|${r.cidade}`;

    (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
  }

  const s = (rows: CityIndicatorRecord[], pick: (r: CityIndicatorRecord) => number) =>
    rows.reduce((a, r) => a + (pick(r) || 0), 0);

  const emit = (
    competencia: string,
    cidade: string,
    servico: string,
    rows: CityIndicatorRecord[],
    specs: { id: string; value: number; percent?: boolean }[],
  ) => {
    if (rows.length === 0) return;

    const id_cidade = rows[0].id_cidade_src;

    for (const { id, value, percent } of specs) {
      const meta = percent ? value : Math.round(value);

      out.push({ competencia, cidade, id_cidade, id_indicador: id, servico, meta });
    }
  };

  for (const [key, rows] of groups) {
    const [competencia, cidade] = key.split("|");
    const bl = rows.filter((r) => r.tecnologia === "FTTH" || r.tecnologia === "FWA");
    const ftth = rows.filter((r) => r.tecnologia === "FTTH");
    const fwa = rows.filter((r) => r.tecnologia === "FWA");
    const g5 = rows.filter((r) => r.tecnologia === "5G");

    const blSpecs = (set: CityIndicatorRecord[], svc: string) => {
      const crit = s(set, (r) => r.vendas_criadas);
      const efet = s(set, (r) => r.vendas_efetivadas);
      const inst = s(set, (r) => r.vendas_instaladas);
      const j = (id: string) => jitter(`${cidade}${competencia}${svc}${id}`);

      return [
        { id: "BA03", value: s(set, (r) => r.fechados) * j("BA03") },
        { id: "BA04", value: Math.max(50, Math.abs(s(set, (r) => r.crescimento)) * j("BA04")) },
        { id: "CA03", value: +(0.02 * j("CA03")).toFixed(4), percent: true },
        { id: "VE01", value: crit * j("VE01") },
        { id: "VE02", value: efet * j("VE02") },
        { id: "VE03", value: inst * j("VE03") },
        { id: "VE05", value: +((crit ? efet / crit : 0.7) * j("VE05")).toFixed(4), percent: true },
        { id: "VE06", value: +((efet ? inst / efet : 0.7) * j("VE06")).toFixed(4), percent: true },
      ];
    };

    emit(competencia, cidade, "Banda Larga", bl, blSpecs(bl, "Banda Larga"));
    emit(competencia, cidade, "FTTH", ftth, blSpecs(ftth, "FTTH"));
    emit(competencia, cidade, "FWA", fwa, blSpecs(fwa, "FWA"));

    if (g5.length) {
      const j = (id: string) => jitter(`${cidade}${competencia}5G${id}`);

      emit(competencia, cidade, "5G", g5, [
        { id: "BA02", value: Math.max(20, Math.abs(s(g5, (r) => r.crescimento)) * j("BA02")) },
        { id: "CA03", value: +(0.02 * j("CA03")).toFixed(4), percent: true },
        { id: "VE04", value: s(g5, (r) => r.ativacao_mes) * j("VE04") },
        { id: "CA12", value: s(g5, (r) => r.cancelamentos) * j("CA12") },
      ]);
    }
  }

  return out;
}

export function mockCityDataset(): CityDataset {
  const months = lastNMonths(12);
  const records = generate(months);
  const metaRecords = buildMockMetas(records);
  // Watermark is stable in mock mode (data does not change between requests).
  const watermark = `mock:${months[months.length - 1]}`;

  return { records, metaRecords, months, watermark };
}
