// Per-vendedor indicator catalog + realizado, for the Dashboard Vendedor cards.
//
// The catalog (which indicators a consultant has this month, their metas and the
// formula metadata) lives in `metas_vendedores_canais`. The realizado for each
// indicator is computed from the source table named in that catalog, joined to
// the vendedor by `hash_user` (which the catalog carries per row).
//
// Phase 1 (this file) implements the "vendas" COUNT family over two sources:
//   - waves_consolidado_orcamento → COUNT(DISTINCT orcamento_id) with filters
//   - consolidado_5g_pedido       → COUNT(DISTINCT n_do_pedido) with filters
// Indicators not yet in REALIZADO_DEFS render with `disponivel: false` (meta
// shown, realizado "—"). Verified against Databricks (read-only): incremento is
// `dd-MM-yyyy`, status_venda is UPPERCASE, servico ∈ {INTERNET, FWA, 5G}.

import { getDataClient } from "../client";
import { num } from "../_shared";
import type { IndicadorFormato, IndicadorVM, MixOferta, ServicoKey, StatusVenda } from "./types";

const CAT = process.env.DATABRICKS_SALES_CATALOG ?? "gdb_brisanet_comunidade_dev";
const METAS = `\`${CAT}\`.\`projeto_brisa_performance\`.\`metas_vendedores_canais\``;
const WAVES = `\`${CAT}\`.\`inteligencia_comercial_e_mercado\`.\`waves_consolidado_orcamento\``;
const CINCO_G = `\`${CAT}\`.\`inteligencia_comercial_e_mercado\`.\`consolidado_5g_pedido\``;

const q = <T = Record<string, unknown>>(sql: string) => getDataClient().query<T>(sql);
const str = (v: unknown): string => (v == null ? "" : String(v));

// SQL-injection guards: like `safeIsoDate` in ../_shared, values are laundered
// then inlined (the whole data layer inlines; there is no param path). `ym` is
// app-generated and `hash_user` comes from our own metas SELECT, but we still
// validate their shape before inlining them into SQL string literals.
const YM_RE = /^\d{4}-\d{2}$/;
const HASH_RE = /^[0-9a-f]{32}$/i;

/** The `servico` label as stored in the catalog. */
type CatalogServico = "FTTH" | "FWA" | "5G" | "Banda Larga";

/** Catalog `servico` → the card it belongs to. */
const SERVICO_TO_CARD: Record<string, ServicoKey> = {
  FTTH: "FTTH",
  FWA: "FWA",
  "5G": "5G",
  "Banda Larga": "Banda",
};

type Fonte = "waves" | "cinco_g";

/**
 * Realizado formula per (id_indicador, servico), transcribed from the catalog's
 * `metrica`. `cond` is a SQL boolean over the source table (literals only — no
 * user input). Keyed on both id AND servico because several indicators (VE03,
 * VE49, …) filter differently per service.
 */
interface RealizadoDef {
  id: string;
  servico: CatalogServico;
  fonte: Fonte;
  cond: string;
}

const REALIZADO_DEFS: RealizadoDef[] = [
  // waves_consolidado_orcamento — COUNT(DISTINCT orcamento_id)
  {
    id: "VE03",
    servico: "FTTH",
    fonte: "waves",
    cond: "upper(status_venda)='INSTALADO' AND servico='INTERNET'",
  },
  { id: "VE03", servico: "FWA", fonte: "waves", cond: "upper(status_venda)='INSTALADO' AND servico='FWA'" },
  {
    id: "VE47",
    servico: "FTTH",
    fonte: "waves",
    cond: "upper(status_venda)='CRIADO' AND servico='INTERNET' AND upper(combo_5g)='NAO'",
  },
  {
    id: "VE48",
    servico: "FTTH",
    fonte: "waves",
    cond: "upper(status_venda)='EFETIVADO' AND servico='INTERNET' AND upper(combo_5g)='NAO'",
  },
  {
    id: "VE49",
    servico: "FTTH",
    fonte: "waves",
    cond: "upper(status_venda)='INSTALADO' AND servico='INTERNET' AND upper(combo_5g)='NAO'",
  },
  {
    id: "VE49",
    servico: "Banda Larga",
    fonte: "waves",
    cond: "upper(status_venda)='INSTALADO' AND servico IN ('INTERNET','FWA') AND upper(combo_5g)='NAO'",
  },
  {
    id: "VE09",
    servico: "FTTH",
    fonte: "waves",
    cond: "upper(status_venda)='CRIADO' AND servico='INTERNET' AND upper(tipo_combo)='COMBO_1'",
  },
  {
    id: "VE12",
    servico: "FTTH",
    fonte: "waves",
    cond: "upper(status_venda)='EFETIVADO' AND servico='INTERNET' AND upper(tipo_combo)='COMBO_1'",
  },
  {
    id: "VE15",
    servico: "FTTH",
    fonte: "waves",
    cond: "upper(status_venda)='INSTALADO' AND servico='INTERNET' AND upper(tipo_combo)='COMBO_1'",
  },
  {
    id: "VE53",
    servico: "FTTH",
    fonte: "waves",
    cond: "upper(status_venda)='CRIADO' AND servico='INTERNET' AND upper(tipo_combo) IN ('COMBO_2','COMBO_3')",
  },
  {
    id: "VE54",
    servico: "FTTH",
    fonte: "waves",
    cond: "upper(status_venda)='EFETIVADO' AND servico='INTERNET' AND upper(tipo_combo) IN ('COMBO_2','COMBO_3')",
  },
  {
    id: "VE55",
    servico: "FTTH",
    fonte: "waves",
    cond: "upper(status_venda)='INSTALADO' AND servico='INTERNET' AND upper(tipo_combo) IN ('COMBO_2','COMBO_3')",
  },
  {
    id: "VE46",
    servico: "FTTH",
    fonte: "waves",
    cond: "upper(status_venda)='INSTALADO' AND servico='INTERNET' AND upper(combo_5g)='SIM'",
  },
  // consolidado_5g_pedido — COUNT(DISTINCT n_do_pedido)
  { id: "VE04", servico: "5G", fonte: "cinco_g", cond: "1 = 1" },
  { id: "VE51", servico: "5G", fonte: "cinco_g", cond: "upper(combo_ftth_5g)='NAO'" },
];

const defKey = (id: string, servico: string) => `${id}|${servico}`;

interface CatalogoRow {
  id: string;
  label: string;
  servico: string;
  formato: string;
  polaridade: string;
  meta: number;
  hashUser: string;
}

/** The vendor's indicator catalog for the month (one row per id × servico). */
async function fetchCatalogo(mat: number, ym: string): Promise<CatalogoRow[]> {
  const rows = await q(
    `SELECT id_indicador id, MAX(indicador) label, servico,
       MAX(formato_dado) formato, MAX(polaridade) polaridade,
       MAX(meta) meta, MAX(hash_user) hash_user
     FROM ${METAS}
     WHERE matricula = ${mat} AND date_format(data, 'yyyy-MM') = '${ym}'
     GROUP BY id_indicador, servico`,
  );

  return rows.map((r) => ({
    id: str(r.id),
    label: str(r.label),
    servico: str(r.servico),
    formato: str(r.formato),
    polaridade: str(r.polaridade),
    meta: num(r.meta),
    hashUser: str(r.hash_user),
  }));
}

/** Realizado per (id|servico), computed from the source tables via one query each. */
async function fetchRealizados(hashUser: string, ym: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();

  if (!HASH_RE.test(hashUser) || !YM_RE.test(ym)) return out;

  const [y, m] = ym.split("-");
  const incremento = `01-${m}-${y}`; // sources store the month as dd-MM-yyyy

  const run = async (fonte: Fonte, table: string, distinctCol: string) => {
    const defs = REALIZADO_DEFS.filter((d) => d.fonte === fonte);

    if (!defs.length) return;

    const cols = defs
      .map((d, i) => `COUNT(DISTINCT CASE WHEN ${d.cond} THEN ${distinctCol} END) a${i}`)
      .join(", ");
    const rows = await q(
      `SELECT ${cols} FROM ${table}
       WHERE hash_user = '${hashUser}' AND incremento = '${incremento}'`,
    );
    const r = rows[0] ?? {};

    defs.forEach((d, i) => out.set(defKey(d.id, d.servico), num(r[`a${i}`])));
  };

  await Promise.all([run("waves", WAVES, "orcamento_id"), run("cinco_g", CINCO_G, "n_do_pedido")]);

  return out;
}

function toFormato(v: string): IndicadorFormato {
  const s = v.trim().toUpperCase();

  if (s === "R$") return "R$";

  if (s === "%") return "%";

  return "qtd";
}

function buildIndicadores(
  catalogo: CatalogoRow[],
  realizados: Map<string, number>,
): Record<ServicoKey, IndicadorVM[]> {
  const out: Record<ServicoKey, IndicadorVM[]> = { FTTH: [], FWA: [], "5G": [], Banda: [] };

  for (const c of catalogo) {
    const card = SERVICO_TO_CARD[c.servico];

    if (!card) continue; // unknown service label → skip

    const key = defKey(c.id, c.servico);
    const disponivel = realizados.has(key);
    const realizado = disponivel ? (realizados.get(key) ?? 0) : 0;
    const polaridade = c.polaridade.toLowerCase().startsWith("menor") ? "down" : "up";
    const atingimento = c.meta > 0 ? (realizado / c.meta) * 100 : 0;
    const falta = polaridade === "up" ? Math.max(c.meta - realizado, 0) : 0;

    out[card].push({
      id: c.id,
      label: c.label,
      meta: c.meta,
      realizado,
      atingimento,
      falta,
      formato: toFormato(c.formato),
      polaridade,
      disponivel,
    });
  }

  // Computable indicators first, then alphabetical — stable, readable ordering.
  for (const k of Object.keys(out) as ServicoKey[]) {
    out[k].sort((a, b) => Number(b.disponivel) - Number(a.disponivel) || a.label.localeCompare(b.label));
  }

  return out;
}

// waves `servico` → the Mix de Vendas service bucket (INTERNET = FTTH).
const WAVES_SERVICO: Record<string, MixOferta["servico"]> = { INTERNET: "FTTH", FWA: "FWA", "5G": "5G" };
const STATUS_LABEL: Record<string, StatusVenda> = {
  CRIADO: "Criado",
  EFETIVADO: "Efetivado",
  INSTALADO: "Instalado",
};

/** Mix de Vendas: the vendor's real offers (`plano`) with per-status counts. */
async function fetchMixOfertas(hashUser: string, ym: string): Promise<MixOferta[]> {
  if (!HASH_RE.test(hashUser) || !YM_RE.test(ym)) return [];

  const [y, m] = ym.split("-");
  const incremento = `01-${m}-${y}`;
  const rows = await q(
    `SELECT plano titulo, servico, upper(status_venda) status, COUNT(DISTINCT orcamento_id) vendas
     FROM ${WAVES}
     WHERE hash_user = '${hashUser}' AND incremento = '${incremento}'
       AND servico IN ('INTERNET','FWA','5G')
       AND upper(status_venda) IN ('CRIADO','EFETIVADO','INSTALADO')
     GROUP BY plano, servico, upper(status_venda)
     HAVING COUNT(DISTINCT orcamento_id) > 0
     ORDER BY vendas DESC
     LIMIT 200`,
  );

  const out: MixOferta[] = [];

  for (const r of rows) {
    const servico = WAVES_SERVICO[str(r.servico)];
    const status = STATUS_LABEL[str(r.status)];

    if (!servico || !status) continue;

    out.push({ titulo: str(r.titulo) || "—", servico, status, vendas: num(r.vendas) });
  }

  return out;
}

/** The vendor's catalog indicators (meta × realizado) + Mix de Vendas offers. */
export async function fetchVendedorIndicadores(
  mat: number,
  ym: string,
): Promise<{ indicadores: Record<ServicoKey, IndicadorVM[]>; mix: MixOferta[] }> {
  const empty = {
    indicadores: { FTTH: [], FWA: [], "5G": [], Banda: [] } as Record<ServicoKey, IndicadorVM[]>,
    mix: [] as MixOferta[],
  };

  if (!Number.isFinite(mat) || !YM_RE.test(ym)) return empty;

  try {
    const catalogo = await fetchCatalogo(mat, ym);

    if (!catalogo.length) return empty;

    const hashUser = catalogo[0].hashUser;
    // Realizado and Mix degrade independently — a hiccup in one still renders the
    // other (and the metas always render, with realizado deferred).
    const [rz, mx] = await Promise.allSettled([fetchRealizados(hashUser, ym), fetchMixOfertas(hashUser, ym)]);
    const realizados = rz.status === "fulfilled" ? rz.value : new Map<string, number>();
    const mix = mx.status === "fulfilled" ? mx.value : [];

    return { indicadores: buildIndicadores(catalogo, realizados), mix };
  } catch {
    return empty;
  }
}
