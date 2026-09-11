"use client";

import { CartesianGrid, LabelList, LineChart, Line, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Eye, MinusCircle, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Block, SearchInput, nf, ptBr } from "./ui";
import type { DayAxis, RegionalRow } from "@/lib/data/hc-zerado/types";

/**
 * "Desempenho Regional": HC active, who sold and who went idle on the reference
 * day, with the period's idleness as a sparkline. The Matriz Gerencial renders
 * the very same table for its Cidade view, which is why this takes rows rather
 * than reaching into a screen's view-model.
 */
export function RegionalTable({
  rows,
  days,
  label,
  refDate,
  title = "Desempenho Regional por Hierarquia",
  selected,
  onSelect,
  actions,
}: {
  rows: RegionalRow[];
  days: DayAxis[];
  /** What the first column is called — "Gerência", "Coordenação", "Cidade". */
  label: string;
  refDate: string;
  title?: string;
  selected?: string;
  onSelect?: (nome: string) => void;
  actions?: React.ReactNode;
}) {
  const selectedName = selected ?? "";
  const [search, setSearch] = useState("");
  const found = useMemo(() => {
    const term = search.trim().toLowerCase();

    return term ? rows.filter((r) => r.nome.toLowerCase().includes(term)) : rows;
  }, [rows, search]);
  const columns: Column<RegionalRow>[] = [
    {
      key: "nome",
      header: label,
      render: (r) => (
        <span
          style={{
            fontWeight: r.nome === selectedName ? 800 : 700,
            color: r.nome === selectedName ? "var(--s-brand)" : "var(--s-t1)",
          }}
        >
          {r.nome}
        </span>
      ),
    },
    {
      key: "ativo",
      header: "Total HC Ativo",
      numeric: true,
      align: "center",
      render: (r) => nf.format(r.totalAtivo),
    },
    {
      key: "vendeu",
      header: "QTD. HC Vendeu",
      numeric: true,
      align: "center",
      render: (r) => nf.format(r.totalWithSales),
    },
    {
      key: "pctv",
      header: "% QTD. HC Vendeu",
      numeric: true,
      align: "center",
      render: (r) => `${r.pctVendeu}%`,
    },
    {
      key: "zerou",
      header: "Total HC que Zerou",
      numeric: true,
      align: "center",
      render: (r) => (
        <span style={{ color: "var(--s-bad)", fontWeight: 800 }}>{nf.format(r.totalZerado)}</span>
      ),
    },
    {
      key: "pctz",
      header: "% HC que Zerou",
      numeric: true,
      align: "center",
      render: (r) => <span style={{ color: "var(--s-bad)", fontWeight: 800 }}>{r.pctZerado}%</span>,
    },
    { key: "d1", header: "Comparativo D-1", align: "center", render: (r) => <D1Comparison row={r} /> },
    {
      key: "obs",
      header: "Obs.",
      align: "center",
      render: (r) => (
        <TrendHover
          title={`Ociosidade (HC Zerado): ${r.nome}`}
          values={r.serieZerados}
          days={days}
          color="var(--s-bad)"
        />
      ),
    },
  ];

  return (
    <Block
      title={title}
      note={
        search.trim()
          ? `${nf.format(found.length)} de ${nf.format(rows.length)} · dados referentes a: ${ptBr(refDate)}`
          : `Dados referentes a: ${ptBr(refDate)}`
      }
      actions={
        <>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={`Buscar ${label.toLowerCase()}...`}
            label="Buscar na tabela regional"
            width={130}
          />
          {actions}
        </>
      }
    >
      <DataTable
        columns={columns}
        rows={found}
        rowKey={(r) => r.id}
        minWidth={880}
        maxHeight={420}
        pageSize={found.length > 40 ? 25 : undefined}
        infiniteScroll
        onRowClick={onSelect && ((r) => onSelect(r.nome))}
        isRowSelected={(r) => r.nome === selectedName}
        empty={
          search.trim()
            ? { title: "Nada encontrado", hint: "Nenhum nome corresponde à busca." }
            : { title: "Sem dados no período", hint: "Ajuste o período ou os filtros de hierarquia." }
        }
      />
    </Block>
  );
}

function D1Comparison({ row }: { row: RegionalRow }) {
  const delta = row.countZeradoD0 - row.countZeradoD1;
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    borderRadius: 6,
    padding: "1px 7px",
    fontSize: 11,
    fontWeight: 800,
  };

  if (delta === 0) {
    return (
      <span
        style={{ ...base, background: "var(--s-sunken)", color: "var(--s-t3)" }}
        title="Estável — sem alteração na quantidade de HC zerado"
      >
        <MinusCircle size={13} />0
      </span>
    );
  }

  const improved = delta < 0;
  const Icon = improved ? TrendingDown : TrendingUp;

  return (
    <span
      style={{
        ...base,
        background: improved ? "var(--s-ok-bg)" : "var(--s-bad-bg)",
        color: improved ? "var(--s-ok)" : "var(--s-bad)",
      }}
      title={`${improved ? "Melhorou" : "Piorou"} em ${Math.abs(delta)} HC — zerados de ${row.countZeradoD1} para ${row.countZeradoD0}`}
    >
      <Icon size={13} />
      {improved ? `-${Math.abs(delta)}` : `+${delta}`}
    </span>
  );
}

/**
 * The "Obs." column: an eye that opens the daily trend on hover.
 *
 * It goes through the shared Radix tooltip because these tables scroll — an
 * absolutely positioned card gets clipped by the scroll container, which is why
 * an inline sparkline read as "nothing happens".
 */
export function TrendHover({
  title,
  values,
  days,
  color,
}: {
  title: string;
  values: number[];
  days: DayAxis[];
  color: string;
}) {
  const points = values.map((value, i) => ({ label: days[i]?.label.replace(" - ", "-") ?? "", value }));

  return (
    <Tooltip delayDuration={80}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label={title}
          style={{
            display: "inline-grid",
            placeItems: "center",
            width: 26,
            height: 26,
            border: 0,
            borderRadius: 7,
            background: "transparent",
            color: "var(--s-t3)",
            cursor: "help",
          }}
        >
          <Eye size={14} />
        </button>
      </TooltipTrigger>
      {/* The shared tooltip paints itself with `bg-primary`, which is the brand
          red — a chart inside it disappears. This one is a panel, not a hint. */}
      <TooltipContent
        side="left"
        style={{
          width: 420,
          padding: 12,
          background: "var(--s-card)",
          color: "var(--s-t1)",
          border: "1px solid var(--s-border)",
          boxShadow: "var(--s-sh-2)",
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "var(--s-t3)",
            marginBottom: 6,
          }}
        >
          {title}
        </div>
        <div style={{ height: 150 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 16, right: 14, left: -12, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--s-border)" />
              <XAxis
                dataKey="label"
                padding={{ left: 12, right: 8 }}
                tick={{ fontSize: 9, fill: "var(--s-t2)", fontWeight: 600 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 8, fill: "var(--s-t3)" }}
                tickLine={false}
                axisLine={false}
                width={20}
                domain={[0, "dataMax + 1"]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              >
                <LabelList
                  dataKey="value"
                  position="top"
                  style={{ fill: color, fontSize: 9, fontWeight: 700 }}
                />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
