// Deterministic mock for the Sales · Channels screen, shaped to the aggregated
// result the Databricks adapter will return (see ADR 0002 — large fact, aggregated
// in SQL). Numbers mirror the prototype; blocked indicators are marked unavailable.

import { hashStr, mulberry32 } from "../_random";
import { resolvePeriod } from "./dates";
import {
  BLOCKED_INDICATORS,
  type CanalDelta,
  type PduPoint,
  type SalesFilters,
  type SalesView,
} from "./types";
import {
  SALES_INDICATORS,
  buildSalesVM,
  decimalsFor,
  type SalesBlock,
  type SalesIndicatorDef,
  type SalesIndicatorVM,
} from "./indicators";

const GERENTES = [
  "Ana Souza",
  "Carlos Lima",
  "Daniel Rocha",
  "Fernanda Melo",
  "Gustavo Pires",
  "Helena Brito",
  "Joaquim Sá",
  "Larissa Vieira",
];
const CANAIS = [
  "PAP Próprio",
  "PAP Parceiro",
  "Loja Própria",
  "Loja Parceira",
  "Televendas",
  "Digital",
  "Field Sales",
  "Revenda 5G",
  "B2B Indireto",
  "Eventos",
  "WhatsApp Bot",
  "Porta a Porta NE",
];
const NICHOS = ["Residencial", "PME", "Corporativo", "Combo Família", "Pré-pago 5G"];
const UFS = ["CE", "RN", "PB", "PE", "AL", "SE", "BA", "PI", "MA"];
const CIDADES = [
  "Fortaleza",
  "Sobral",
  "Natal",
  "Mossoró",
  "João Pessoa",
  "Recife",
  "Maceió",
  "Aracaju",
  "Teresina",
  "São Luís",
];
const TIPOS = ["ONLY", "HÍBRIDA", "FTTH"];
const MESES = [
  "Jul/24",
  "Ago/24",
  "Set/24",
  "Out/24",
  "Nov/24",
  "Dez/24",
  "Jan/25",
  "Fev/25",
  "Mar/25",
  "Abr/25",
  "Mai/25",
  "Jun/25",
];

const BL_SPLIT = { INTERNET: 0.63, FWA: 0.37 };

/** Deterministic multiplier: more filters → smaller universe. */
function filterFactor(f: SalesFilters): number {
  const dim = (v: string) => (!v ? 1 : 0.55 + hashStr(v) * 0.4);
  const periodMul: Record<string, number> = {
    mes_atual: 1,
    mes_anterior: 1,
    "7d": 0.25,
    "30d": 1,
    "90d": 2.9,
    ano: 11,
  };
  // Custom range scales by its length (≈ days/30); presets use their multiplier.
  let timeMul = periodMul[f.period] ?? 1;

  if (f.period === "custom") {
    const p = resolvePeriod(f);
    const days = Math.max(1, Math.round((+new Date(p.to) - +new Date(p.from)) / 864e5) + 1);

    timeMul = days / 30;
  }

  return dim(f.gerente) * dim(f.canal) * dim(f.nicho) * dim(f.uf) * dim(f.cidade) * dim(f.tipo) * timeMul;
}

// Base value per indicator (mês típico, escala validada vs warehouse). Faturamento
// em R$; contagens em unidades; percentuais/razões em %. Escalado por filterFactor.
const MOCK_BASE: Record<string, number> = {
  "banda-larga:VE01": 54_000,
  "banda-larga:VE02": 43_600,
  "banda-larga:VE03": 34_200,
  "banda-larga:VE05": 80.1,
  "banda-larga:VE06": 78.4,
  "banda-larga:RE01": 87.6,
  "banda-larga:RE02": 93.0,
  "banda-larga:RE03": 90.8,
  "banda-larga:RE04": 11_160_000,
  "banda-larga:RE05": 11_850_000,
  "banda-larga:RE03f": 11_040_000,
  "banda-larga:CA08": 9.4,
  "5g:VE04": 80_600,
  "5g:VE27": 22_700,
  "5g:VE51": 57_900,
  "5g:VE28": 78_000,
  "5g:VE29": 2_560,
  "5g:RE01": 25.9,
  "5g:RE02": 35.0,
  "5g:RE04": 2_060_000,
  "5g:RE05": 2_820_000,
  "5g:CA10": 45.0,
  "5g:CA09": 4.1,
};

/** Trailing 12 month keys (yyyy-MM) ending at `endYm` (inclusive). */
function monthKeys(endYm: string, n = 12): string[] {
  const [y, m] = endYm.split("-").map(Number);
  const out: string[] = [];

  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);

    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  return out;
}

function roundUnit(unit: SalesIndicatorDef["unit"], v: number): number {
  if (unit === "qtd") return Math.round(v);

  if (unit === "percent") return +v.toFixed(decimalsFor(unit));

  return v >= 1000 ? Math.round(v) : +v.toFixed(2);
}

/** Deterministic block VMs mirroring the real (value + série 12m + meta). */
function mockBlock(block: SalesBlock, f: SalesFilters, competencia: string): SalesIndicatorVM[] {
  const months = monthKeys(competencia);
  const svc =
    block === "5g"
      ? 1
      : f.servico === "INTERNET"
        ? BL_SPLIT.INTERNET
        : f.servico === "FWA"
          ? BL_SPLIT.FWA
          : 1;
  // Percentuais/razões não escalam com o tamanho do universo; contagens/receita sim.
  const factor = filterFactor(f) * svc;

  return SALES_INDICATORS[block].map((def) => {
    if (!def.available) return buildSalesVM(def, new Map(), new Map(), competencia);

    const rng = mulberry32(hashStr(`${block}:${def.id}`) * 7 + 3);
    const scale = def.unit === "percent" ? 1 : factor;
    const base = (MOCK_BASE[`${block}:${def.id}`] ?? 1000) * scale;
    const real = new Map<string, number>();
    const meta = new Map<string, number>();

    months.forEach((ym, i) => {
      const wobble = 0.85 + rng() * 0.3;

      real.set(ym, roundUnit(def.unit, base * wobble * (1 + i * 0.008)));

      if (def.meta)
        meta.set(ym, roundUnit(def.unit, base * (def.meta.kind === "ticketOferta" ? 0.95 : 1.08)));
    });

    return buildSalesVM(def, real, meta, competencia);
  });
}

function pduSeries(seed: number): PduPoint[] {
  const rng = mulberry32(42 + seed);

  // PDU = produção realizada / HC ativo / dia útil → small per-head daily rates.
  return MESES.map((mes, i) => ({
    mes,
    FTTH: +(3.1 + 0.4 * Math.sin(i / 2) + rng() * 0.5).toFixed(2),
    FWA: +(1.9 + 0.3 * Math.sin(i / 1.5 + 1) + rng() * 0.4).toFixed(2),
    "5G": +(0.9 + 0.2 * Math.cos(i / 1.8) + rng() * 0.25).toFixed(2),
  }));
}

function canalDeltas(items: string[], seed: number, scale: number): CanalDelta[] {
  const rng = mulberry32(seed);

  return items
    .map((c, i) => ({
      canal: c,
      gerente: GERENTES[i % GERENTES.length],
      mediaDia: Math.round(scale * (0.6 + rng())),
      vsMesAnterior: +(rng() * 30 - 12).toFixed(1),
      vsSemanaAnterior: +(rng() * 22 - 9).toFixed(1),
    }))
    .sort((a, b) => b.vsMesAnterior - a.vsMesAnterior);
}

const FREE = [
  "Vendas Criadas - FTTH",
  "Vendas Criadas - FWA",
  "Vendas Criadas - Banda Larga",
  "Vendas Efetivadas - FTTH",
  "Vendas Efetivadas - FWA",
  "Vendas Instaladas - FTTH",
  "Vendas Instaladas - FWA",
  "Efetivados x Criados - Banda Larga",
  "Instalados x Efetivados - Banda Larga",
  "Vendas Ativadas - 5G",
  "% Portabilidade - 5G",
  "Ticket Médio Entrada - 5G",
  "Churn Safra - Banda Larga",
  "Churn Safra c/ Bloqueio - 5G",
  "Combo 1 Chip - FTTH",
  "Combo 2 Chip - FTTH",
  "Combo 3+ Chip - FTTH",
];

function freeSeries(): Record<string, { mes: string; valor: number }[]> {
  const out: Record<string, { mes: string; valor: number }[]> = {};

  for (const nome of FREE) {
    if (BLOCKED_INDICATORS.has(nome)) continue;

    const rng = mulberry32(nome.length * 7 + 3);
    const isPct = /%|Churn|x /.test(nome);

    out[nome] = MESES.map((mes, i) => {
      const base = isPct
        ? 40 + Math.sin(i / 2 + nome.length) * 8
        : 8000 + Math.sin(i / 2 + nome.length) * 1500 + i * 200;

      return { mes, valor: +(base + rng() * (isPct ? 4 : 1200)).toFixed(isPct ? 1 : 0) };
    });
  }

  return out;
}

export function mockSalesView(filters: SalesFilters): SalesView {
  const seed = Math.floor(filterFactor(filters) * 1000);
  const competencia = resolvePeriod(filters).to.slice(0, 7);

  return {
    filters,
    source: "mock",
    periodLabel: resolvePeriod(filters).label,
    competencia,
    meses: MESES,
    blocksBL: mockBlock("banda-larga", filters, competencia),
    blocks5G: mockBlock("5g", filters, competencia),
    pdu: pduSeries(seed),
    canais: {
      canal: { bl: canalDeltas(CANAIS, 11 + seed, 220), g5: canalDeltas(CANAIS.slice(0, 9), 23 + seed, 90) },
      nicho: { bl: canalDeltas(NICHOS, 31 + seed, 320), g5: canalDeltas(NICHOS, 41 + seed, 120) },
    },
    freeIndicators: FREE.map((nome) => ({ nome, available: !BLOCKED_INDICATORS.has(nome) })),
    freeSeries: freeSeries(),
    watermark: "mock:vendas",
  };
}

export const SALES_FILTER_LISTS = { GERENTES, CANAIS, NICHOS, UFS, CIDADES, TIPOS };
