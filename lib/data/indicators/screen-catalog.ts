import "server-only";

import { T } from "@/lib/data/admin/tables";
import { ADAPTER_BUILD, cachedByWatermark } from "@/lib/data/cache";
import { DatabricksDataClient } from "@/lib/data/databricks";
import { IND } from "./catalog";
import { readSourceColumns } from "./source-columns";
import { parseSpec, validateSpec, type CalcSpec } from "./spec";

/** An active serviço row with a valid spec — anything else never reaches a screen. */
export interface CatalogEntry {
  id: string;
  idIndicadorGeral: string;
  servico: string;
  nome: string;
  nomeGeral: string;
  descricao: string;
  spec: CalcSpec;
}

export interface Placement {
  rota: string;
  bloco: string;
  ordem: number;
  padrao: boolean;
  servicoId: string;
}

export interface ScreenCatalog {
  entries: Map<string, CatalogEntry>;
  placements: Placement[];
  columns: Record<string, string[]>;
}

const g = globalThis as unknown as { __indicatorsCatalogVersion?: number };

/** Bumped by every admin write, so the screens stop serving the previous catalog. */
export function bumpCatalogVersion(): void {
  g.__indicatorsCatalogVersion = (g.__indicatorsCatalogVersion ?? 0) + 1;
}

export function catalogVersion(): string {
  return `${ADAPTER_BUILD}:${g.__indicatorsCatalogVersion ?? 0}`;
}

const ativo = (v: unknown) =>
  String(v ?? "")
    .trim()
    .toLowerCase() === "ativo";

async function loadScreenCatalog(): Promise<ScreenCatalog> {
  const client = new DatabricksDataClient();
  const [servicos, placements, columns] = await Promise.all([
    client.query<Record<string, unknown>>(
      `SELECT s.id, s.id_indicador_geral, s.servico, s.indicador_servico, s.descricao_indicador,
              s.status, s.especificacao_calculo, g.indicadores AS nome_geral, g.status AS status_geral
         FROM ${IND.servicos} s
         JOIN ${IND.gerais} g ON g.id = s.id_indicador_geral`,
    ),
    client.query<Record<string, unknown>>(
      `SELECT p.rota, ip.bloco, ip.ordem, ip.padrao, ip.id_indicador_servico
         FROM ${IND.paginas} ip
         JOIN ${T.paginas} p ON p.id = ip.pagina_id`,
    ),
    readSourceColumns(),
  ]);

  const entries = new Map<string, CatalogEntry>();

  for (const r of servicos) {
    if (!ativo(r.status) || !ativo(r.status_geral)) continue;

    const spec = parseSpec(r.especificacao_calculo == null ? null : String(r.especificacao_calculo));

    if (!spec || validateSpec(spec, columns).length > 0) continue;

    const id = String(r.id);

    entries.set(id, {
      id,
      idIndicadorGeral: String(r.id_indicador_geral ?? ""),
      servico: String(r.servico ?? ""),
      nome: String(r.indicador_servico ?? ""),
      nomeGeral: String(r.nome_geral ?? ""),
      descricao: String(r.descricao_indicador ?? ""),
      spec,
    });
  }

  return {
    entries,
    placements: placements.map((r) => ({
      rota: String(r.rota ?? ""),
      bloco: String(r.bloco ?? ""),
      ordem: Number(r.ordem ?? 0),
      padrao: r.padrao === true,
      servicoId: String(r.id_indicador_servico ?? ""),
    })),
    columns,
  };
}

export function readScreenCatalog(): Promise<ScreenCatalog> {
  return cachedByWatermark("indicators:screen-catalog:v1", catalogVersion(), loadScreenCatalog);
}
