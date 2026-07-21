// Per-vendedor indicator catalog + realizado, for the Dashboard Vendedor cards.
//
// The catalog (which indicators a consultant has this month, their metas and the
// formula metadata) lives in `metas_vendedores_canais`. The realizado for each
// indicator is computed from the source table named in that catalog, joined to
// the vendedor by `hash_user` (or `matricula` for the renovação source).
//
// Each indicator declares a SELF-CONTAINED aggregation expression (`aggExpr`)
// evaluated as `SELECT <aggExpr> FROM <table> WHERE <join> AND <competência>`.
// Indicators sharing a source are batched into one query; a source is only
// queried when the vendor actually carries one of its indicators. All formulas
// were verified against Databricks (read-only) with independent cross-checks —
// see docs/data-map.md. Known data quirks handled here:
//   - status_venda is UPPERCASE; servico ∈ {INTERNET(=FTTH), FWA, 5G}.
//   - competência: waves/consolidado_5g/churn_bl use `incremento` (dd-MM-yyyy);
//     churn_5g uses `data_churn`; fidelizações use `data_efetivacao`.
//   - RE02-5G: catalog names waves but the columns live in consolidado_5g_pedido
//     (`preco_oferta` is comma-decimal → replace(',','.')). waves valor/valor_com_
//     desconto are dot-decimal.
//   - churn columns come back as fractions (0–1); the metas store % as fractions.
//   - VE52 uses `fibra_variacao_receita` (atual − anterior); the catalog metrica
//     had the sign inverted.

import { getDataClient } from "../client";
import { num } from "../_shared";
import type { IndicadorFormato, IndicadorVM, MixOferta, ServicoKey, StatusVenda } from "./types";

const CAT = process.env.DATABRICKS_SALES_CATALOG ?? "gdb_brisanet_comunidade_dev";
const ICM = `\`${CAT}\`.\`inteligencia_comercial_e_mercado\``;
const METAS = `\`${CAT}\`.\`projeto_brisa_performance\`.\`metas_vendedores_canais\``;
const WAVES = `${ICM}.\`waves_consolidado_orcamento\``;
const CINCO_G = `${ICM}.\`consolidado_5g_pedido\``;
const CHURN_BL = `${ICM}.\`waves_churnsafra_consultor\``;
const CHURN_5G = `${ICM}.\`churn_vendedor_5g\``;
// Renovações live in a different catalog and join by matricula (not hash_user).
const FIDELIZACOES = "`gdb_brisanet_comercial`.`gestao_clientes`.`relatorio_chamados_fidelizacoes`";

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

type Fonte = "waves" | "cinco_g" | "churn_bl" | "churn_5g" | "fidelizacoes";

interface SourceSpec {
  fonte: Fonte;
  table: string;
  joinCol: "hash_user" | "matricula";
  /** WHERE fragment for the competência; {INC}=dd-MM-yyyy, {YM}=yyyy-MM. */
  period: string;
}

const SOURCES: SourceSpec[] = [
  { fonte: "waves", table: WAVES, joinCol: "hash_user", period: "incremento = '{INC}'" },
  { fonte: "cinco_g", table: CINCO_G, joinCol: "hash_user", period: "incremento = '{INC}'" },
  { fonte: "churn_bl", table: CHURN_BL, joinCol: "hash_user", period: "incremento = '{INC}'" },
  {
    fonte: "churn_5g",
    table: CHURN_5G,
    joinCol: "hash_user",
    period: "date_format(data_churn,'yyyy-MM') = '{YM}'",
  },
  {
    fonte: "fidelizacoes",
    table: FIDELIZACOES,
    joinCol: "matricula",
    period: "date_format(data_efetivacao,'yyyy-MM') = '{YM}'",
  },
];

/**
 * Realizado per (id_indicador, servico). `aggExpr` is a self-contained scalar
 * over its source (all filters baked into CASE), so indicators sharing a source
 * batch into one query. Keyed on id AND servico because several indicators
 * (VE03, VE49, CA08, RE02) filter differently per service.
 */
interface RealizadoDef {
  id: string;
  servico: CatalogServico;
  fonte: Fonte;
  aggExpr: string;
}

const wavesCount = (cond: string) => `COUNT(DISTINCT CASE WHEN ${cond} THEN orcamento_id END)`;

const REALIZADO_DEFS: RealizadoDef[] = [
  // ── waves_consolidado_orcamento — vendas (COUNT DISTINCT orcamento_id) ──────
  {
    id: "VE03",
    servico: "FTTH",
    fonte: "waves",
    aggExpr: wavesCount("upper(status_venda)='INSTALADO' AND servico='INTERNET'"),
  },
  {
    id: "VE03",
    servico: "FWA",
    fonte: "waves",
    aggExpr: wavesCount("upper(status_venda)='INSTALADO' AND servico='FWA'"),
  },
  {
    id: "VE47",
    servico: "FTTH",
    fonte: "waves",
    aggExpr: wavesCount("upper(status_venda)='CRIADO' AND servico='INTERNET' AND upper(combo_5g)='NAO'"),
  },
  {
    id: "VE48",
    servico: "FTTH",
    fonte: "waves",
    aggExpr: wavesCount("upper(status_venda)='EFETIVADO' AND servico='INTERNET' AND upper(combo_5g)='NAO'"),
  },
  {
    id: "VE49",
    servico: "FTTH",
    fonte: "waves",
    aggExpr: wavesCount("upper(status_venda)='INSTALADO' AND servico='INTERNET' AND upper(combo_5g)='NAO'"),
  },
  {
    id: "VE49",
    servico: "Banda Larga",
    fonte: "waves",
    aggExpr: wavesCount(
      "upper(status_venda)='INSTALADO' AND servico IN ('INTERNET','FWA') AND upper(combo_5g)='NAO'",
    ),
  },
  {
    id: "VE09",
    servico: "FTTH",
    fonte: "waves",
    aggExpr: wavesCount(
      "upper(status_venda)='CRIADO' AND servico='INTERNET' AND upper(tipo_combo)='COMBO_1'",
    ),
  },
  {
    id: "VE12",
    servico: "FTTH",
    fonte: "waves",
    aggExpr: wavesCount(
      "upper(status_venda)='EFETIVADO' AND servico='INTERNET' AND upper(tipo_combo)='COMBO_1'",
    ),
  },
  {
    id: "VE15",
    servico: "FTTH",
    fonte: "waves",
    aggExpr: wavesCount(
      "upper(status_venda)='INSTALADO' AND servico='INTERNET' AND upper(tipo_combo)='COMBO_1'",
    ),
  },
  {
    id: "VE53",
    servico: "FTTH",
    fonte: "waves",
    aggExpr: wavesCount(
      "upper(status_venda)='CRIADO' AND servico='INTERNET' AND upper(tipo_combo) IN ('COMBO_2','COMBO_3')",
    ),
  },
  {
    id: "VE54",
    servico: "FTTH",
    fonte: "waves",
    aggExpr: wavesCount(
      "upper(status_venda)='EFETIVADO' AND servico='INTERNET' AND upper(tipo_combo) IN ('COMBO_2','COMBO_3')",
    ),
  },
  {
    id: "VE55",
    servico: "FTTH",
    fonte: "waves",
    aggExpr: wavesCount(
      "upper(status_venda)='INSTALADO' AND servico='INTERNET' AND upper(tipo_combo) IN ('COMBO_2','COMBO_3')",
    ),
  },
  {
    id: "VE46",
    servico: "FTTH",
    fonte: "waves",
    aggExpr: wavesCount("upper(status_venda)='INSTALADO' AND servico='INTERNET' AND upper(combo_5g)='SIM'"),
  },
  // ── waves — ticket (média R$; valor/valor_com_desconto são decimal com ponto) ─
  {
    id: "RE01",
    servico: "Banda Larga",
    fonte: "waves",
    aggExpr:
      "AVG(CASE WHEN upper(corporativo)='NAO' AND servico IN ('INTERNET','FWA') THEN CAST(valor_com_desconto AS DOUBLE) END)",
  },
  {
    id: "RE02",
    servico: "FTTH",
    fonte: "waves",
    aggExpr: "AVG(CASE WHEN upper(corporativo)='NAO' AND servico='INTERNET' THEN CAST(valor AS DOUBLE) END)",
  },
  // ── consolidado_5g_pedido — vendas + ticket 5G (preco_oferta é vírgula-decimal) ─
  { id: "VE04", servico: "5G", fonte: "cinco_g", aggExpr: "COUNT(DISTINCT n_do_pedido)" },
  {
    id: "VE51",
    servico: "5G",
    fonte: "cinco_g",
    aggExpr: "COUNT(DISTINCT CASE WHEN upper(combo_ftth_5g)='NAO' THEN n_do_pedido END)",
  },
  {
    id: "RE02",
    servico: "5G",
    fonte: "cinco_g",
    aggExpr: "AVG(CAST(replace(preco_oferta,',','.') AS DOUBLE))",
  },
  // ── waves_churnsafra_consultor — churn safra BL (fração; coluna 'cancelamentos') ─
  {
    id: "CA08",
    servico: "Banda Larga",
    fonte: "churn_bl",
    aggExpr: "SUM(CAST(cancelamentos AS DOUBLE))/NULLIF(SUM(CAST(instalacoes AS DOUBLE)),0)",
  },
  {
    id: "CA08",
    servico: "FTTH",
    fonte: "churn_bl",
    aggExpr:
      "SUM(CASE WHEN servico='INTERNET' THEN CAST(cancelamentos AS DOUBLE) END)/NULLIF(SUM(CASE WHEN servico='INTERNET' THEN CAST(instalacoes AS DOUBLE) END),0)",
  },
  // ── churn_vendedor_5g — churn safra c/ bloqueio 5G (fração; colunas bigint) ────
  {
    id: "CA10",
    servico: "5G",
    fonte: "churn_5g",
    aggExpr: "(SUM(bloqueados)+SUM(cancelados))/NULLIF(SUM(entrantes),0)",
  },
  // ── relatorio_chamados_fidelizacoes — renovação (join por matricula) ──────────
  { id: "VE30", servico: "FTTH", fonte: "fidelizacoes", aggExpr: "COUNT(*)" },
  {
    id: "VE50",
    servico: "FTTH",
    fonte: "fidelizacoes",
    aggExpr:
      "COUNT(CASE WHEN upper(todos_servicos_anterior) NOT LIKE '%MOVEL%' AND upper(todos_servicos_atual) LIKE '%MOVEL%' THEN 1 END)",
  },
  { id: "VE52", servico: "FTTH", fonte: "fidelizacoes", aggExpr: "SUM(fibra_variacao_receita)" },
  {
    id: "VE56",
    servico: "FTTH",
    fonte: "fidelizacoes",
    aggExpr:
      "COUNT(CASE WHEN cross_up_fibra <> 'DOWNSELL' AND upper(todos_servicos_atual) LIKE '%FIBRA%' THEN 1 END)",
  },
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

/**
 * Realizado per (id|servico). Batches by source into one query each; only
 * queries a source the vendor actually needs. Each source degrades on its own —
 * a failure or missing key leaves those indicators as `disponivel: false`.
 */
async function fetchRealizados(
  needed: Set<string>,
  hashUser: string,
  mat: number,
  ym: string,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();

  if (!YM_RE.test(ym)) return out;

  const [y, m] = ym.split("-");
  const inc = `01-${m}-${y}`;
  const validHash = HASH_RE.test(hashUser);
  const validMat = Number.isFinite(mat);

  const runSource = async (src: SourceSpec) => {
    const defs = REALIZADO_DEFS.filter((d) => d.fonte === src.fonte && needed.has(defKey(d.id, d.servico)));

    if (!defs.length) return;

    if (src.joinCol === "hash_user" && !validHash) return;

    if (src.joinCol === "matricula" && !validMat) return;

    const joinPred = src.joinCol === "matricula" ? `matricula = ${mat}` : `hash_user = '${hashUser}'`;
    const period = src.period.replace("{INC}", inc).replace("{YM}", ym);
    const cols = defs.map((d, i) => `${d.aggExpr} a${i}`).join(", ");

    try {
      const rows = await q(`SELECT ${cols} FROM ${src.table} WHERE ${joinPred} AND ${period}`);
      const r = rows[0] ?? {};

      defs.forEach((d, i) => out.set(defKey(d.id, d.servico), num(r[`a${i}`])));
    } catch {
      /* one source failing (e.g. permission) must not blank the others */
    }
  };

  await Promise.all(SOURCES.map(runSource));

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
    const needed = new Set(catalogo.map((c) => defKey(c.id, c.servico)));
    // Realizado and Mix degrade independently — a hiccup in one still renders the
    // other (and the metas always render, with realizado deferred).
    const [rz, mx] = await Promise.allSettled([
      fetchRealizados(needed, hashUser, mat, ym),
      fetchMixOfertas(hashUser, ym),
    ]);
    const realizados = rz.status === "fulfilled" ? rz.value : new Map<string, number>();
    const mix = mx.status === "fulfilled" ? mx.value : [];

    return { indicadores: buildIndicadores(catalogo, realizados), mix };
  } catch {
    return empty;
  }
}
