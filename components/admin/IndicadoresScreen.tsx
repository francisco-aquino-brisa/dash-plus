"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronDown, Circle, CircleDashed, Eye } from "lucide-react";
import { AdminScreen } from "./AdminScreen";
import { Chip, Panel } from "./primitives";
import { textMatches } from "./filter";
import { DataTable, type Column } from "@/components/ui/data-table";
import { statusChipTone } from "@/lib/data/admin/derive";
import { CATEGORY_META, categoryTone, servicoTone } from "@/lib/data/indicators/ui";
import type { IndicadorGeral } from "@/lib/data/indicators/types";

function isAtivo(status: string | null): boolean {
  return (status ?? "").trim().toLowerCase() === "ativo";
}

export function IndicadoresScreen({ indicadores }: { indicadores: IndicadorGeral[] }) {
  const [query, setQuery] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);

      if (next.has(key)) next.delete(key);
      else next.add(key);

      return next;
    });

  const groups = useMemo(() => {
    const filtered = indicadores.filter((ind) => {
      if (
        !textMatches(
          query,
          ind.id,
          ind.nome,
          ind.categoria,
          ...ind.servicos.flatMap((s) => [s.servico, s.indicadorServico]),
        )
      ) {
        return false;
      }

      if (onlyMissing) {
        const total = ind.servicos.length;
        const done = ind.servicos.filter((s) => !!s.especificacaoCalculo?.trim()).length;

        if (!(total > 0 && done < total)) return false;
      }

      return true;
    });

    const map = new Map<string, IndicadorGeral[]>();

    for (const ind of filtered) {
      const list = map.get(ind.categoria);

      if (list) list.push(ind);
      else map.set(ind.categoria, [ind]);
    }

    const known = CATEGORY_META.filter((c) => map.has(c.key));
    const extra = [...map.keys()]
      .filter((k) => !CATEGORY_META.some((c) => c.key === k))
      .map((k) => ({ key: k, label: k, tone: categoryTone(k) }));

    return [...known, ...extra].map((c) => ({ ...c, items: map.get(c.key) ?? [] }));
  }, [indicadores, query, onlyMissing]);

  const columns: Column<IndicadorGeral>[] = [
    {
      key: "id",
      header: "Código",
      render: (i) => (
        <span style={{ fontFamily: "var(--font-mono, ui-monospace, monospace)", fontWeight: 700 }}>
          {i.id}
        </span>
      ),
    },
    {
      key: "nome",
      header: "Indicador",
      render: (i) => <span style={{ fontWeight: 700, color: "var(--s-t1)" }}>{i.nome}</span>,
    },
    {
      key: "servicos",
      header: "Serviços",
      render: (i) =>
        i.servicos.length === 0 ? (
          <span style={{ color: "var(--s-t3)" }}>—</span>
        ) : (
          <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 4 }}>
            {i.servicos.map((s) => (
              <Chip key={s.id} tone={servicoTone(s.servico)}>
                {s.servico}
              </Chip>
            ))}
          </span>
        ),
    },
    {
      key: "calculo",
      header: "Cálculo",
      render: (i) => {
        const total = i.servicos.length;
        const done = i.servicos.filter((s) => !!s.especificacaoCalculo?.trim()).length;

        if (total === 0) return <span style={{ color: "var(--s-t3)" }}>—</span>;

        const { Icon, color } =
          done === total
            ? { Icon: CheckCircle2, color: "var(--s-ok)" }
            : done === 0
              ? { Icon: Circle, color: "var(--s-t3)" }
              : { Icon: CircleDashed, color: "var(--s-warn)" };

        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color,
              fontWeight: 700,
              fontSize: 12.5,
            }}
            title={`${done} de ${total} serviço(s) com cálculo definido`}
          >
            <Icon size={15} />
            {done}/{total}
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (i) => <Chip tone={statusChipTone(isAtivo(i.status))}>{i.status || "—"}</Chip>,
    },
    {
      key: "acoes",
      header: "",
      align: "right",
      render: (i) => (
        <Link
          href={`/admin/indicadores/${encodeURIComponent(i.id)}`}
          className="bd-ghost"
          aria-label={`Ver ${i.id}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: 32,
            padding: "0 12px",
            borderRadius: 9,
            border: "1px solid var(--s-border)",
            background: "var(--s-card)",
            color: "var(--s-t2)",
            font: "inherit",
            fontSize: 12,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          <Eye size={14} />
          Ver
        </Link>
      ),
    },
  ];

  return (
    <AdminScreen
      title="Indicadores"
      subtitle="Catálogo de indicadores e suas fórmulas, por categoria"
      search={{ value: query, onChange: setQuery, placeholder: "Buscar por código, nome ou serviço…" }}
      extra={
        <button
          type="button"
          onClick={() => setOnlyMissing((v) => !v)}
          aria-pressed={onlyMissing}
          className="bd-ghost"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            height: 44,
            padding: "0 14px",
            borderRadius: 12,
            border: `1px solid ${onlyMissing ? "var(--s-brand)" : "var(--s-border)"}`,
            background: onlyMissing ? "var(--s-brand-weak)" : "var(--s-card)",
            color: onlyMissing ? "var(--s-brand)" : "var(--s-t2)",
            font: "inherit",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          <CircleDashed size={15} />
          Somente sem cálculo
        </button>
      }
    >
      {groups.length === 0 && (
        <Panel style={{ padding: 24 }}>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--s-t3)" }}>Nenhum indicador encontrado.</p>
        </Panel>
      )}

      {groups.map((g) => {
        const isCollapsed = collapsed.has(g.key);

        return (
          <section key={g.key} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              type="button"
              onClick={() => toggle(g.key)}
              className="bd-ghost"
              aria-expanded={!isCollapsed}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                alignSelf: "flex-start",
                padding: "4px 6px 4px 0",
                border: 0,
                background: "transparent",
                color: "var(--s-t1)",
                font: "inherit",
                cursor: "pointer",
              }}
            >
              <ChevronDown
                size={18}
                style={{
                  color: g.tone.fg,
                  transition: "transform .15s ease",
                  transform: isCollapsed ? "rotate(-90deg)" : "none",
                }}
              />
              <span
                aria-hidden
                style={{ width: 9, height: 9, borderRadius: 999, background: g.tone.fg, flex: "none" }}
              />
              <span className="font-display" style={{ fontSize: 16, fontWeight: 800 }}>
                {g.label}
              </span>
              <span
                style={{
                  padding: "2px 9px",
                  borderRadius: "var(--r-pill)",
                  background: g.tone.bg,
                  color: g.tone.fg,
                  fontSize: 11.5,
                  fontWeight: 800,
                }}
              >
                {g.items.length}
              </span>
            </button>

            {!isCollapsed && (
              <Panel style={{ borderLeft: `3px solid ${g.tone.fg}` }}>
                <DataTable
                  columns={columns}
                  rows={g.items}
                  rowKey={(i) => i.id}
                  minWidth={700}
                  empty={{ title: "Nenhum indicador", hint: "Sem itens nesta categoria." }}
                />
              </Panel>
            )}
          </section>
        );
      })}
    </AdminScreen>
  );
}
