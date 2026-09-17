"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Building2, CalendarDays, FileText, RefreshCw, Trash2, UserRound } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { DangerButton, SecondaryButton } from "@/components/admin/primitives";
import { excluirJustificativa } from "@/app/(app)/hc-zerado/justificar/actions";
import { HcActiveContext, HcFilterPanel } from "./HcFilterPanel";
import { MultiChipFilter } from "./MultiChipFilter";
import { Block, SearchInput, STATUS_TONE, card, initials, nf, ptBr } from "./ui";
import { useReportNavPending } from "@/lib/ui/nav-pending";
import { hcFiltersToQuery, keepScreenParams } from "@/lib/data/hc-zerado/filters";
import type {
  AuditoriaRow,
  HcAuditarView,
  HcFilterOptions,
  HcFilters,
  JustificativaStatus,
} from "@/lib/data/hc-zerado/types";

/** The status rail. "Todos" is a view recorte, not a data filter — hence Segmented. */
type StatusTab = JustificativaStatus | "Todos";

const TABS: Array<{ value: StatusTab; label: string }> = [
  { value: "Todos", label: "Todos" },
  { value: "Em Análise", label: "Pendente gestor" },
  { value: "Aprovado", label: "Aprovados" },
  { value: "Rejeitado", label: "Rejeitados" },
];

export function AuditarScreen({
  view,
  filters,
  options,
  status,
  categorias,
}: {
  view: HcAuditarView;
  filters: HcFilters;
  options: HcFilterOptions;
  status: StatusTab;
  categorias: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const current = useSearchParams();
  const [pending, startTransition] = useTransition();
  // Name search stays local: it narrows what is already on screen and re-running
  // the whole aggregation for a keystroke would be absurd.
  const [search, setSearch] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);

  useReportNavPending(pending);

  const push = (q: URLSearchParams) =>
    startTransition(() => router.push(`${pathname}?${q.toString()}`, { scroll: false }));

  const screenQuery = () => keepScreenParams(new URLSearchParams(hcFiltersToQuery(filters)), current);

  const changeStatus = (value: StatusTab) => {
    const q = screenQuery();

    if (value === "Todos") q.delete("st");
    else q.set("st", value);

    push(q);
  };

  const changeCategorias = (values: string[]) => {
    const q = screenQuery();

    if (values.length === 0) q.delete("cat");
    else q.set("cat", values.join(","));

    push(q);
  };

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const byStatus =
      status === "Todos" ? view.rows : view.rows.filter((r) => r.justificativa.status === status);
    const byCategoria = categorias.length
      ? byStatus.filter((r) => categorias.includes(r.justificativa.categoria))
      : byStatus;

    if (!term) return byCategoria;

    return byCategoria.filter(
      (r) =>
        (r.pessoa?.consultor ?? "").toLowerCase().includes(term) || r.justificativa.matricula.includes(term),
    );
  }, [view.rows, status, categorias, search]);

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
            Auditar Justificativas
          </h1>
          <p style={{ fontSize: 13, color: "var(--s-t3)", marginTop: 4 }}>
            Justificativas registradas entre {ptBr(filters.from)} e {ptBr(filters.to)} · leitura apenas, o
            parecer é dado em Justificar HC
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

      <Block
        title="Relatório de Justificativas Recebidas"
        note={
          rows.length === view.rows.length
            ? `${nf.format(view.rows.length)} registro(s) no período`
            : `${nf.format(rows.length)} de ${nf.format(view.rows.length)} registro(s)`
        }
        actions={
          <>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar pessoa ou matrícula..."
              label="Buscar justificativa"
              width={168}
            />
            <MultiChipFilter
              label="Categoria"
              values={categorias}
              options={view.categorias}
              onChange={changeCategorias}
              align="end"
            />
            <Segmented
              options={TABS}
              value={status}
              onChange={changeStatus}
              size="sm"
              ariaLabel="Status da justificativa"
            />
          </>
        }
      >
        {rows.length === 0 ? (
          <Empty hasRows={view.rows.length > 0} />
        ) : (
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            }}
          >
            {rows.map((r) => {
              const id = `${r.justificativa.matricula}|${r.justificativa.dataOcorrencia}`;

              return (
                <JustificativaCard
                  key={id}
                  row={r}
                  busy={removing === id}
                  onDelete={async () => {
                    setRemoving(id);

                    const result = await excluirJustificativa(
                      r.justificativa.matricula,
                      r.justificativa.dataOcorrencia,
                    );

                    setRemoving(null);

                    if (result.ok) startTransition(() => router.refresh());
                    else window.alert(result.error);
                  }}
                />
              );
            })}
          </div>
        )}
      </Block>
    </div>
  );
}

function Empty({ hasRows }: { hasRows: boolean }) {
  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        gap: 8,
        padding: "34px 12px",
        textAlign: "center",
      }}
    >
      <FileText size={20} style={{ color: "var(--s-t3)" }} />
      <strong style={{ fontSize: 13, color: "var(--s-t1)" }}>Nenhum registro encontrado</strong>
      <span style={{ fontSize: 12, color: "var(--s-t3)", maxWidth: 380 }}>
        {hasRows
          ? "Nenhuma justificativa corresponde ao status, à categoria ou à busca."
          : "Ninguém registrou justificativa neste período. Ajuste o período ou os filtros."}
      </span>
    </div>
  );
}

function JustificativaCard({
  row,
  busy,
  onDelete,
}: {
  row: AuditoriaRow;
  busy: boolean;
  onDelete: () => void;
}) {
  const { justificativa: j, pessoa } = row;
  const tone = STATUS_TONE[j.status];
  const nome = pessoa?.consultor || `Matrícula ${j.matricula}`;

  return (
    <article style={{ ...card, display: "flex", flexDirection: "column" }}>
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 10,
          padding: "11px 13px",
          borderBottom: "1px solid var(--s-border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
          <span
            style={{
              flex: "none",
              display: "grid",
              placeItems: "center",
              width: 34,
              height: 34,
              borderRadius: 999,
              background: "var(--s-sunken)",
              border: "1px solid var(--s-border)",
              fontSize: 11.5,
              fontWeight: 800,
              color: "var(--s-t2)",
            }}
          >
            {initials(nome)}
          </span>
          <span style={{ minWidth: 0 }}>
            <span
              className="font-display"
              title={nome}
              style={{
                display: "block",
                fontSize: 12.5,
                fontWeight: 800,
                color: "var(--s-t1)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {nome}
            </span>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 10,
                color: "var(--s-t3)",
                marginTop: 2,
              }}
            >
              <span className="font-mono">{j.matricula}</span>
              {pessoa && (
                <>
                  <span>·</span>
                  <span
                    title={`${pessoa.cidade} / ${pessoa.coordenacao}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 3,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <Building2 size={10} />
                    {pessoa.cidade}
                  </span>
                </>
              )}
            </span>
          </span>
        </div>

        <div
          style={{ flex: "none", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}
        >
          <span
            style={{
              padding: "2px 8px",
              borderRadius: 999,
              background: tone.bg,
              color: tone.fg,
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: ".06em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}
          >
            {tone.label}
          </span>
          <span
            className="font-mono"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 10,
              color: "var(--s-t3)",
            }}
          >
            <CalendarDays size={10} />
            {ptBr(j.dataOcorrencia)}
          </span>
        </div>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: 9, padding: 13, flex: 1 }}>
        <span
          style={{
            alignSelf: "flex-start",
            padding: "3px 9px",
            borderRadius: 8,
            border: "1px solid var(--s-border)",
            background: "var(--s-sunken)",
            color: "var(--s-t2)",
            fontSize: 9.5,
            fontWeight: 800,
            letterSpacing: ".05em",
            textTransform: "uppercase",
          }}
        >
          {j.categoria}
        </span>
        <p
          style={{
            margin: 0,
            padding: 10,
            borderRadius: 10,
            border: "1px solid var(--s-border)",
            background: "var(--s-sunken)",
            fontSize: 12,
            lineHeight: 1.5,
            color: "var(--s-t2)",
          }}
        >
          {j.motivo}
        </p>

        {j.observacaoLider.trim() && (
          <div
            style={{
              padding: 10,
              borderRadius: 10,
              border: "1px solid var(--s-brand-line)",
              background: "var(--s-brand-weak)",
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: ".08em",
                textTransform: "uppercase",
                color: "var(--s-brand)",
              }}
            >
              <UserRound size={10} />
              Parecer do gestor
            </span>
            <p style={{ margin: "5px 0 0", fontSize: 12, lineHeight: 1.5, color: "var(--s-t2)" }}>
              {j.observacaoLider}
            </p>
          </div>
        )}
      </div>

      <Trilha row={row} busy={busy} onDelete={onDelete} />
    </article>
  );
}

/**
 * The audit trail. It is the reason this screen exists, so it is rendered even
 * when empty: the rows written before the app started filling `autor_id` /
 * `avaliador_id` say so out loud instead of looking like nobody touched them.
 */
function Trilha({ row, busy, onDelete }: { row: AuditoriaRow; busy: boolean; onDelete: () => void }) {
  const { justificativa: j } = row;
  // Deleting is not undoable, so the control asks once before it does anything.
  const [confirming, setConfirming] = useState(false);

  return (
    <footer
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "3px 12px",
        padding: "8px 13px",
        borderTop: "1px solid var(--s-border)",
        fontSize: 10,
        color: "var(--s-t3)",
      }}
    >
      {confirming ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
          Excluir sem volta?
          <DangerButton onClick={onDelete} disabled={busy} style={{ height: 26, fontSize: 11 }}>
            {busy ? "Excluindo…" : "Sim"}
          </DangerButton>
          <SecondaryButton
            onClick={() => setConfirming(false)}
            disabled={busy}
            style={{ height: 26, fontSize: 11 }}
          >
            Não
          </SecondaryButton>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="bd-ghost"
          title="Excluir justificativa"
          style={{
            order: 9,
            marginLeft: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            border: 0,
            background: "none",
            color: "var(--s-bad)",
            font: "inherit",
            fontSize: 10,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <Trash2 size={11} />
          Excluir
        </button>
      )}
      <span>
        {j.autor ? (
          <>
            Registrado por <strong style={{ color: "var(--s-t2)" }}>{j.autor}</strong>
          </>
        ) : (
          "Autoria não registrada"
        )}
      </span>
      {j.status !== "Em Análise" && (
        <span>
          {j.avaliador ? (
            <>
              Avaliado por <strong style={{ color: "var(--s-t2)" }}>{j.avaliador}</strong>
              {j.avaliadoEm && ` em ${ptBr(j.avaliadoEm.slice(0, 10))}`}
            </>
          ) : (
            "Avaliador não registrado"
          )}
        </span>
      )}
    </footer>
  );
}
