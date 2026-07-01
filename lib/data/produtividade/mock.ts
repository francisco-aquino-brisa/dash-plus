// Deterministic mock for the Commercial Productivity screen (Tela 2), shaped to
// the aggregated result the Databricks adapter returns. Mirrors the prototype's
// numbers; blocked indicators are marked unavailable.

import { blocked, ratio } from "../_shared";
import { hashStr } from "../_random";
import { resolveProdPeriod } from "./dates";
import type { KpiBlock, PduPoint, ProdFilters, ProdView, VendedorRow } from "./types";

const GERENCIAS = ["Gerência Litoral", "Gerência Sertão", "Gerência Capital", "Gerência Sul"];
const COORDENACOES = ["Coord. Norte", "Coord. Sul", "Coord. Leste", "Coord. Oeste", "Coord. Centro"];
const GERENTES = ["Flávio (PAP)", "Rose (Varejo)", "Paulo Cesar (Retenção)", "Suiane (Online)", "Gicélio (B2B)"];
const NICHOS = ["PAP Região Fortaleza", "PAP Região Sergipe", "NGC Maceió", "NGC João Pessoa", "PAP Região Piauí"];
const CIDADES = ["Fortaleza", "Sobral", "Natal", "João Pessoa", "Recife", "Maceió", "Aracaju", "Teresina"];
const NOMES = [
  "Ana Lima", "Bruno Sá", "Carla Dias", "Diego Melo", "Elaine Rocha", "Felipe Brito", "Gabriela Pires",
  "Heitor Vaz", "Igor Nunes", "Joana Reis", "Kelly Mota", "Lucas Aragão", "Marina Pinto", "Nilo Castro", "Olívia Ramos",
];

function filterFactor(f: ProdFilters): number {
  const dim = (v: string) => (!v ? 1 : 0.55 + hashStr(v) * 0.4);
  const p = resolveProdPeriod(f);
  const days = Math.max(1, Math.round((+new Date(p.to) - +new Date(p.from)) / 864e5) + 1);
  return dim(f.gerencia) * dim(f.coordenacao) * dim(f.gerente) * dim(f.nicho) * dim(f.cidade) * (days / 30);
}

function indicadores(f: ProdFilters): KpiBlock[] {
  const factor = filterFactor(f);
  const cri = Math.round(38_400 * factor);
  const efe = Math.round(27_900 * factor);
  const ins = Math.round(23_100 * factor);
  const g5 = Math.round(9_700 * factor);
  return [
    { label: "Vendas Criadas", value: cri, meta: 0, delta: 5.1, available: true, helper: "Banda Larga (INTERNET + FWA)" },
    { label: "Vendas Efetivadas", value: efe, meta: 0, delta: 3.4, available: true, helper: `Efetivados x Criados: ${ratio(efe, cri)}%`.replace(".", ",") },
    { label: "Vendas Instaladas", value: ins, meta: 0, delta: -1.2, available: true, helper: `Instalados x Efetivados: ${ratio(ins, efe)}%`.replace(".", ",") },
    { label: "Vendas Ativadas 5G", value: g5, meta: 0, delta: 7.9, available: true, helper: "Chip pago/grátis: sem acesso" },
    blocked("Ticket Médio Entrada"),
    blocked("Ticket Médio Entrada 5G"),
    blocked("Churn Safra"),
  ];
}

function ranking(f: ProdFilters): VendedorRow[] {
  const factor = filterFactor(f);
  const grupos = f.mode === "canais" ? NICHOS : COORDENACOES;
  return NOMES.map((nome, i) => {
    const s = hashStr(nome + f.mode);
    const criado = Math.round((40 + s * 80) * factor);
    const efetivado = Math.round(criado * (0.7 + s * 0.2));
    const instalado = Math.round(efetivado * (0.7 + (1 - s) * 0.2));
    const ativ5g = Math.round((s * 60) * factor);
    return {
      nome,
      grupo: grupos[i % grupos.length],
      cidade: CIDADES[i % CIDADES.length],
      criado,
      efetivado,
      instalado,
      ativ5g,
      efetVsCriado: ratio(efetivado, criado),
      instVsEfet: ratio(instalado, efetivado),
    };
  })
    .sort((a, b) => b.efetivado - a.efetivado)
    .slice(0, 15);
}

function pduSeries(): PduPoint[] {
  const meses = ["Fev/26", "Mar/26", "Abr/26", "Mai/26", "Jun/26"];
  return meses.map((mes, i) => ({
    mes,
    FTTH: +(2.2 + 0.3 * Math.sin(i / 2) + 0.4).toFixed(2),
    FWA: +(0.17 + 0.02 * Math.sin(i)).toFixed(2),
    "5G": +(1.1 + 0.2 * Math.cos(i / 1.8)).toFixed(2),
  }));
}

export function mockProdView(filters: ProdFilters): ProdView {
  return {
    source: "mock",
    filters,
    periodLabel: resolveProdPeriod(filters).label,
    indicadores: indicadores(filters),
    ranking: ranking(filters),
    pdu: pduSeries(),
    tamAvailable: false,
    watermark: "mock:produtividade",
  };
}

export const PROD_FILTER_LISTS = { GERENCIAS, COORDENACOES, GERENTES, NICHOS, CIDADES };
