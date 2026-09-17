"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RefreshCw, Sparkles, User } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { HcActiveContext, HcFilterPanel } from "./HcFilterPanel";
import {
  Block,
  SERVICO_LABEL,
  SERVICO_ROWS,
  SearchInput,
  matrizTd,
  matrizTh,
  nf,
  stickyCol,
  tooltipLine,
  tooltipPanel,
  tooltipTitle,
} from "./ui";
import { useReportNavPending } from "@/lib/ui/nav-pending";
import { hcFiltersToQuery, keepScreenParams } from "@/lib/data/hc-zerado/filters";
import type {
  HcFilterOptions,
  HcFilters,
  HcProdutividadeView,
  HcZeradosView,
  MonthAxis,
  ProdutividadeGrouping,
  ProdutividadeRow,
} from "@/lib/data/hc-zerado/types";

const GROUPINGS: Array<{ value: ProdutividadeGrouping; label: string }> = [
  { value: "vendedor", label: "Vendedor" },
  { value: "gerencia", label: "Gerência" },
  { value: "coordenacao", label: "Coordenação" },
  { value: "cidade", label: "Cidade" },
];

export type ProdutividadeTab = "produtividade" | "zerados";

const TABS: Array<{ value: ProdutividadeTab; label: string }> = [
  { value: "produtividade", label: "Produtividade Mensal" },
  { value: "zerados", label: "Média de Zerados" },
];

const COL_NAME = 200;
const COL_CANAL = 128;
const COL_EXP = 104;
const COL_SERVICO = 96;
const COL_MONTH = 74;

/** Rows added each time the body scrolls near its end. */
const CHUNK = 40;

const dec = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function ProdutividadeScreen({
  produtividade,
  zerados,
  filters,
  options,
  grouping,
  tab: initialTab,
}: {
  produtividade: HcProdutividadeView;
  zerados: HcZeradosView;
  filters: HcFilters;
  options: HcFilterOptions;
  grouping: { produtividade: ProdutividadeGrouping; zerados: ProdutividadeGrouping };
  tab: ProdutividadeTab;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const current = useSearchParams();
  const [pending, startTransition] = useTransition();
  // Switching tab is instant client state, but changing a hierarchy navigates,
  // and the route remounts under its `loading.tsx` — which would drop that
  // state and drag the user back to the first tab. So the tab is seeded from
  // the URL and travels with every navigation this screen starts.
  const [tab, setTab] = useState<ProdutividadeTab>(initialTab);

  useReportNavPending(pending);

  const changeGrouping = (param: "ap" | "az") => (value: string) => {
    const q = keepScreenParams(new URLSearchParams(hcFiltersToQuery(filters)), current);

    // Both hierarchies and the open tab are this screen's state: pin them all,
    // or changing one would reset the others to their default.
    q.set("ap", grouping.produtividade);
    q.set("az", grouping.zerados);
    q.set("aba", tab);
    q.set(param, value);
    startTransition(() => router.push(`${pathname}?${q.toString()}`, { scroll: false }));
  };

  const months = produtividade.months;
  const window =
    months.length > 0 ? `${months[0].label} a ${months[months.length - 1].label}` : "sem período";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: "16px 16px 40px",
        minWidth: 0,
        opacity: pending ? 0.6 : 1,
        pointerEvents: pending ? "none" : "auto",
        transition: "opacity .18s",
        animation: "bdIn .3s ease both",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          padding: "2px 2px 0",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: ".11em",
              textTransform: "uppercase",
              color: "var(--s-brand)",
            }}
          >
            Brisanet · HC &amp; Zero Vendas
          </div>
          <h1
            style={{
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: "-.025em",
              lineHeight: 1.05,
              marginTop: 4,
            }}
          >
            Análise de Produtividade
          </h1>
          <p style={{ fontSize: 13, color: "var(--s-t3)", marginTop: 4 }}>
            Doze meses encerrados no período filtrado · {window}
          </p>
        </div>
        <button
          type="button"
          onClick={() => startTransition(() => router.refresh())}
          className="bd-ghost"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            height: 34,
            padding: "0 14px",
            border: "1px solid var(--s-border)",
            borderRadius: 999,
            background: "var(--s-card)",
            color: "var(--s-t2)",
            font: "inherit",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            transition: ".16s",
          }}
        >
          <RefreshCw size={14} />
          Atualizar
        </button>
      </header>

      <HcFilterPanel filters={filters} options={options} showExperiencia />
      <HcActiveContext filters={filters} />

      {tab === "produtividade" ? (
        <ProdutividadeBlock
          view={produtividade}
          grouping={grouping.produtividade}
          onGrouping={changeGrouping("ap")}
          tabs={<Segmented options={TABS} value={tab} onChange={setTab} size="sm" ariaLabel="Aba" />}
        />
      ) : (
        <ZeradosBlock
          view={zerados}
          grouping={grouping.zerados}
          onGrouping={changeGrouping("az")}
          tabs={<Segmented options={TABS} value={tab} onChange={setTab} size="sm" ariaLabel="Aba" />}
        />
      )}
    </div>
  );
}

/** Search box + hierarchy switch, identical on both tabs. */
function Controls({
  search,
  onSearch,
  grouping,
  onGrouping,
  placeholder,
}: {
  search: string;
  onSearch: (v: string) => void;
  grouping: ProdutividadeGrouping;
  onGrouping: (v: string) => void;
  placeholder: string;
}) {
  return (
    <>
      <SearchInput value={search} onChange={onSearch} placeholder={placeholder} />
      <Segmented
        options={GROUPINGS}
        value={grouping}
        onChange={onGrouping}
        size="sm"
        ariaLabel="Hierarquia da matriz"
      />
    </>
  );
}

/** Grows the visible slice as the body scrolls, instead of paging it. */
function useInfiniteRows<T>(rows: T[]): {
  visible: T[];
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  note: string;
} {
  const [limit, setLimit] = useState(CHUNK);
  const shown = Math.min(limit, rows.length);

  return {
    visible: useMemo(() => rows.slice(0, shown), [rows, shown]),
    onScroll: (e) => {
      const el = e.currentTarget;

      if (shown < rows.length && el.scrollHeight - el.scrollTop - el.clientHeight < 240)
        setLimit((n) => n + CHUNK);
    },
    note:
      shown < rows.length
        ? `${nf.format(shown)} de ${nf.format(rows.length)} · role para ver mais`
        : `${nf.format(rows.length)} ${rows.length === 1 ? "linha" : "linhas"}`,
  };
}

function useSearch<T extends { nome: string }>(rows: T[], search: string): T[] {
  return useMemo(() => {
    const term = search.trim().toLowerCase();

    return term ? rows.filter((r) => r.nome.toLowerCase().includes(term)) : rows;
  }, [rows, search]);
}

function MonthHeaders({ months }: { months: MonthAxis[] }) {
  return (
    <>
      {months.map((m) => (
        <th key={m.month} style={{ ...matrizTh, minWidth: COL_MONTH }}>
          {m.label}
        </th>
      ))}
      <th style={{ ...matrizTh, minWidth: 92, borderLeft: "2px solid var(--s-border)" }}>Consolidado</th>
    </>
  );
}

const rowBorder = "1px solid var(--s-border)";

/* ------------------------------------------------------- Aba: Produtividade */

function ProdutividadeBlock({
  view,
  grouping,
  onGrouping,
  tabs,
}: {
  view: HcProdutividadeView;
  grouping: ProdutividadeGrouping;
  onGrouping: (v: string) => void;
  tabs: React.ReactNode;
}) {
  const [search, setSearch] = useState("");
  const found = useSearch(view.rows, search);
  const { visible, onScroll, note } = useInfiniteRows(found);
  const isSeller = grouping === "vendedor";

  // One tooltip driven by mouse events, not a Radix root per cell: the grid is
  // tens of thousands of cells and at most one shows a card at a time.
  const areaRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<{
    month: string;
    servico: string;
    value: number;
    breakdown: Array<[string, number]>;
    x: number;
    y: number;
  } | null>(null);

  const onCellEnter = (
    e: React.MouseEvent<HTMLTableCellElement>,
    row: ProdutividadeRow,
    servico: string,
    i: number,
    value: number,
  ) => {
    const area = areaRef.current?.getBoundingClientRect();

    if (value <= 0 || !area) {
      setHovered(null);

      return;
    }

    const cell = e.currentTarget.getBoundingClientRect();
    // Clamped so a cell near either edge keeps the card inside the block.
    const center = cell.left - area.left + cell.width / 2;

    setHovered({
      month: view.months[i]?.label ?? "",
      servico,
      value,
      breakdown: row.breakdown[`${servico}|${i}`] ?? [],
      x: Math.min(Math.max(center, 120), Math.max(120, area.width - 120)),
      y: cell.top - area.top,
    });
  };

  // Canal describes a person; the hierarchy views drop the column, as in the
  // origin, and carry the team size under the group's name instead.
  const servicoAt = isSeller ? COL_NAME + COL_CANAL : COL_NAME;
  const frozen = servicoAt + COL_SERVICO;

  return (
    <Block
      title="Produtividade Mensal Detalhada"
      note={`${note} · passe o mouse num número para ver a quebra por indicador`}
      actions={
        <>
          {tabs}
          <Controls
            search={search}
            onSearch={setSearch}
            grouping={grouping}
            onGrouping={onGrouping}
            placeholder={isSeller ? "Localizar vendedor..." : "Localizar grupo..."}
          />
        </>
      }
    >
      <div ref={areaRef} style={{ position: "relative" }}>
        <div style={{ overflow: "auto", maxHeight: 520 }} onScroll={onScroll}>
          <table
            style={{
              borderCollapse: "separate",
              borderSpacing: 0,
              fontSize: 11.5,
              minWidth: frozen + view.months.length * COL_MONTH + 92,
            }}
          >
            <thead>
              <tr>
                <th style={{ ...matrizTh, ...stickyCol(0, COL_NAME), zIndex: 4, textAlign: "left" }}>
                  {GROUPINGS.find((g) => g.value === grouping)?.label}
                </th>
                {isSeller && (
                  <th
                    style={{
                      ...matrizTh,
                      ...stickyCol(COL_NAME, COL_CANAL),
                      zIndex: 4,
                      textAlign: "left",
                    }}
                  >
                    Canal
                  </th>
                )}
                <th
                  style={{
                    ...matrizTh,
                    ...stickyCol(servicoAt, COL_SERVICO),
                    zIndex: 4,
                    textAlign: "left",
                    borderRight: "2px solid var(--s-border)",
                  }}
                >
                  Serviço
                </th>
                <MonthHeaders months={view.months} />
              </tr>
            </thead>
            <tbody>
              {visible.map((row) =>
                SERVICO_ROWS.map((servico, s) => {
                  const first = s === 0;
                  const series = row.values[servico];

                  return (
                    <tr key={`${row.id}|${servico}`}>
                      {first && (
                        <>
                          <td
                            rowSpan={SERVICO_ROWS.length}
                            style={{
                              ...matrizTd,
                              ...stickyCol(0, COL_NAME),
                              background: "var(--s-card)",
                              borderTop: rowBorder,
                              verticalAlign: "middle",
                              whiteSpace: "normal",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              {isSeller && <User size={12} style={{ color: "var(--s-t3)", flex: "none" }} />}
                              <span style={{ fontWeight: 700, color: "var(--s-t1)" }} title={row.nome}>
                                {row.nome}
                              </span>
                            </div>
                            {isSeller && (
                              <ExperienciaBadge experiencia={row.experiencia} dias={row.diasExperiencia} />
                            )}
                            <div style={{ fontSize: 10.5, color: "var(--s-t3)", marginTop: 2 }}>
                              {!isSeller && <>{row.detalhe} · </>}
                              Total: <strong className="font-mono">{nf.format(row.total)}</strong>
                            </div>
                          </td>
                          {isSeller && (
                            <td
                              rowSpan={SERVICO_ROWS.length}
                              style={{
                                ...matrizTd,
                                ...stickyCol(COL_NAME, COL_CANAL),
                                background: "var(--s-card)",
                                borderTop: rowBorder,
                                verticalAlign: "middle",
                                color: "var(--s-t2)",
                                whiteSpace: "normal",
                              }}
                            >
                              {row.detalhe}
                            </td>
                          )}
                        </>
                      )}
                      <td
                        style={{
                          ...matrizTd,
                          ...stickyCol(servicoAt, COL_SERVICO),
                          background: "var(--s-sunken)",
                          borderRight: "2px solid var(--s-border)",
                          borderTop: first ? rowBorder : undefined,
                          fontWeight: 700,
                          color: "var(--s-t2)",
                        }}
                      >
                        {SERVICO_LABEL[servico] ?? servico}
                      </td>
                      {view.months.map((m, i) => {
                        const v = series?.[i] ?? 0;

                        return (
                          <td
                            key={m.month}
                            onMouseEnter={(e) => onCellEnter(e, row, servico, i, v)}
                            onMouseLeave={() => setHovered(null)}
                            style={{
                              ...matrizTd,
                              minWidth: COL_MONTH,
                              textAlign: "center",
                              borderTop: first ? rowBorder : undefined,
                              color: v > 0 ? "var(--s-t1)" : "var(--s-t3)",
                              fontWeight: v > 0 ? 800 : 400,
                              background: v > 0 ? "var(--s-brand-weak)" : undefined,
                              cursor: v > 0 ? "help" : undefined,
                            }}
                          >
                            {v > 0 ? nf.format(v) : "·"}
                          </td>
                        );
                      })}
                      <td
                        style={{
                          ...matrizTd,
                          textAlign: "center",
                          fontWeight: 800,
                          background: "var(--s-sunken)",
                          borderLeft: "2px solid var(--s-border)",
                          borderTop: first ? rowBorder : undefined,
                        }}
                      >
                        {nf.format(row.totals[servico] ?? 0)}
                      </td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>

        {found.length === 0 && <Empty />}

        {hovered && (
          <div
            style={{
              ...tooltipPanel,
              position: "absolute",
              zIndex: 20,
              width: 224,
              left: hovered.x,
              top: hovered.y - 8,
              transform: "translate(-50%, -100%)",
              pointerEvents: "none",
              gap: 4,
              padding: "9px 11px",
            }}
          >
            <span style={{ ...tooltipTitle, display: "flex", justifyContent: "space-between", gap: 10 }}>
              <span>Detalhamento do mês</span>
              <span className="font-mono">{hovered.month}</span>
            </span>
            <span style={{ ...tooltipLine, color: "var(--s-brand-2)" }}>
              <span>Serviço</span>
              <span>{SERVICO_LABEL[hovered.servico] ?? hovered.servico}</span>
            </span>
            {hovered.breakdown.length === 0 ? (
              <span style={{ ...tooltipLine, fontWeight: 500, opacity: 0.6, justifyContent: "center" }}>
                Sem indicador na fonte
              </span>
            ) : (
              hovered.breakdown.map(([indicador, value]) => (
                <span key={indicador} style={{ ...tooltipLine, fontSize: 11.5 }}>
                  <span style={{ opacity: 0.7, fontWeight: 600 }}>{indicador}</span>
                  <span className="font-mono">{nf.format(value)}</span>
                </span>
              ))
            )}
            <span
              style={{
                ...tooltipLine,
                borderTop: "1px solid rgba(255,255,255,.16)",
                paddingTop: 4,
                marginTop: 2,
              }}
            >
              <span style={{ opacity: 0.7 }}>Total consolidado</span>
              <span className="font-mono">{nf.format(hovered.value)}</span>
            </span>
          </div>
        )}
      </div>
    </Block>
  );
}

/**
 * "Em exp. (N dias)" while the probation period runs, "Efetivado" after it.
 * The day count is only meaningful during probation: the source stores 0 for
 * everyone already effective.
 */
function ExperienciaBadge({
  experiencia,
  dias,
  diasOnly = false,
}: {
  experiencia: string;
  dias: number | null;
  /** Column form: the days alone, and a dash for whoever is already effective. */
  diasOnly?: boolean;
}) {
  const emExperiencia = experiencia.toUpperCase().startsWith("EM EXP");

  if (diasOnly && !emExperiencia) return <span style={{ color: "var(--s-t3)" }}>—</span>;

  return (
    <span
      style={{
        display: "inline-block",
        marginTop: diasOnly ? 0 : 3,
        padding: "1px 6px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 700,
        background: emExperiencia ? "var(--s-warn-bg)" : "var(--s-sunken)",
        color: emExperiencia ? "var(--s-warn)" : "var(--s-t3)",
      }}
    >
      {!emExperiencia
        ? "Efetivado"
        : diasOnly
          ? `${dias ?? 0} dias`
          : `Em exp.${dias ? ` (${dias} dias)` : ""}`}
    </span>
  );
}

/* ----------------------------------------------------- Aba: Média de Zerados */

/** Idleness bands, as in the origin: up to 20% good, up to 50% fair, over it bad. */
function band(pct: number): { fg: string; bg: string } | null {
  if (pct <= 0) return null;

  if (pct < 0.2) return { fg: "var(--s-ok)", bg: "var(--s-ok-bg)" };

  if (pct <= 0.5) return { fg: "var(--s-warn)", bg: "var(--s-warn-bg)" };

  return { fg: "var(--s-bad)", bg: "var(--s-bad-bg)" };
}

function ZeradosBlock({
  view,
  grouping,
  onGrouping,
  tabs,
}: {
  view: HcZeradosView;
  grouping: ProdutividadeGrouping;
  onGrouping: (v: string) => void;
  tabs: React.ReactNode;
}) {
  const [search, setSearch] = useState("");
  const found = useSearch(view.rows, search);
  const { visible, onScroll, note } = useInfiniteRows(found);
  const isSeller = grouping === "vendedor";
  // Same rule as the other tab: the per-person columns only exist in the
  // seller view, and a group carries its size under its name.
  const frozen = isSeller ? COL_NAME + COL_EXP + COL_CANAL : COL_NAME;

  return (
    <Block
      title="Média de Zerados por Mês"
      note={note}
      actions={
        <>
          {tabs}
          <Controls
            search={search}
            onSearch={setSearch}
            grouping={grouping}
            onGrouping={onGrouping}
            placeholder={isSeller ? "Localizar vendedor..." : "Localizar grupo..."}
          />
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Metodologia isSeller={isSeller} />

        <div style={{ overflow: "auto", maxHeight: 520 }} onScroll={onScroll}>
          <table
            style={{
              borderCollapse: "separate",
              borderSpacing: 0,
              fontSize: 11.5,
              minWidth: frozen + view.months.length * COL_MONTH + 92,
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    ...matrizTh,
                    ...stickyCol(0, COL_NAME),
                    zIndex: 4,
                    textAlign: "left",
                    borderRight: isSeller ? undefined : "2px solid var(--s-border)",
                  }}
                >
                  {GROUPINGS.find((g) => g.value === grouping)?.label}
                </th>
                {isSeller && (
                  <>
                    <th style={{ ...matrizTh, ...stickyCol(COL_NAME, COL_EXP), zIndex: 4 }}>
                      Dias Restantes Exp.
                    </th>
                    <th
                      style={{
                        ...matrizTh,
                        ...stickyCol(COL_NAME + COL_EXP, COL_CANAL),
                        zIndex: 4,
                        textAlign: "left",
                        borderRight: "2px solid var(--s-border)",
                      }}
                    >
                      Canal
                    </th>
                  </>
                )}
                <MonthHeaders months={view.months} />
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id}>
                  <td
                    style={{
                      ...matrizTd,
                      ...stickyCol(0, COL_NAME),
                      background: "var(--s-card)",
                      borderTop: rowBorder,
                      whiteSpace: "normal",
                      fontWeight: 700,
                      color: "var(--s-t1)",
                      borderRight: isSeller ? undefined : "2px solid var(--s-border)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      {isSeller && <User size={12} style={{ color: "var(--s-t3)", flex: "none" }} />}
                      <span title={row.nome}>{row.nome}</span>
                    </div>
                    {!isSeller && (
                      <div style={{ fontSize: 10.5, fontWeight: 500, color: "var(--s-t3)", marginTop: 1 }}>
                        {row.detalhe}
                      </div>
                    )}
                  </td>
                  {isSeller && (
                    <>
                      <td
                        style={{
                          ...matrizTd,
                          ...stickyCol(COL_NAME, COL_EXP),
                          background: "var(--s-card)",
                          borderTop: rowBorder,
                          textAlign: "center",
                        }}
                      >
                        <ExperienciaBadge experiencia={row.experiencia} dias={row.diasExperiencia} diasOnly />
                      </td>
                      <td
                        style={{
                          ...matrizTd,
                          ...stickyCol(COL_NAME + COL_EXP, COL_CANAL),
                          background: "var(--s-card)",
                          borderTop: rowBorder,
                          borderRight: "2px solid var(--s-border)",
                          color: "var(--s-t2)",
                          whiteSpace: "normal",
                        }}
                      >
                        {row.detalhe}
                      </td>
                    </>
                  )}
                  {view.months.map((m, i) => (
                    <Cell key={m.month} value={row.values[i]} pct={row.pcts[i]} />
                  ))}
                  <Cell
                    value={row.consolidado}
                    pct={row.consolidadoPct}
                    style={{
                      background: "var(--s-sunken)",
                      borderLeft: "2px solid var(--s-border)",
                      fontWeight: 800,
                    }}
                  />
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {found.length === 0 && <Empty />}

        <Legenda />
      </div>
    </Block>
  );
}

function Cell({ value, pct, style }: { value: number; pct: number; style?: React.CSSProperties }) {
  const tone = band(pct);

  return (
    <td
      style={{
        ...matrizTd,
        minWidth: COL_MONTH,
        textAlign: "center",
        borderTop: rowBorder,
        color: tone?.fg ?? "var(--s-t3)",
        background: tone?.bg,
        fontWeight: tone ? 700 : 400,
        ...style,
      }}
    >
      {value > 0 ? (
        <>
          <span className="font-mono">{dec.format(value)}</span>
          <span style={{ fontSize: 9.5, fontWeight: 600, opacity: 0.7, marginLeft: 3 }}>
            {Math.round(pct * 100)}%
          </span>
        </>
      ) : (
        "·"
      )}
    </td>
  );
}

function Metodologia({ isSeller }: { isSeller: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 9,
        padding: "10px 12px",
        border: "1px solid var(--s-border)",
        borderRadius: 12,
        background: "var(--s-sunken)",
      }}
    >
      <Sparkles size={14} style={{ color: "var(--s-brand)", flex: "none", marginTop: 1 }} />
      <div style={{ fontSize: 11.5, color: "var(--s-t2)", lineHeight: 1.5 }}>
        <strong style={{ color: "var(--s-t1)" }}>
          {isSeller ? "Visão vendedor: " : "Visão hierárquica: "}
        </strong>
        {isSeller
          ? "quantos dias úteis o consultor passou sem vender, sobre o calendário do estado dele. O consolidado divide só pelos meses em que ele esteve na base."
          : "o HC médio ocioso num dia útil — dias-pessoa zerados ÷ dias úteis do mês. O percentual compara esse HC com o tamanho da equipe."}{" "}
        Dia útil é todo dia da fonte que não é feriado, sábado incluído.
      </div>
    </div>
  );
}

function Legenda() {
  const items = [
    { label: "Ótimo (< 20%)", hint: "baixa ocorrência de ociosidade", tone: band(0.1)! },
    { label: "Médio (20% a 50%)", hint: "aceitável, mas pede atenção", tone: band(0.3)! },
    { label: "Alerta (> 50%)", hint: "zerado na maior parte dos dias úteis", tone: band(0.9)! },
  ];

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {items.map((i) => (
        <span
          key={i.label}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 10px",
            borderRadius: 999,
            background: i.tone.bg,
            color: i.tone.fg,
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: 999, background: i.tone.fg }} />
          {i.label}
          <span style={{ fontWeight: 500, opacity: 0.8 }}>· {i.hint}</span>
        </span>
      ))}
    </div>
  );
}

function Empty() {
  return (
    <div
      style={{
        padding: "26px 12px",
        textAlign: "center",
        fontSize: 12.5,
        fontWeight: 600,
        color: "var(--s-t3)",
      }}
    >
      Nenhum registro corresponde aos filtros selecionados.
    </div>
  );
}
