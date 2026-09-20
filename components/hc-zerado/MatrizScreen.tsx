"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Award, RefreshCw } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { HcActiveContext, HcFilterPanel } from "./HcFilterPanel";
import { RegionalTable } from "./RegionalTable";
import { Block, SearchInput, card, nf, ptBr } from "./ui";
import { useReportNavPending } from "@/lib/ui/nav-pending";
import { hcFiltersToQuery, keepScreenParams } from "@/lib/data/hc-zerado/filters";
import type {
  HcFilterOptions,
  HcFilters,
  HcMatrizView,
  OciosidadeGroup,
  OciosidadeGrouping,
} from "@/lib/data/hc-zerado/types";

const GROUPINGS: Array<{ value: OciosidadeGrouping; label: string }> = [
  { value: "gerencia", label: "Gerência" },
  { value: "coordenacao", label: "Coordenação" },
  { value: "cidade", label: "Cidade" },
];

export function MatrizScreen({
  view,
  filters,
  options,
  grouping,
}: {
  view: HcMatrizView;
  filters: HcFilters;
  options: HcFilterOptions;
  grouping: OciosidadeGrouping;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const current = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");

  useReportNavPending(pending);

  const push = (q: URLSearchParams) =>
    startTransition(() => router.push(`${pathname}?${q.toString()}`, { scroll: false }));

  const changeGrouping = (value: string) => {
    const q = keepScreenParams(new URLSearchParams(hcFiltersToQuery(filters)), current);

    q.set("mg", value);
    push(q);
  };

  /** Only the Cidade table is clickable, as in the origin. */
  const toggleCidade = (nome: string) => {
    const q = keepScreenParams(new URLSearchParams(hcFiltersToQuery(filters)), current);

    if (q.get("cf_cidade") === nome) q.delete("cf_cidade");
    else q.set("cf_cidade", nome);

    push(q);
  };

  const label = GROUPINGS.find((g) => g.value === grouping)?.label ?? "Gerência";
  const found = useMemo(() => {
    const term = search.trim().toLowerCase();

    return term ? view.grupos.filter((g) => g.nome.toLowerCase().includes(term)) : view.grupos;
  }, [view.grupos, search]);
  // Heat range for the cards' colour scale — relative to what's on screen, so
  // it re-centers when the search narrows the set.
  const heatRange = useMemo(() => {
    const totals = found.map((g) => g.totalZerado);

    return totals.length === 0 ? { min: 0, max: 0 } : { min: Math.min(...totals), max: Math.max(...totals) };
  }, [found]);
  const switcher = (
    <Segmented
      options={GROUPINGS}
      value={grouping}
      onChange={changeGrouping}
      size="sm"
      ariaLabel="Hierarquia da matriz"
    />
  );

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
            Matriz Gerencial
          </h1>
          <p style={{ fontSize: 13, color: "var(--s-t3)", marginTop: 4 }}>
            Ociosidade comercial por {label.toLowerCase()} · referência {ptBr(view.d0)}
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

      <HcFilterPanel filters={filters} options={options} />
      <HcActiveContext filters={filters} />

      {grouping === "cidade" ? (
        <RegionalTable
          title="Desempenho Regional por Cidade"
          rows={view.cidades}
          days={view.days}
          label="Cidade"
          refDate={view.d0}
          selected={filters.cross.cidade}
          onSelect={toggleCidade}
          actions={switcher}
        />
      ) : (
        <Block
          title={`Matriz de Ociosidade por ${label}`}
          note={
            search.trim()
              ? `${nf.format(found.length)} de ${nf.format(view.grupos.length)} · ordenado do mais ocioso para o menos`
              : `Dados referentes a: ${ptBr(view.d0)} · ordenado do mais ocioso para o menos`
          }
          actions={
            <>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder={`Buscar ${label.toLowerCase()}...`}
                label="Buscar na matriz de ociosidade"
                width={130}
              />
              {switcher}
            </>
          }
        >
          {found.length === 0 ? (
            <div
              style={{
                padding: "26px 12px",
                textAlign: "center",
                fontSize: 12.5,
                fontWeight: 600,
                color: "var(--s-t3)",
              }}
            >
              {search.trim()
                ? "Nenhum grupo corresponde à busca."
                : "Ninguém ativo na data de referência. Ajuste o período ou os filtros."}
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                // `auto-fit` (not `auto-fill`) collapses columns nothing sits
                // in, so the `1fr` on the columns that DO have a card actually
                // redistributes the freed width to them — the cards fill the
                // row edge to edge instead of leaving a gap when the count
                // doesn't divide the width evenly.
                gridTemplateColumns: `repeat(auto-fit, minmax(${CARD_WIDTH}px, 1fr))`,
                gap: 12,
              }}
            >
              {found.map((g) => (
                <OciosidadeCard
                  key={g.nome}
                  group={g}
                  label={label}
                  heat={heatOf(g.totalZerado, heatRange.min, heatRange.max)}
                />
              ))}
            </div>
          )}
        </Block>
      )}
    </div>
  );
}

/**
 * Colour scale relative to the groups on screen: the one with the most
 * zeroed HC sits at the "hot" end (`--s-bad`), the one with the least at the
 * "cool" end (`--s-ok`) — `color-mix` blends the design tokens directly, so
 * it tracks light/dark without hardcoding a second palette.
 */
function heatOf(totalZerado: number, min: number, max: number): { fg: string; bg: string } {
  const t = max === min ? 50 : Math.round(((totalZerado - min) / (max - min)) * 100);

  return {
    fg: `color-mix(in srgb, var(--s-bad) ${t}%, var(--s-ok) ${100 - t}%)`,
    bg: `color-mix(in srgb, var(--s-bad-bg) ${t}%, var(--s-ok-bg) ${100 - t}%)`,
  };
}

const CARD_WIDTH = 268;
const CARD_HEIGHT = 540;

function OciosidadeCard({
  group,
  label,
  heat,
}: {
  group: OciosidadeGroup;
  label: string;
  heat: { fg: string; bg: string };
}) {
  // "Alerta máx" is an absolute signal (the whole group is idle) — it stays
  // tied to the group's own percentage, independent of the relative heat scale.
  const alerta = group.pctZerado >= 100;
  const tone = heat;

  return (
    <article
      style={{
        ...card,
        // Width comes from the grid cell (`minmax(CARD_WIDTH, 1fr)` on the
        // container) so the card stretches to fill it instead of leaving the
        // row's leftover space empty.
        minWidth: 0,
        height: CARD_HEIGHT,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          padding: "9px 11px 11px",
          borderBottom: "1px solid var(--s-border)",
          borderRadius: "14px 14px 0 0",
          background: tone.bg,
          flex: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "var(--s-t3)",
            }}
          >
            {label}
          </span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: ".06em",
              textTransform: "uppercase",
              padding: "2px 6px",
              borderRadius: 999,
              background: "var(--s-card)",
              // Stays a fixed red when triggered — the relative heat scale
              // could otherwise land it on the cool end (a small group where
              // everyone idle is still a small absolute number) and an
              // "Alerta máx" pill reading green would contradict itself.
              color: alerta ? "var(--s-bad)" : tone.fg,
            }}
          >
            {alerta ? "Alerta máx" : "Regional"}
          </span>
        </div>

        <h3
          className="font-display"
          title={group.nome}
          style={{
            fontSize: 12.5,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "-.01em",
            color: "var(--s-t1)",
            marginTop: 6,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {group.nome}
        </h3>

        <div style={{ textAlign: "center", padding: "8px 0 10px" }}>
          <div className="font-mono" style={{ fontSize: 30, fontWeight: 800, lineHeight: 1, color: tone.fg }}>
            {group.pctZerado}%
          </div>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "var(--s-t3)",
              marginTop: 4,
            }}
          >
            Ociosidade comercial
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 1,
            padding: 5,
            borderRadius: 10,
            background: "var(--s-card)",
          }}
        >
          <Kpi label="HC ativo" value={group.totalAtivo} />
          <Kpi label="Venderam" value={group.totalVenderam} color="var(--s-ok)" />
          <Kpi label="Zeraram" value={group.totalZerado} color="var(--s-bad)" />
        </div>
      </header>

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "8px 11px",
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "var(--s-t3)",
            borderBottom: "1px solid var(--s-border)",
          }}
        >
          <span>Lista de zerados</span>
          <span className="font-mono">{nf.format(group.totalZerado)}</span>
        </div>

        {group.zerados.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: 16,
              textAlign: "center",
            }}
          >
            <Award size={20} style={{ color: "var(--s-ok)" }} />
            <strong style={{ fontSize: 12, color: "var(--s-t1)" }}>Meta 100% batida</strong>
            <span style={{ fontSize: 11, color: "var(--s-t3)" }}>Todo o HC ativo vendeu nesta data.</span>
          </div>
        ) : (
          <ol style={{ flex: 1, overflowY: "auto", margin: 0, padding: 0, listStyle: "none" }}>
            {group.zerados.map((p, i) => (
              <li
                key={`${p.matricula}|${i}`}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 7,
                  padding: "6px 11px",
                  borderBottom: "1px solid var(--s-border)",
                }}
              >
                <span
                  className="font-mono"
                  style={{ fontSize: 9.5, color: "var(--s-t3)", minWidth: 16, textAlign: "right" }}
                >
                  {i + 1}
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span
                    title={p.consultor}
                    style={{
                      display: "block",
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: "var(--s-t1)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.consultor}
                  </span>
                  <span className="font-mono" style={{ fontSize: 9, color: "var(--s-t3)" }}>
                    Matr. {p.matricula || "—"}
                  </span>
                </span>
                <span
                  title={p.detalhe}
                  style={{
                    fontSize: 10,
                    color: "var(--s-t3)",
                    maxWidth: 82,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {p.detalhe}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </article>
  );
}

function Kpi({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          fontSize: 8.5,
          fontWeight: 700,
          letterSpacing: ".05em",
          textTransform: "uppercase",
          color: "var(--s-t3)",
        }}
      >
        {label}
      </div>
      <div
        className="font-mono"
        style={{ fontSize: 12.5, fontWeight: 800, color: color ?? "var(--s-t1)", marginTop: 2 }}
      >
        {nf.format(value)}
      </div>
    </div>
  );
}
