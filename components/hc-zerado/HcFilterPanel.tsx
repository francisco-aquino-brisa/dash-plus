"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { ChipFilter, FilterClearButton } from "@/components/ui/chip-filter";
import { DateFilter } from "@/components/ui/date-filter";
import { MultiChipFilter } from "./MultiChipFilter";
import { useReportNavPending } from "@/lib/ui/nav-pending";
import {
  clampRange,
  defaultHcRange,
  periodLabel,
  MAX_RANGE_DAYS,
  parseIso,
  parsePeriodLabel,
} from "@/lib/data/hc-zerado/dates";
import { hcFiltersToQuery, keepScreenParams, statusLockIgnored } from "@/lib/data/hc-zerado/filters";
import type {
  Agilidade,
  Experiencia,
  HcFilterOptions,
  HcFilters,
  PerfilCidade,
  StatusVenda,
} from "@/lib/data/hc-zerado/types";

const ALL = "Todos";

const AGILIDADE: Record<string, Agilidade> = {
  Todos: "",
  "Efetivado m. dia": "efetivado",
  "Instalado m. dia": "instalado",
};

const PERFIS: Record<string, PerfilCidade> = {
  Todos: "",
  FTTH: "FTTH",
  HÍBRIDA: "HIBRIDA",
  "5G ONLY": "ONLY",
};
const EXPERIENCIAS: Record<string, Experiencia> = { Todos: "", "Em Exp.": "Em Exp.", Efetivo: "Efetivo" };

function keyOf<T extends string>(map: Record<string, T>, value: T): string {
  return Object.keys(map).find((k) => map[k] === value) ?? ALL;
}

/**
 * The filter bar shared by every HC Zerado screen — a port of the original
 * "Parâmetros de Filtros e Seleção", rebuilt on the app's own chip filters
 * (DESIGN_SYSTEM §4.1/§4.2). The multi-selects keep the original's behaviour of
 * picking several values at once.
 *
 * The URL is the source of truth: every chip rewrites the querystring, which the
 * server reads to build the aggregation. That keeps a filtered screen shareable,
 * the back button meaningful, and the context alive when moving between the
 * module's five screens.
 */
export function HcFilterPanel({
  filters,
  options,
  showExperiencia = false,
  locked,
}: {
  filters: HcFilters;
  options: HcFilterOptions;
  /** The experience cut only exists on Análise de Produtividade. */
  showExperiencia?: boolean;
  /**
   * Sale-side fields to hide, because the screen does not answer to them.
   * Justificar HC decides "zerado" from `regras_justificativa_hc` instead of from
   * the panel, so leaving these chips on screen would let a user set a filter
   * that changes nothing — worse than not offering it. `indicador` is included
   * for the same reason: the rules have no indicator dimension.
   */
  locked?: { servico?: boolean; status?: boolean; agilidade?: boolean; indicador?: boolean };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const current = useSearchParams();
  const [pending, startTransition] = useTransition();

  useReportNavPending(pending);

  const apply = (patch: Partial<HcFilters>) => {
    const next = { ...filters, ...patch };
    const range = clampRange(next.from, next.to);
    const q = keepScreenParams(
      new URLSearchParams(hcFiltersToQuery({ ...next, from: range.from, to: range.to })),
      current,
    );

    startTransition(() => {
      router.push(`${pathname}?${q.toString()}`, { scroll: false });
    });
  };

  const defaults = defaultHcRange();
  const statusLocked =
    statusLockIgnored(filters.cross.servico ? [filters.cross.servico] : filters.servico) || locked?.status;
  const multiFilters: Array<{
    label: string;
    values: string[];
    options: string[];
    onChange: (v: string[]) => void;
    align?: "start" | "end";
  }> = [
    {
      label: "Gerência",
      values: filters.gerente,
      options: options.gerentes,
      onChange: (v) => apply({ gerente: v }),
    },
    {
      label: "Coordenação",
      values: filters.coordenacao,
      options: options.coordenacoes,
      onChange: (v) => apply({ coordenacao: v }),
    },
    {
      label: "Supervisão",
      values: filters.supervisao,
      options: options.supervisoes,
      onChange: (v) => apply({ supervisao: v }),
    },
    {
      label: "Líder",
      values: filters.lider,
      options: options.lideres,
      onChange: (v) => apply({ lider: v }),
    },
    {
      label: "Cidade",
      values: filters.cidade,
      options: options.cidades,
      onChange: (v) => apply({ cidade: v }),
      align: "end",
    },
    {
      label: "Consultor",
      values: filters.consultor,
      options: options.consultores,
      onChange: (v) => apply({ consultor: v }),
      align: "end",
    },
    { label: "Canal", values: filters.canal, options: options.canais, onChange: (v) => apply({ canal: v }) },
    { label: "Nicho", values: filters.nicho, options: options.nichos, onChange: (v) => apply({ nicho: v }) },
    ...(locked?.servico
      ? []
      : [
          {
            label: "Serviço",
            values: filters.servico,
            options: options.servicos,
            onChange: (v: string[]) => apply({ servico: v }),
          },
        ]),
    ...(locked?.indicador
      ? []
      : [
          {
            label: "Indicador",
            values: filters.indicador,
            options: options.indicadores,
            onChange: (v: string[]) => apply({ indicador: v }),
            align: "end" as const,
          },
        ]),
  ];

  // A hidden chip is not a dirty one — the screen ignores it either way.
  const dirtyCount =
    (filters.from !== defaults.from || filters.to !== defaults.to ? 1 : 0) +
    multiFilters.filter((m) => m.values.length > 0).length +
    (!statusLocked && filters.statusVenda !== "CRIADO" ? 1 : 0) +
    (!locked?.agilidade && filters.agilidade ? 1 : 0) +
    (filters.perfilCidade ? 1 : 0) +
    (filters.experiencia ? 1 : 0);

  return (
    <div style={{ position: "sticky", top: 0, zIndex: 30, paddingTop: 4 }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          background: "var(--s-card)",
          border: "1px solid var(--s-border)",
          borderRadius: "var(--r-panel)",
          boxShadow: "var(--s-sh)",
        }}
      >
        <DateFilter
          label="Período"
          value={periodLabel(filters.from, filters.to)}
          defaultValue={periodLabel(defaults.from, defaults.to)}
          onChange={(v) => {
            const range = parsePeriodLabel(v);

            if (range) apply(range);
          }}
          initialMode="intervalo"
          modes={["intervalo", "mes", "dia"]}
          initialMonth={parseIso(filters.to)}
          maxRangeDays={MAX_RANGE_DAYS}
          maxDate={new Date()}
        />
        {multiFilters.map((m) => (
          <MultiChipFilter
            key={m.label}
            label={m.label}
            values={m.values}
            options={m.options}
            onChange={m.onChange}
            align={m.align}
            maxVisible={m.label === "Cidade" ? 100 : undefined}
          />
        ))}
        {!statusLocked && (
          <ChipFilter
            label="Status da venda"
            value={filters.statusVenda}
            options={["CRIADO", "EFETIVADO", "INSTALADO"]}
            defaultValue="CRIADO"
            onChange={(v) => apply({ statusVenda: v as StatusVenda })}
          />
        )}
        {!locked?.agilidade && (
          <ChipFilter
            label="Agilidade"
            value={keyOf(AGILIDADE, filters.agilidade)}
            options={Object.keys(AGILIDADE)}
            defaultValue={ALL}
            onChange={(v) => apply({ agilidade: AGILIDADE[v] })}
          />
        )}
        <ChipFilter
          label="Tipo de cidade"
          value={keyOf(PERFIS, filters.perfilCidade)}
          options={Object.keys(PERFIS)}
          defaultValue={ALL}
          onChange={(v) => apply({ perfilCidade: PERFIS[v] })}
          align="end"
        />
        {showExperiencia && (
          <ChipFilter
            label="Experiência"
            value={keyOf(EXPERIENCIAS, filters.experiencia)}
            options={Object.keys(EXPERIENCIAS)}
            defaultValue={ALL}
            onChange={(v) => apply({ experiencia: EXPERIENCIAS[v] })}
            align="end"
          />
        )}
        <FilterClearButton
          count={dirtyCount}
          onClear={() => {
            const kept = keepScreenParams(new URLSearchParams(), current).toString();

            startTransition(() => router.push(kept ? `${pathname}?${kept}` : pathname, { scroll: false }));
          }}
        />
      </div>
    </div>
  );
}

/**
 * Click-to-filter context: the chips a user created by clicking a card, a row or
 * a group. Only rendered when at least one is active — the filter bar above
 * already says what the panel itself is filtering.
 */
export function HcActiveContext({
  filters,
  labels,
}: {
  filters: HcFilters;
  /** Friendly text for a cross-filter whose value is an id (e.g. a matrícula). */
  labels?: Partial<Record<keyof HcFilters["cross"], string>>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const current = useSearchParams();
  const chips = (
    [
      ["cf_vendedor", "Vendedor", labels?.vendedor ?? filters.cross.vendedor],
      ["cf_gerencia", "Gerência", filters.cross.gerencia],
      ["cf_coordenacao", "Coordenação", filters.cross.coordenacao],
      ["cf_canal", "Canal", filters.cross.canal],
      ["cf_cidade", "Cidade", filters.cross.cidade],
      ["cf_servico", "Serviço", filters.cross.servico],
    ] as const
  ).filter(([, , value]) => Boolean(value));

  if (chips.length === 0) return null;

  const withoutKey = (keys: string[]) => {
    const q = keepScreenParams(new URLSearchParams(hcFiltersToQuery(filters)), current);

    for (const key of keys) q.delete(key);

    router.push(`${pathname}?${q.toString()}`, { scroll: false });
  };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: ".11em",
          textTransform: "uppercase",
          color: "var(--s-brand)",
        }}
      >
        Contexto ativo
      </span>
      {chips.map(([key, label, value]) => (
        <button
          key={key}
          type="button"
          onClick={() => withoutKey([key])}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: 28,
            padding: "0 10px",
            border: "1px solid var(--s-brand-line)",
            borderRadius: 999,
            background: "var(--s-brand-weak)",
            color: "var(--s-brand)",
            font: "inherit",
            fontSize: 11.5,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {label}: {value}
          <X size={12} />
        </button>
      ))}
      <button
        type="button"
        onClick={() => withoutKey(chips.map(([key]) => key))}
        style={{
          border: 0,
          background: "none",
          color: "var(--s-t3)",
          font: "inherit",
          fontSize: 11.5,
          fontWeight: 700,
          textDecoration: "underline",
          cursor: "pointer",
        }}
      >
        Limpar todos
      </button>
    </div>
  );
}
