"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  PartyPopper,
  Pencil,
  RefreshCw,
  Settings2,
  Users,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { HcActiveContext, HcFilterPanel } from "./HcFilterPanel";
import { JustificativaModal, type JustificativaDraft } from "./JustificativaModal";
import { RegrasModal, type RegrasDraft } from "./RegrasModal";
import {
  SEM_JUSTIFICATIVA,
  SERVICO_LABEL,
  SearchInput,
  STATUS_TONE,
  blockTitle,
  card,
  diaLabel,
  initials,
  nf,
  ptBr,
  servicoTone,
} from "./ui";
import { useReportNavPending } from "@/lib/ui/nav-pending";
import { hcFiltersToQuery, keepScreenParams } from "@/lib/data/hc-zerado/filters";
import {
  excluirJustificativa,
  salvarJustificativa,
  salvarRegras,
} from "@/app/(app)/hc-zerado/justificar/actions";
import type {
  DiaZerado,
  HcFilterOptions,
  HcFilters,
  HcJustificarView,
  HcRegras,
  PessoaZerada,
} from "@/lib/data/hc-zerado/types";

/** How the list is cut. A view recorte over data already on screen, so no round-trip. */
export type JustificarTab = "Todos" | "Pendente" | "Em Análise" | "Aprovado" | "Rejeitado";

const TABS: Array<{ value: JustificarTab; label: string }> = [
  { value: "Todos", label: "Todos" },
  { value: "Pendente", label: "Pendente colab." },
  { value: "Em Análise", label: "Pendente gestor" },
  { value: "Aprovado", label: "Aprovados" },
  { value: "Rejeitado", label: "Rejeitados" },
];

/**
 * The list is long — a full month runs to hundreds of people, each with a row of
 * day cards — so it is revealed in pages instead of mounting thousands of cards
 * at once. The origin rendered every one and crawled.
 */
const PAGE = 40;

export function JustificarScreen({
  view,
  filters,
  options,
  tab,
}: {
  view: HcJustificarView;
  filters: HcFilters;
  options: HcFilterOptions;
  tab: JustificarTab;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const current = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(PAGE);
  const [target, setTarget] = useState<{ pessoa: PessoaZerada; dia: DiaZerado } | null>(null);
  const [showRegras, setShowRegras] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useReportNavPending(pending);

  const changeTab = (value: JustificarTab) => {
    const q = keepScreenParams(new URLSearchParams(hcFiltersToQuery(filters)), current);

    if (value === "Todos") q.delete("jf");
    else q.set("jf", value);

    startTransition(() => router.push(`${pathname}?${q.toString()}`, { scroll: false }));
  };

  /** Keep the person, drop the days the tab does not ask for — the origin's cut. */
  const pessoas = useMemo(() => {
    const term = search.trim().toLowerCase();

    const keep = (d: DiaZerado) => {
      if (tab === "Todos") return true;

      if (tab === "Pendente") return !d.justificativa;

      return d.justificativa?.status === tab;
    };

    return view.pessoas
      .filter((p) => !term || p.consultor.toLowerCase().includes(term) || p.matricula.includes(term))
      .map((p) => ({ ...p, dias: p.dias.filter(keep) }))
      .filter((p) => p.dias.length > 0);
  }, [view.pessoas, tab, search]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3500);
  };

  const onSaveJustificativa = async (draft: JustificativaDraft) => {
    if (!target) return;

    setSaving(true);
    setError(null);

    const result = await salvarJustificativa({
      matricula: target.pessoa.matricula,
      dataOcorrencia: target.dia.data,
      ...draft,
    });

    setSaving(false);

    if (!result.ok) {
      setError(result.error);

      return;
    }

    setTarget(null);
    showToast(`Justificativa salva para ${target.pessoa.consultor}.`);
    startTransition(() => router.refresh());
  };

  const onDeleteJustificativa = async () => {
    if (!target) return;

    setSaving(true);
    setError(null);

    const result = await excluirJustificativa(target.pessoa.matricula, target.dia.data);

    setSaving(false);

    if (!result.ok) {
      setError(result.error);

      return;
    }

    const nome = target.pessoa.consultor;

    setTarget(null);
    showToast(`Justificativa de ${nome} excluída.`);
    startTransition(() => router.refresh());
  };

  const onSaveRegras = async (draft: RegrasDraft) => {
    setSaving(true);
    setError(null);

    const result = await salvarRegras(draft);

    setSaving(false);

    if (!result.ok) {
      setError(result.error);

      return;
    }

    setShowRegras(false);
    showToast("Regra global atualizada — a lista foi recalculada.");
    startTransition(() => router.refresh());
  };

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
            Justificar HC
          </h1>
          <p style={{ fontSize: 13, color: "var(--s-t3)", marginTop: 4 }}>
            Dias de semana (seg–sex, feriado incluído) entre {ptBr(filters.from)} e {ptBr(filters.to)} em que
            a pessoa estava ativa e não registrou venda
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

      {/* The sale-side chips are hidden: this screen answers to the global rules,
          not to them, so offering them would be offering a filter that does nothing. */}
      <HcFilterPanel
        filters={filters}
        options={options}
        locked={{ servico: true, status: true, agilidade: true, indicador: true }}
      />
      <HcActiveContext filters={filters} />

      <RegrasBar regras={view.regras} onEdit={() => setShowRegras(true)} />

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <Stat label="HCs com ocorrência" value={view.stats.pessoas} icon={Users} />
        <Stat label="Dias zerados" value={view.stats.diasZerados} icon={CalendarDays} />
        <Stat
          label="Pendente colab."
          value={view.stats.pendentes}
          icon={AlertCircle}
          tone="var(--s-bad)"
          tint="var(--s-bad-bg)"
        />
        <Stat
          label="Pendente gestor"
          value={view.stats.emAnalise}
          icon={Clock}
          tone="var(--s-warn)"
          tint="var(--s-warn-bg)"
        />
        <Stat
          label="Aprovados"
          value={view.stats.aprovados}
          icon={CheckCircle2}
          tone="var(--s-ok)"
          tint="var(--s-ok-bg)"
        />
        <Stat
          label="Rejeitados"
          value={view.stats.rejeitados}
          icon={XCircle}
          tone="var(--s-bad)"
          tint="var(--s-bad-bg)"
        />
        <Stat
          label="Justificados"
          value={view.stats.conclusao}
          suffix="%"
          icon={ClipboardCheck}
          tone="var(--s-brand)"
          tint="var(--s-brand-weak)"
        />
      </div>

      <div
        style={{
          ...card,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 10,
          padding: "9px 13px",
        }}
      >
        <span
          style={{ flex: "none", width: 7, height: 7, borderRadius: 999, background: "var(--s-brand)" }}
        />
        <h2 className="font-display" style={blockTitle}>
          Ocorrências por colaborador
        </h2>
        <span style={{ fontSize: 11, color: "var(--s-t3)" }}>
          {pessoas.length === view.pessoas.length
            ? `${nf.format(view.pessoas.length)} pessoa(s) · ordem alfabética`
            : `${nf.format(pessoas.length)} de ${nf.format(view.pessoas.length)} pessoa(s)`}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setVisible(PAGE);
            }}
            placeholder="Buscar pessoa ou matrícula..."
            label="Buscar colaborador"
            width={168}
          />
          <Segmented
            options={TABS}
            value={tab}
            onChange={changeTab}
            size="sm"
            ariaLabel="Situação da justificativa"
          />
        </div>
      </div>

      {pessoas.length === 0 ? (
        <div style={card}>
          <Empty hasRows={view.pessoas.length > 0} />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {pessoas.slice(0, visible).map((p) => (
            <PessoaRow
              key={p.matricula}
              pessoa={p}
              onPick={(dia) => {
                setError(null);
                setTarget({ pessoa: p, dia });
              }}
            />
          ))}
          {pessoas.length > visible && (
            <button
              type="button"
              onClick={() => setVisible((v) => v + PAGE)}
              className="bd-ghost"
              style={{
                height: 38,
                border: "1px dashed var(--s-border-2)",
                borderRadius: 12,
                background: "var(--s-card)",
                color: "var(--s-t2)",
                font: "inherit",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Mostrar mais {nf.format(Math.min(PAGE, pessoas.length - visible))} de{" "}
              {nf.format(pessoas.length - visible)} restantes
            </button>
          )}
        </div>
      )}

      {target && (
        <JustificativaModal
          pessoa={target.pessoa}
          dia={target.dia}
          saving={saving}
          error={error}
          onClose={() => setTarget(null)}
          onSave={onSaveJustificativa}
          onDelete={onDeleteJustificativa}
        />
      )}

      {showRegras && (
        <RegrasModal
          regras={view.regras}
          saving={saving}
          error={error}
          onClose={() => setShowRegras(false)}
          onSave={onSaveRegras}
        />
      )}

      {toast && (
        <div
          role="status"
          style={{
            position: "fixed",
            right: 18,
            bottom: 18,
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            gap: 8,
            maxWidth: 360,
            padding: "10px 14px",
            border: "1px solid var(--s-border)",
            borderRadius: 12,
            background: "var(--s-card)",
            boxShadow: "var(--s-sh-2)",
            fontSize: 12.5,
            fontWeight: 700,
            color: "var(--s-t1)",
            animation: "bdIn .2s ease both",
          }}
        >
          <Check size={14} style={{ color: "var(--s-ok)", flex: "none" }} />
          {toast}
        </div>
      )}
    </div>
  );
}

/** The global lock, always on screen: the numbers below are meaningless without it. */
function RegrasBar({ regras, onEdit }: { regras: HcRegras; onEdit: () => void }) {
  const servicos = regras.servicos.map((s) => SERVICO_LABEL[s] ?? s).join(", ");

  return (
    <div
      style={{
        ...card,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 10,
        padding: "9px 13px",
      }}
    >
      <span
        style={{
          flex: "none",
          display: "grid",
          placeItems: "center",
          width: 32,
          height: 32,
          borderRadius: 10,
          background: "var(--s-brand-weak)",
          color: "var(--s-brand)",
        }}
      >
        <Settings2 size={16} strokeWidth={2.2} />
      </span>
      <span
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: ".09em",
          textTransform: "uppercase",
          color: "var(--s-brand)",
        }}
      >
        Regra global
      </span>
      <span style={{ fontSize: 12, color: "var(--s-t2)" }}>
        Conta como venda: <strong style={{ color: "var(--s-t1)" }}>{servicos}</strong> · status{" "}
        <strong style={{ color: "var(--s-t1)" }}>{regras.statusVenda}</strong> (só FTTH e FWA) · agilidade{" "}
        <strong style={{ color: "var(--s-t1)" }}>{regras.agilidade}</strong>
      </span>
      <button
        type="button"
        onClick={onEdit}
        className="bd-ghost"
        style={{
          marginLeft: "auto",
          display: "flex",
          alignItems: "center",
          gap: 6,
          height: 30,
          padding: "0 12px",
          border: "1px solid var(--s-border)",
          borderRadius: 999,
          background: "var(--s-sunken)",
          color: "var(--s-t2)",
          font: "inherit",
          fontSize: 11.5,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        <Pencil size={12} />
        Editar
      </button>
    </div>
  );
}

/** Icon tile + label + number, as in the origin — the tile is what makes the row scannable. */
function Stat({
  label,
  value,
  suffix,
  icon: Icon,
  tone,
  tint,
}: {
  label: string;
  value: number;
  suffix?: string;
  icon: LucideIcon;
  tone?: string;
  tint?: string;
}) {
  return (
    <div style={{ ...card, display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
      <span
        style={{
          flex: "none",
          display: "grid",
          placeItems: "center",
          width: 32,
          height: 32,
          borderRadius: 10,
          background: tint ?? "var(--s-sunken)",
          color: tone ?? "var(--s-t2)",
        }}
      >
        <Icon size={16} strokeWidth={2.2} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div
          title={label}
          style={{
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: ".07em",
            textTransform: "uppercase",
            color: "var(--s-t3)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>
        <div
          className="font-mono"
          style={{
            fontSize: 21,
            fontWeight: 800,
            lineHeight: 1.1,
            marginTop: 2,
            color: tone ?? "var(--s-t1)",
          }}
        >
          {nf.format(value)}
          {suffix}
        </div>
      </div>
    </div>
  );
}

function Empty({ hasRows }: { hasRows: boolean }) {
  return (
    <div style={{ display: "grid", placeItems: "center", gap: 8, padding: "34px 12px", textAlign: "center" }}>
      {hasRows ? (
        <FileText size={20} style={{ color: "var(--s-t3)" }} />
      ) : (
        <Check size={20} style={{ color: "var(--s-ok)" }} />
      )}
      <strong style={{ fontSize: 13, color: "var(--s-t1)" }}>
        {hasRows ? "Nada neste recorte" : "Nenhuma pendência no período"}
      </strong>
      <span style={{ fontSize: 12, color: "var(--s-t3)", maxWidth: 400 }}>
        {hasRows
          ? "Nenhuma ocorrência corresponde à aba ou à busca."
          : "Ninguém ativo ficou sem venda em um dia de semana, pela regra global vigente."}
      </span>
    </div>
  );
}

function PessoaRow({ pessoa, onPick }: { pessoa: PessoaZerada; onPick: (dia: DiaZerado) => void }) {
  return (
    <article
      style={{
        ...card,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 12,
        padding: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: 274,
          minWidth: 230,
          flex: "1 1 230px",
        }}
      >
        <span
          style={{
            flex: "none",
            display: "grid",
            placeItems: "center",
            width: 38,
            height: 38,
            borderRadius: 999,
            background: "var(--s-sunken)",
            border: "1px solid var(--s-border)",
            fontSize: 12,
            fontWeight: 800,
            color: "var(--s-t2)",
          }}
        >
          {initials(pessoa.consultor)}
        </span>
        <div style={{ minWidth: 0 }}>
          <div
            className="font-display"
            title={pessoa.consultor}
            style={{
              fontSize: 12.5,
              fontWeight: 800,
              color: "var(--s-t1)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {pessoa.consultor}
          </div>
          {/* Each attribute on its own labelled line: "32169 · PROMOTOR DE VENDAS"
              ran together and the cargo was the half that got truncated away. */}
          <Meta label="Matrícula" value={pessoa.matricula} mono />
          <Meta label="Cargo" value={pessoa.cargo} />
          <div
            title={`${pessoa.cidade} / ${pessoa.coordenacao}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 10,
              color: "var(--s-t3)",
              marginTop: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            <Building2 size={10} style={{ flex: "none" }} />
            {pessoa.cidade} / {pessoa.coordenacao}
          </div>
        </div>
      </div>

      <div style={{ flex: "999 1 320px", minWidth: 0, overflowX: "auto", paddingBottom: 2 }}>
        <div style={{ display: "flex", gap: 8, minWidth: "min-content" }}>
          {pessoa.dias.map((dia) => (
            <DiaCard key={dia.data} dia={dia} onPick={() => onPick(dia)} />
          ))}
        </div>
      </div>
    </article>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div
      title={value}
      style={{
        fontSize: 10,
        color: "var(--s-t3)",
        marginTop: 1,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {label}:{" "}
      <strong className={mono ? "font-mono" : undefined} style={{ color: "var(--s-t2)", fontWeight: 700 }}>
        {value}
      </strong>
    </div>
  );
}

function DiaCard({ dia, onPick }: { dia: DiaZerado; onPick: () => void }) {
  const tone = dia.justificativa ? STATUS_TONE[dia.justificativa.status] : SEM_JUSTIFICATIVA;

  return (
    <button
      type="button"
      onClick={onPick}
      className="bd-ghost"
      title={dia.justificativa?.motivo}
      style={{
        flex: "none",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: 6,
        width: 208,
        padding: 10,
        // Tinted by verdict, so a row of days reads at a glance instead of one
        // badge at a time. An unjudged day keeps the plain border — the heavier
        // `--s-border-2` made the grey read almost as loud as the tinted ones.
        border: `1px solid ${dia.justificativa ? tone.fg : "var(--s-border)"}`,
        borderRadius: 12,
        background: dia.justificativa ? tone.bg : "var(--s-sunken)",
        font: "inherit",
        textAlign: "left",
        cursor: "pointer",
        transition: ".16s",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: "var(--s-t1)", letterSpacing: ".02em" }}>
            {diaLabel(dia.data)}
          </span>
          {dia.feriado && (
            <PartyPopper
              size={11}
              strokeWidth={2.2}
              style={{ color: "var(--s-warn)", flex: "none" }}
              aria-label="Feriado"
            />
          )}
        </span>
        <span
          style={{
            padding: "1px 7px",
            borderRadius: 999,
            background: "var(--s-card)",
            color: tone.fg,
            fontSize: 8.5,
            fontWeight: 800,
            letterSpacing: ".05em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          {tone.short}
        </span>
      </span>

      <span style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {dia.servicos.map((s) => {
          const st = servicoTone(s);

          return (
            <span
              key={s}
              style={{
                padding: "1px 6px",
                borderRadius: 6,
                background: st.bg,
                color: st.fg,
                fontSize: 8.5,
                fontWeight: 800,
                letterSpacing: ".04em",
                textTransform: "uppercase",
              }}
            >
              {SERVICO_LABEL[s] ?? s}
            </span>
          );
        })}
      </span>

      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
          paddingTop: 6,
          borderTop: "1px solid var(--s-border)",
        }}
      >
        <span
          style={{
            minWidth: 0,
            fontSize: 10.5,
            color: dia.justificativa ? "var(--s-t2)" : "var(--s-t3)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {dia.justificativa?.categoria ?? "Sem justificativa"}
        </span>
        {/* A filled pill to act, an outlined one to revisit — the difference says
            which days still need someone. "Editar" borrows the card's verdict
            colour so the action never fights the state it sits on. */}
        <span
          style={{
            flex: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            height: 21,
            padding: "0 9px",
            borderRadius: 999,
            border: `1px solid ${dia.justificativa ? tone.fg : "var(--s-brand)"}`,
            background: dia.justificativa ? "var(--s-card)" : "var(--s-brand)",
            color: dia.justificativa ? tone.fg : "#fff",
            fontSize: 10,
            fontWeight: 800,
          }}
        >
          <Pencil size={10} />
          {dia.justificativa ? "Editar" : "Justificar"}
        </span>
      </span>
    </button>
  );
}
