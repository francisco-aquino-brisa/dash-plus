import "server-only";

import { todayIso } from "../_shared";
import { runSourceBatch, sumPartials } from "../indicators/batch";
import { buildBlocks, type IndicatorBlock, type IndicatorBlocksVM } from "../indicators/block-cards";
import { pageEntries, type TechVariant } from "../indicators/cards";
import { readScreenCatalog, type CatalogEntry } from "../indicators/screen-catalog";
import { prevYm, type MonthPartial } from "../indicators/values";
import { anchorPredicate, type ScopeAnchor } from "../scope-sql";
import type { SalesFilters } from "./types";

const ROTA = "/vendas";

type Dim = "canal" | "gerente" | "nicho" | "tipo" | "cidade" | "uf";

/**
 * How Vendas narrows each catalog source: who the person is (data scope) and
 * which filter dropdowns map onto a column of it. A dropdown the source does not
 * carry is ignored for its cards. The city cubes have no person column, so
 * restricted readers get "sem acesso" for them; a source not listed here gets
 * "sem acesso" for everyone until it is mapped.
 *
 * `vw_vendas_waves` has no nicho column (`lider_nicho` is a person), and the 5G
 * channel columns use their own codes, so those dropdowns don't reach them.
 */
const SOURCES: Record<string, { anchor: ScopeAnchor; dims: Partial<Record<Dim, string>> }> = {
  vw_vendas_waves: {
    anchor: { column: "cpf_vendedor", on: "cpf" },
    dims: {
      canal: "CANAL_GERAL",
      gerente: "GERENTE_CANAIS",
      tipo: "TIPO_CIDADE",
      cidade: "cidade_venda",
      uf: "TRIM(RIGHT(cidade_venda, 2))",
    },
  },
  // `cpf` here is the customer's; the seller is the combo's.
  vw_vendas_5g: {
    anchor: { column: "cpf_vendedor_combo", on: "cpf" },
    dims: { nicho: "nicho", cidade: "cidade_venda", uf: "TRIM(RIGHT(cidade_venda, 2))" },
  },
  vw_churn_4m_vendedor_5g: {
    anchor: { column: "cpf_vendedor", on: "cpf" },
    dims: { gerente: "GERENTE" },
  },
  vw_portabilidade_5g: {
    anchor: { column: "cpf_vendedor", on: "cpf" },
    dims: {
      canal: "CANAL_GERAL",
      nicho: "nicho",
      cidade: "cidade_venda",
      uf: "TRIM(RIGHT(cidade_venda, 2))",
    },
  },
  vw_indicadores_cidades: { anchor: "none", dims: { uf: "TRIM(RIGHT(cidade, 2))" } },
  vw_indicadores_cidades_5g: { anchor: "none", dims: { uf: "TRIM(RIGHT(cidade, 2))" } },
};

const DIMS: Dim[] = ["canal", "gerente", "nicho", "tipo", "cidade", "uf"];

function variantFor(block: IndicatorBlock, servico: string): TechVariant {
  if (block === "5g") return "5G";

  return servico === "INTERNET" ? "FTTH" : servico === "FWA" ? "FWA" : "BL";
}

/** The 12 months up to the current one, oldest first. */
function trailingMonths(): string[] {
  const out = [todayIso().slice(0, 7)];

  while (out.length < 12) out.unshift(prevYm(out[0]));

  return out;
}

/** One query per source, with the reader's filters and scope pushed into its WHERE. */
async function sourceSeries(
  fonte: string,
  entries: CatalogEntry[],
  columns: string[],
  filters: SalesFilters,
): Promise<Map<string, Map<string, MonthPartial>> | null> {
  const map = SOURCES[fonte];

  if (!map || (!filters.scope.all && map.anchor === "none")) return null;

  const where: string[] = [];
  const params: unknown[] = [];

  for (const dim of DIMS) {
    const col = map.dims[dim];

    if (col && filters[dim]) {
      where.push(`${col} = ?`);
      params.push(filters[dim]);
    }
  }

  const sc = anchorPredicate(filters.scope, map.anchor);

  if (sc.where.trim()) where.push(sc.where.replace(/^\s*AND\s+/i, ""));

  try {
    const rows = await runSourceBatch(
      fonte,
      entries.map((e) => ({ key: e.id, spec: e.spec })),
      columns,
      { where, params: [...params, ...sc.params] },
    );

    return sumPartials(rows);
  } catch (err) {
    console.warn(`[sales] indicadores do cadastro: fonte indisponível (${fonte}):`, (err as Error).message);

    return null;
  }
}

export async function buildSalesCatalogBlocks(
  filters: SalesFilters,
  competencia: string,
): Promise<IndicatorBlocksVM> {
  const catalog = await readScreenCatalog();
  const byFonte = new Map<string, CatalogEntry[]>();

  for (const e of pageEntries(catalog, ROTA)) {
    const list = byFonte.get(e.spec.fonte) ?? [];

    list.push(e);
    byFonte.set(e.spec.fonte, list);
  }

  const fontes = [...byFonte.keys()];
  const results = await Promise.all(
    fontes.map((f) => sourceSeries(f, byFonte.get(f)!, catalog.columns[f] ?? [], filters)),
  );
  const series = new Map<string, Map<string, MonthPartial>>();
  const failed = new Set<string>();

  fontes.forEach((f, i) => {
    const r = results[i];

    if (!r) failed.add(f);
    else for (const [key, byMonth] of r) series.set(key, byMonth);
  });

  const months = trailingMonths();

  return buildBlocks({
    catalog,
    rota: ROTA,
    series,
    failed,
    months,
    yms: months,
    competencia,
    variant: (block) => variantFor(block, filters.servico),
  });
}
