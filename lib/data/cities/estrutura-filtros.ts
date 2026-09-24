import type { FilterOption } from "@/lib/ui/filter-option";
import type { NoRef, VinculoEstrutura } from "./estrutura";
import type { CityDataset, DashboardFilters, EstruturaFiltro, TecnologiaFiltro } from "./types";

/**
 * The hierarchy filters of the Cities dashboard: gerência → coordenação →
 * supervisão → cidade, cascading in both directions like the HC Zerado panel.
 *
 * Each dropdown offers what survives every *other* selection, so picking a
 * gerência narrows the coordenações and picking a cidade narrows the gerências.
 * Tecnologia and Tipo de cidade stay out of the cascade — they cut rows within
 * a city, not the structure above it.
 */

export type Dimensao = "gerencia" | "coordenacao" | "supervisao";

/** One path a city is reachable by; the refs are null for an unbound city. */
export interface TuplaEstrutura {
  cidadeId: string;
  cidade: string;
  gerencia: NoRef | null;
  coordenacao: NoRef | null;
  supervisao: NoRef | null;
}

const PLACEHOLDER = new Set(["-", "NAO REGISTRADO", "NÃO REGISTRADO"]);

const usable = (v: string) => v.trim() !== "" && v.trim() !== "/" && !PLACEHOLDER.has(v.trim().toUpperCase());

const has = (selecionados: string[], codigo: string | null) =>
  selecionados.length === 0 || (codigo !== null && selecionados.includes(codigo));

const codigo = (ref: NoRef | null) => ref?.codigo ?? null;

export function buildTuplas(dataset: CityDataset, vinculos: VinculoEstrutura[]): TuplaEstrutura[] {
  const porCidade = new Map<string, VinculoEstrutura[]>();

  for (const v of vinculos) {
    const chave = String(v.cidadeId);

    porCidade.set(chave, [...(porCidade.get(chave) ?? []), v]);
  }

  const nomes = new Map<string, string>();

  for (const r of dataset.records) {
    if (!nomes.has(r.revan_cidade_id)) nomes.set(r.revan_cidade_id, r.cidade);
  }

  const tuplas: TuplaEstrutura[] = [];

  for (const [cidadeId, cidade] of nomes) {
    const vinculada = porCidade.get(cidadeId);

    if (!vinculada?.length) {
      tuplas.push({ cidadeId, cidade, gerencia: null, coordenacao: null, supervisao: null });
      continue;
    }

    for (const v of vinculada) {
      tuplas.push({
        cidadeId,
        cidade,
        gerencia: v.gerencia,
        coordenacao: v.coordenacao,
        supervisao: v.supervisao,
      });
    }
  }

  return tuplas;
}

/**
 * The mock has no bindings table, so its own labels stand in as the structure —
 * the name doubles as the code, and nobody is responsável.
 */
export function vinculosDoMock(dataset: CityDataset): VinculoEstrutura[] {
  const porCidade = new Map<string, VinculoEstrutura>();
  const ref = (nome: string): NoRef | null => (nome ? { codigo: nome, nome, responsavel: "" } : null);

  for (const r of dataset.records) {
    const coordenacao = ref(r.coordenacao);

    if (porCidade.has(r.revan_cidade_id) || !coordenacao) continue;

    porCidade.set(r.revan_cidade_id, {
      cidadeId: Number(r.revan_cidade_id),
      gerencia: ref(r.gerencia),
      coordenacao,
      supervisao: ref(r.supervisao),
    });
  }

  return [...porCidade.values()];
}

function sobrevive(t: TuplaEstrutura, f: DashboardFilters, exceto: Dimensao | "cidade"): boolean {
  return (
    (exceto === "gerencia" || has(f.gerencia, codigo(t.gerencia))) &&
    (exceto === "coordenacao" || has(f.coordenacao, codigo(t.coordenacao))) &&
    (exceto === "supervisao" || has(f.supervisao, codigo(t.supervisao))) &&
    (exceto === "cidade" || f.cidade.length === 0 || f.cidade.includes(t.cidade))
  );
}

function listarNos(tuplas: TuplaEstrutura[], f: DashboardFilters, dim: Dimensao): FilterOption[] {
  const vistos = new Map<string, FilterOption>();

  for (const t of tuplas) {
    const ref = t[dim];

    if (ref && sobrevive(t, f, dim)) {
      vistos.set(ref.codigo, { value: ref.codigo, label: ref.nome, hint: ref.responsavel || undefined });
    }
  }

  return [...vistos.values()].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

function listarCidades(tuplas: TuplaEstrutura[], f: DashboardFilters): string[] {
  const vistas = new Set<string>();

  for (const t of tuplas) {
    if (usable(t.cidade) && sobrevive(t, f, "cidade")) vistas.add(t.cidade);
  }

  return [...vistas].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function buildFilterOptions(dataset: CityDataset, tuplas: TuplaEstrutura[], f: DashboardFilters) {
  const tipos = new Set<string>();

  for (const r of dataset.records) if (usable(r.tipo_cidade)) tipos.add(r.tipo_cidade);

  return {
    meses: dataset.months,
    gerencias: listarNos(tuplas, f, "gerencia"),
    coordenacoes: listarNos(tuplas, f, "coordenacao"),
    supervisoes: listarNos(tuplas, f, "supervisao"),
    tiposCidade: [...tipos].sort(),
    cidades: listarCidades(tuplas, f),
    tecnologias: ["FTTH", "FWA", "Banda Larga", "5G"] as TecnologiaFiltro[],
  };
}

/**
 * The cities the hierarchy cut leaves, or null when nothing is selected. A city
 * bound to two nodes answers to both — which is why this reads the tuples and
 * not the single label written onto each record.
 */
export function cidadesDaEstrutura(tuplas: TuplaEstrutura[], f: EstruturaFiltro): Set<string> | null {
  if (f.gerencia.length === 0 && f.coordenacao.length === 0 && f.supervisao.length === 0) return null;

  const ids = new Set<string>();

  for (const t of tuplas) {
    if (
      has(f.gerencia, codigo(t.gerencia)) &&
      has(f.coordenacao, codigo(t.coordenacao)) &&
      has(f.supervisao, codigo(t.supervisao))
    ) {
      ids.add(t.cidadeId);
    }
  }

  return ids;
}
