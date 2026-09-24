"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, MapPin, Users, UserRound } from "lucide-react";
import { AdminModal, ModalHeader, ModalShell } from "./AdminModal";
import { AdminScreen } from "./AdminScreen";
import { Panel, PrimaryButton, SearchInput, SecondaryButton } from "./primitives";
import { textMatches } from "./filter";
import { useAdminAction } from "./useAdminAction";
import { Segmented } from "@/components/ui/segmented";
import { limparVinculoOrfao, salvarVinculos } from "@/app/(app)/admin/actions";
import type { CidadeOpcao, EstruturaNo, SupervisaoNo, VinculoOrfao } from "@/lib/data/admin/types";

type Tab = "coordenacao" | "supervisao";
type Mode = "responsavel" | "cidade";

const TABS = [
  { value: "coordenacao" as const, label: "Coordenação" },
  { value: "supervisao" as const, label: "Supervisão" },
];

const MODES = [
  { value: "responsavel" as const, label: "Por responsável" },
  { value: "cidade" as const, label: "Por cidade" },
];

const pairKey = (codigoLocal: string, cidadeId: number | string) => `${codigoLocal}|${cidadeId}`;

/** The city whose supervisões are being picked, from inside a coordenação. */
interface Distribuicao {
  cidadeId: number;
  cidade: string;
  coordenacao: EstruturaNo;
}

interface Cascade {
  codigoLocal: string;
  cidadeId: number;
  cidade: string;
  coordenacao: string;
  supervisoes: SupervisaoNo[];
}

export function EstruturaCidadesScreen({
  coordenacoes,
  supervisoes,
  cidades,
  orfaos,
}: {
  coordenacoes: EstruturaNo[];
  supervisoes: SupervisaoNo[];
  cidades: CidadeOpcao[];
  orfaos: VinculoOrfao[];
}) {
  const [tab, setTab] = useState<Tab>("coordenacao");
  const [mode, setMode] = useState<Mode>("responsavel");
  const [focused, setFocused] = useState<string | null>(null);
  const [onlyUnbound, setOnlyUnbound] = useState(false);
  const [cascade, setCascade] = useState<Cascade | null>(null);
  const [distribuicao, setDistribuicao] = useState<Distribuicao | null>(null);
  const { busy, error, setError, run } = useAdminAction();

  /**
   * Edits live as a delta over the server's state instead of replacing it: a
   * save that lands (and re-renders with new props) makes the matching deltas
   * no-ops, and a move back to where it started stops counting as pending.
   */
  const base = useMemo(
    () =>
      new Set(
        [...coordenacoes, ...supervisoes].flatMap((n) => n.cidadeIds.map((id) => pairKey(n.codigoLocal, id))),
      ),
    [coordenacoes, supervisoes],
  );
  const [deltas, setDeltas] = useState<Map<string, boolean>>(new Map());

  const pending = useMemo(() => [...deltas].filter(([k, bind]) => base.has(k) !== bind), [deltas, base]);

  const pairs = useMemo(() => {
    const set = new Set(base);

    for (const [key, bind] of deltas) {
      if (bind) set.add(key);
      else set.delete(key);
    }

    return set;
  }, [base, deltas]);

  const citiesByNode = useMemo(() => groupBy(pairs, "node"), [pairs]);
  const nodesByCity = useMemo(() => groupBy(pairs, "city"), [pairs]);

  // The "only unbound" filter reads the SAVED state on purpose: filtering the
  // live one would make a row vanish from under the cursor the moment its first
  // city is moved, before anything is saved.
  const savedByNode = useMemo(() => groupBy(base, "node"), [base]);
  const savedByCity = useMemo(() => groupBy(base, "city"), [base]);

  const cityById = useMemo(() => new Map(cidades.map((c) => [String(c.id), c])), [cidades]);
  const nodeByCodigo = useMemo(
    () => new Map([...coordenacoes, ...supervisoes].map((n) => [n.codigoLocal, n])),
    [coordenacoes, supervisoes],
  );

  const poolOf = (coordenacaoCodigo: string) => citiesByNode.get(coordenacaoCodigo) ?? new Set<string>();

  function setDelta(codigoLocal: string, cidadeId: number | string, bind: boolean) {
    setError(null);
    setDeltas((prev) => new Map(prev).set(pairKey(codigoLocal, cidadeId), bind));
  }

  function moveSupervisao(codigoLocal: string, cidadeId: number, bind: boolean) {
    setDelta(codigoLocal, cidadeId, bind);
  }

  /**
   * Dropping a city from a coordenação drops it from the supervisões below, so
   * it asks first and then stages every removal — the server recomputes the same
   * cascade on save, this is what makes it visible before it happens.
   */
  function moveCoordenacao(codigoLocal: string, cidadeId: number, bind: boolean) {
    if (bind) return setDelta(codigoLocal, cidadeId, true);

    const afetadas = supervisoes.filter(
      (s) =>
        s.coordenacaoCodigoLocal === codigoLocal &&
        (citiesByNode.get(s.codigoLocal)?.has(String(cidadeId)) ?? false),
    );

    if (afetadas.length === 0) return setDelta(codigoLocal, cidadeId, false);

    setCascade({
      codigoLocal,
      cidadeId,
      cidade: cityById.get(String(cidadeId))?.nome ?? `#${cidadeId}`,
      coordenacao: nodeByCodigo.get(codigoLocal)?.nome ?? codigoLocal,
      supervisoes: afetadas,
    });
  }

  function abrirDistribuicao(coordenacaoCodigo: string, cidadeId: number) {
    const coordenacao = coordenacoes.find((c) => c.codigoLocal === coordenacaoCodigo);

    if (!coordenacao) return;

    setDistribuicao({
      cidadeId,
      cidade: cityById.get(String(cidadeId))?.nome ?? `#${cidadeId}`,
      coordenacao,
    });
  }

  function confirmCascade() {
    if (!cascade) return;

    setError(null);
    setDeltas((prev) => {
      const next = new Map(prev);

      next.set(pairKey(cascade.codigoLocal, cascade.cidadeId), false);
      for (const s of cascade.supervisoes) next.set(pairKey(s.codigoLocal, cascade.cidadeId), false);

      return next;
    });
    setCascade(null);
  }

  function save() {
    run(
      () =>
        salvarVinculos(
          pending.map(([key, bind]) => {
            const [codigoLocal, cidadeId] = key.split("|");

            return { codigoLocal, cidadeId: Number(cidadeId), vincular: bind };
          }),
        ),
      () => setDeltas(new Map()),
    );
  }

  // The focused row belongs to whichever list the tab/mode puts first, so it
  // cannot survive either switch.
  function switchTab(next: Tab) {
    setTab(next);
    setFocused(null);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setFocused(null);
  }

  const byCoordenacao = tab === "coordenacao";
  const byResponsavel = mode === "responsavel";
  const alert = buildAlert({
    byCoordenacao,
    byResponsavel,
    coordenacoes,
    supervisoes,
    cidades,
    citiesByNode,
    nodesByCity,
  });
  const filter = {
    label: byResponsavel ? "Só sem cidade" : byCoordenacao ? "Só sem coordenação" : "Só sem supervisão",
    on: onlyUnbound,
    onToggle: () => setOnlyUnbound((v) => !v),
  };

  return (
    <AdminScreen
      title="Cidades por estrutura"
      subtitle="A coordenação recebe as cidades; as supervisões abaixo dela dividem esse conjunto."
      extra={
        <>
          <Segmented options={TABS} value={tab} onChange={switchTab} ariaLabel="Nível" />
          <Segmented options={MODES} value={mode} onChange={switchMode} ariaLabel="Modo de vínculo" />
          <FilterChip filter={filter} />
        </>
      }
    >
      {alert.n > 0 && (
        <Panel style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <MapPin size={16} style={{ color: "var(--s-warn)", flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "var(--s-t2)" }}>
            <strong>{alert.n}</strong> de {alert.total} {alert.texto}
          </span>
        </Panel>
      )}

      {byCoordenacao ? (
        <CoordenacaoTab
          coordenacoes={coordenacoes}
          supervisoes={supervisoes}
          cidades={cidades}
          citiesByNode={citiesByNode}
          nodesByCity={nodesByCity}
          savedByNode={savedByNode}
          savedByCity={savedByCity}
          mode={mode}
          onlyUnbound={onlyUnbound}
          focused={focused}
          onFocus={setFocused}
          onMove={moveCoordenacao}
          onDistribuir={abrirDistribuicao}
        />
      ) : (
        <SupervisaoTab
          supervisoes={supervisoes}
          cidades={cidades}
          citiesByNode={citiesByNode}
          nodesByCity={nodesByCity}
          savedByNode={savedByNode}
          savedByCity={savedByCity}
          poolOf={poolOf}
          mode={mode}
          onlyUnbound={onlyUnbound}
          focused={focused}
          onFocus={setFocused}
          onMove={moveSupervisao}
        />
      )}

      {pending.length > 0 && (
        <div style={{ position: "sticky", bottom: 12, zIndex: 3 }}>
          <Panel
            style={{
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              boxShadow: "var(--s-sh-2)",
            }}
          >
            <span style={{ flex: 1, minWidth: 180, fontSize: 13, fontWeight: 700, color: "var(--s-t1)" }}>
              {pending.length} alteração(ões) não salva(s)
            </span>
            {error && <span style={{ fontSize: 12.5, color: "var(--s-bad)" }}>{error}</span>}
            <SecondaryButton onClick={() => setDeltas(new Map())} disabled={busy}>
              Descartar
            </SecondaryButton>
            <PrimaryButton onClick={save} disabled={busy}>
              {busy ? "Salvando…" : "Salvar vínculos"}
            </PrimaryButton>
          </Panel>
        </div>
      )}

      {orfaos.length > 0 && <Orphans orfaos={orfaos} busy={busy} run={run} cityById={cityById} />}

      {distribuicao && (
        <DistribuirModal
          alvo={distribuicao}
          supervisoes={supervisoes.filter(
            (s) => s.coordenacaoCodigoLocal === distribuicao.coordenacao.codigoLocal,
          )}
          citiesByNode={citiesByNode}
          onToggle={(codigoLocal, bind) => setDelta(codigoLocal, distribuicao.cidadeId, bind)}
          onClose={() => setDistribuicao(null)}
        />
      )}

      {cascade && (
        <AdminModal
          open
          onClose={() => setCascade(null)}
          eyebrow={cascade.coordenacao}
          title={`Remover ${cascade.cidade} da coordenação?`}
          onSubmit={confirmCascade}
          submitLabel="Remover das duas pontas"
          busy={busy}
        >
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--s-t2)" }}>
            {cascade.supervisoes.length} supervisão(ões) abaixo respondem por essa cidade e vão perdê-la
            junto:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflow: "auto" }}>
            {cascade.supervisoes.map((s) => (
              <span
                key={s.codigoLocal}
                style={{
                  padding: "8px 11px",
                  borderRadius: 10,
                  background: "var(--s-sunken)",
                  fontSize: 12.5,
                  color: "var(--s-t2)",
                }}
              >
                {s.nome}
                {s.responsavel && ` · ${s.responsavel}`}
              </span>
            ))}
          </div>
        </AdminModal>
      )}
    </AdminScreen>
  );
}

function buildAlert({
  byCoordenacao,
  byResponsavel,
  coordenacoes,
  supervisoes,
  cidades,
  citiesByNode,
  nodesByCity,
}: {
  byCoordenacao: boolean;
  byResponsavel: boolean;
  coordenacoes: EstruturaNo[];
  supervisoes: SupervisaoNo[];
  cidades: CidadeOpcao[];
  citiesByNode: Map<string, Set<string>>;
  nodesByCity: Map<string, Set<string>>;
}) {
  const heldBy = (nodes: { codigoLocal: string }[], cidadeId: number) => {
    const holders = nodesByCity.get(String(cidadeId));

    return holders ? nodes.some((n) => holders.has(n.codigoLocal)) : false;
  };

  if (byCoordenacao) {
    return byResponsavel
      ? {
          n: coordenacoes.filter((c) => (citiesByNode.get(c.codigoLocal)?.size ?? 0) === 0).length,
          total: coordenacoes.length,
          texto: "coordenações ainda sem cidade. Ninguém abaixo delas enxerga cidade nenhuma.",
        }
      : {
          n: cidades.filter((c) => !heldBy(coordenacoes, c.id)).length,
          total: cidades.length,
          texto: "cidades ainda sem coordenação. Fora os admins, ninguém as enxerga.",
        };
  }

  if (byResponsavel) {
    return {
      n: supervisoes.filter((s) => (citiesByNode.get(s.codigoLocal)?.size ?? 0) === 0).length,
      total: supervisoes.length,
      texto: "supervisões ainda sem cidade. A equipe delas não enxerga cidade nenhuma.",
    };
  }

  // Only cities that a coordenação already holds can be distributed, so the
  // denominator here is the pool, not the whole organograma.
  const naCoordenacao = cidades.filter((c) => heldBy(coordenacoes, c.id));

  return {
    n: naCoordenacao.filter((c) => !heldBy(supervisoes, c.id)).length,
    total: naCoordenacao.length,
    texto: "cidades da coordenação ainda não foram distribuídas a uma supervisão.",
  };
}

function groupBy(pairs: ReadonlySet<string>, by: "node" | "city"): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();

  for (const pair of pairs) {
    const [node, city] = pair.split("|");
    const key = by === "node" ? node : city;
    const value = by === "node" ? city : node;

    map.set(key, (map.get(key) ?? new Set()).add(value));
  }

  return map;
}

interface TabProps {
  cidades: CidadeOpcao[];
  citiesByNode: Map<string, Set<string>>;
  nodesByCity: Map<string, Set<string>>;
  savedByNode: Map<string, Set<string>>;
  savedByCity: Map<string, Set<string>>;
  mode: Mode;
  onlyUnbound: boolean;
  focused: string | null;
  onFocus: (key: string) => void;
  onMove: (codigoLocal: string, cidadeId: number, bind: boolean) => void;
}

function CoordenacaoTab({
  coordenacoes,
  supervisoes,
  cidades,
  citiesByNode,
  nodesByCity,
  savedByNode,
  savedByCity,
  mode,
  onlyUnbound,
  focused,
  onFocus,
  onMove,
  onDistribuir,
}: TabProps & {
  coordenacoes: EstruturaNo[];
  supervisoes: SupervisaoNo[];
  onDistribuir: (coordenacaoCodigo: string, cidadeId: number) => void;
}) {
  const nodeRow = (n: EstruturaNo) => ({
    key: n.codigoLocal,
    title: n.nome,
    subtitle: `${n.responsavel ?? "sem responsável"} · ${citiesByNode.get(n.codigoLocal)?.size ?? 0} cidade(s)`,
    search: [n.nome, n.responsavel],
    icon: <UserRound size={15} />,
  });

  if (mode === "responsavel") {
    const current = focused ? coordenacoes.find((c) => c.codigoLocal === focused) : undefined;
    const bound = current ? (citiesByNode.get(current.codigoLocal) ?? new Set<string>()) : new Set<string>();
    const filhas = current ? supervisoes.filter((s) => s.coordenacaoCodigoLocal === current.codigoLocal) : [];
    const comACidade = (cidadeId: number) =>
      filhas.filter((s) => citiesByNode.get(s.codigoLocal)?.has(String(cidadeId)));

    return (
      <Columns>
        <Column
          placeholder="Coordenação"
          items={coordenacoes
            .filter((c) => !onlyUnbound || (savedByNode.get(c.codigoLocal)?.size ?? 0) === 0)
            .map(nodeRow)}
          selected={focused}
          onSelect={onFocus}
          empty={onlyUnbound ? "Toda coordenação já tem cidade." : "Nenhuma coordenação na carga do RH."}
        />
        <Column
          placeholder="Cidades da coordenação"
          empty={current ? "Nenhuma cidade." : "Selecione uma coordenação à esquerda."}
          items={cidades
            .filter((c) => bound.has(String(c.id)))
            .map((c) => ({
              key: String(c.id),
              title: c.nome,
              subtitle: `${comACidade(c.id).length} de ${filhas.length} supervisão(ões)`,
              search: [c.nome],
              extra: current && (
                <RoundButton
                  Icon={Users}
                  tone="neutral"
                  label={`Supervisões com ${c.nome}`}
                  onClick={() => onDistribuir(current.codigoLocal, c.id)}
                />
              ),
            }))}
          action={
            current && { direction: "right", onClick: (k) => onMove(current.codigoLocal, Number(k), false) }
          }
        />
        <Column
          placeholder="Cidades disponíveis"
          empty={current ? "Nenhuma cidade disponível." : "Selecione uma coordenação à esquerda."}
          items={
            current
              ? cidades
                  .filter((c) => !bound.has(String(c.id)))
                  .map((c) => {
                    const others = nodesByCity.get(String(c.id))?.size ?? 0;

                    return {
                      key: String(c.id),
                      title: c.nome,
                      subtitle: others > 0 ? `já em ${others} nó(s)` : null,
                      search: [c.nome],
                    };
                  })
              : []
          }
          action={
            current && { direction: "left", onClick: (k) => onMove(current.codigoLocal, Number(k), true) }
          }
        />
      </Columns>
    );
  }

  const current = focused ? cidades.find((c) => String(c.id) === focused) : undefined;
  const holders = current ? (nodesByCity.get(String(current.id)) ?? new Set<string>()) : new Set<string>();

  const heldByCoordenacao = (cidadeId: number) => {
    const set = savedByCity.get(String(cidadeId));

    return set ? coordenacoes.some((c) => set.has(c.codigoLocal)) : false;
  };

  return (
    <Columns>
      <Column
        placeholder="Cidade"
        items={cidades
          .filter((c) => !onlyUnbound || !heldByCoordenacao(c.id))
          .map((c) => ({
            key: String(c.id),
            title: c.nome,
            subtitle: `${coordenacoes.filter((n) => nodesByCity.get(String(c.id))?.has(n.codigoLocal)).length} coordenação(ões)`,
            search: [c.nome],
            icon: <MapPin size={15} />,
          }))}
        selected={focused}
        onSelect={onFocus}
        empty={onlyUnbound ? "Toda cidade já tem coordenação." : "Nenhuma cidade no organograma atual."}
      />
      <Column
        placeholder="Coordenações com a cidade"
        empty={current ? "Nenhuma coordenação." : "Selecione uma cidade à esquerda."}
        items={coordenacoes.filter((c) => holders.has(c.codigoLocal)).map(nodeRow)}
        action={current && { direction: "right", onClick: (k) => onMove(k, current.id, false) }}
      />
      <Column
        placeholder="Coordenações disponíveis"
        empty={current ? "Nenhuma coordenação disponível." : "Selecione uma cidade à esquerda."}
        items={current ? coordenacoes.filter((c) => !holders.has(c.codigoLocal)).map(nodeRow) : []}
        action={current && { direction: "left", onClick: (k) => onMove(k, current.id, true) }}
      />
    </Columns>
  );
}

function SupervisaoTab({
  supervisoes,
  cidades,
  citiesByNode,
  nodesByCity,
  savedByNode,
  savedByCity,
  poolOf,
  mode,
  onlyUnbound,
  focused,
  onFocus,
  onMove,
}: TabProps & { supervisoes: SupervisaoNo[]; poolOf: (codigo: string) => Set<string> }) {
  const nodeRow = (s: SupervisaoNo) => ({
    key: s.codigoLocal,
    title: s.nome,
    subtitle: `${s.responsavel ?? "sem responsável"} · ${s.coordenacaoNome} · ${citiesByNode.get(s.codigoLocal)?.size ?? 0} cidade(s)`,
    search: [s.nome, s.responsavel, s.coordenacaoNome],
    icon: <UserRound size={15} />,
  });

  if (mode === "responsavel") {
    const current = focused ? supervisoes.find((s) => s.codigoLocal === focused) : undefined;
    const bound = current ? (citiesByNode.get(current.codigoLocal) ?? new Set<string>()) : new Set<string>();
    const pool = current ? poolOf(current.coordenacaoCodigoLocal) : new Set<string>();

    return (
      <Columns>
        <Column
          placeholder="Supervisão"
          items={supervisoes
            .filter((s) => !onlyUnbound || (savedByNode.get(s.codigoLocal)?.size ?? 0) === 0)
            .map(nodeRow)}
          selected={focused}
          onSelect={onFocus}
          empty={onlyUnbound ? "Toda supervisão já tem cidade." : "Nenhuma supervisão sob coordenação."}
        />
        <Column
          placeholder="Cidades da supervisão"
          empty={current ? "Nenhuma cidade." : "Selecione uma supervisão à esquerda."}
          items={cidades
            .filter((c) => bound.has(String(c.id)))
            .map((c) => ({
              key: String(c.id),
              title: c.nome,
              // A city held by the supervisão but missing from the pool above is
              // a leftover from before the coordenação level existed.
              subtitle: pool.has(String(c.id)) ? null : "fora do conjunto da coordenação",
              search: [c.nome],
            }))}
          action={
            current && { direction: "right", onClick: (k) => onMove(current.codigoLocal, Number(k), false) }
          }
        />
        <Column
          placeholder="Disponíveis na coordenação"
          empty={
            current
              ? pool.size === 0
                ? `${current.coordenacaoNome} ainda não tem cidades.`
                : "Tudo da coordenação já está nesta supervisão."
              : "Selecione uma supervisão à esquerda."
          }
          items={
            current
              ? cidades
                  .filter((c) => pool.has(String(c.id)) && !bound.has(String(c.id)))
                  .map((c) => {
                    const irmas = [...(nodesByCity.get(String(c.id)) ?? [])].filter((codigo) =>
                      supervisoes.some((s) => s.codigoLocal === codigo),
                    ).length;

                    return {
                      key: String(c.id),
                      title: c.nome,
                      subtitle: irmas > 0 ? `já em ${irmas} supervisão(ões)` : null,
                      search: [c.nome],
                    };
                  })
              : []
          }
          action={
            current && { direction: "left", onClick: (k) => onMove(current.codigoLocal, Number(k), true) }
          }
        />
      </Columns>
    );
  }

  const current = focused ? cidades.find((c) => String(c.id) === focused) : undefined;
  const holders = current ? (nodesByCity.get(String(current.id)) ?? new Set<string>()) : new Set<string>();
  // Only a supervisão whose coordenação holds the city may take it.
  const eligible = current
    ? supervisoes.filter((s) => poolOf(s.coordenacaoCodigoLocal).has(String(current.id)))
    : [];

  const heldBySupervisao = (cidadeId: number) => {
    const set = savedByCity.get(String(cidadeId));

    return set ? supervisoes.some((s) => set.has(s.codigoLocal)) : false;
  };

  return (
    <Columns>
      <Column
        placeholder="Cidade"
        items={cidades
          .filter((c) => !onlyUnbound || !heldBySupervisao(c.id))
          .map((c) => ({
            key: String(c.id),
            title: c.nome,
            subtitle: `${supervisoes.filter((s) => nodesByCity.get(String(c.id))?.has(s.codigoLocal)).length} supervisão(ões)`,
            search: [c.nome],
            icon: <MapPin size={15} />,
          }))}
        selected={focused}
        onSelect={onFocus}
        empty={onlyUnbound ? "Toda cidade já tem supervisão." : "Nenhuma cidade no organograma atual."}
      />
      <Column
        placeholder="Supervisões com a cidade"
        empty={current ? "Nenhuma supervisão." : "Selecione uma cidade à esquerda."}
        items={supervisoes.filter((s) => holders.has(s.codigoLocal)).map(nodeRow)}
        action={current && { direction: "right", onClick: (k) => onMove(k, current.id, false) }}
      />
      <Column
        placeholder="Supervisões disponíveis"
        empty={
          current
            ? eligible.length === 0
              ? "Nenhuma coordenação recebeu essa cidade ainda."
              : "Todas as supervisões elegíveis já têm a cidade."
            : "Selecione uma cidade à esquerda."
        }
        items={eligible.filter((s) => !holders.has(s.codigoLocal)).map(nodeRow)}
        action={current && { direction: "left", onClick: (k) => onMove(k, current.id, true) }}
      />
    </Columns>
  );
}

function Columns({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: 14,
        alignItems: "start",
      }}
    >
      {children}
    </div>
  );
}

interface Row {
  key: string;
  title: string;
  subtitle?: string | null;
  search: (string | null | undefined)[];
  icon?: ReactNode;
  /** Secondary control, rendered just before the move arrow. */
  extra?: ReactNode;
}

interface MoveAction {
  direction: "left" | "right";
  onClick: (key: string) => void;
}

interface ListFilter {
  label: string;
  on: boolean;
  onToggle: () => void;
}

function Column({
  placeholder,
  items,
  empty,
  selected,
  onSelect,
  action,
}: {
  placeholder: string;
  items: Row[];
  empty: string;
  selected?: string | null;
  onSelect?: (key: string) => void;
  action?: MoveAction | false | undefined;
}) {
  const [query, setQuery] = useState("");
  const visible = items.filter((i) => textMatches(query, i.title, i.subtitle, ...i.search));

  return (
    <Panel style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--s-border)" }}>
        <SearchInput value={query} onChange={setQuery} placeholder={placeholder} />
      </div>

      <div style={{ height: 440, overflowY: "auto", padding: 6 }}>
        {visible.length === 0 ? (
          <p style={{ margin: 0, padding: 14, fontSize: 12.5, color: "var(--s-t3)" }}>{empty}</p>
        ) : (
          visible.map((item) => (
            <ItemRow
              key={item.key}
              item={item}
              active={selected === item.key}
              onClick={onSelect ? () => onSelect(item.key) : undefined}
              action={
                action ? { direction: action.direction, onClick: () => action.onClick(item.key) } : undefined
              }
            />
          ))
        )}
      </div>
    </Panel>
  );
}

function FilterChip({ filter }: { filter: ListFilter }) {
  return (
    <button
      type="button"
      onClick={filter.onToggle}
      aria-pressed={filter.on}
      className="bd-ghost"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 40,
        padding: "0 14px",
        borderRadius: 999,
        border: `1px solid ${filter.on ? "var(--s-brand-line)" : "var(--s-border)"}`,
        background: filter.on ? "var(--s-brand-weak)" : "var(--s-sunken)",
        color: filter.on ? "var(--s-brand)" : "var(--s-t3)",
        font: "inherit",
        fontSize: 12.5,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {filter.on && <Check size={14} />}
      {filter.label}
    </button>
  );
}

function ActionPill({
  tone,
  label,
  onClick,
  children,
}: {
  tone: "brand" | "neutral";
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  const brand = tone === "brand";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="bd-ghost"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        flexShrink: 0,
        height: 30,
        padding: "0 12px",
        borderRadius: 999,
        border: `1px solid ${brand ? "transparent" : "var(--s-border)"}`,
        background: brand ? "var(--s-brand)" : "var(--s-card)",
        color: brand ? "#fff" : "var(--s-t2)",
        font: "inherit",
        fontSize: 11.5,
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      {brand ? <ArrowLeft size={13} /> : <ArrowRight size={13} />}
      {children}
    </button>
  );
}

function ItemRow({
  item,
  active,
  onClick,
  action,
}: {
  item: Row;
  active: boolean;
  onClick?: () => void;
  action?: { direction: "left" | "right"; onClick: () => void };
}) {
  const content = (
    <>
      {item.icon && (
        <span
          style={{
            display: "grid",
            placeItems: "center",
            width: 28,
            height: 28,
            flexShrink: 0,
            borderRadius: 999,
            background: active ? "var(--s-brand)" : "var(--s-sunken)",
            color: active ? "var(--s-card)" : "var(--s-t3)",
          }}
        >
          {item.icon}
        </span>
      )}
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 700,
            color: active ? "var(--s-brand)" : "var(--s-t1)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {item.title}
        </span>
        {item.subtitle && (
          <span
            style={{
              fontSize: 11,
              color: "var(--s-t3)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.subtitle}
          </span>
        )}
      </span>
    </>
  );

  const style: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    padding: "8px 10px",
    borderRadius: 10,
    background: active ? "var(--s-brand-weak)" : "transparent",
    border: 0,
    font: "inherit",
    textAlign: "left",
  };

  if (!action) {
    return onClick ? (
      <button
        type="button"
        onClick={onClick}
        aria-label={item.title}
        className="bd-ghost"
        style={{ ...style, cursor: "pointer" }}
      >
        {content}
      </button>
    ) : (
      <div style={style}>
        {content}
        {item.extra}
      </div>
    );
  }

  const toRight = action.direction === "right";
  const move = {
    onClick: action.onClick,
    Icon: toRight ? ArrowRight : ArrowLeft,
    label: `${toRight ? "Remover" : "Atribuir"} ${item.title}`,
  };

  return (
    <div style={style}>
      {!toRight && <RoundButton {...move} />}
      {content}
      {item.extra}
      {toRight && <RoundButton {...move} />}
    </div>
  );
}

function RoundButton({
  onClick,
  Icon,
  label,
  tone = "brand",
}: {
  onClick: () => void;
  Icon: typeof ArrowRight;
  label: string;
  tone?: "brand" | "neutral";
}) {
  const brand = tone === "brand";

  return (
    <button
      type="button"
      onClick={onClick}
      className="bd-ghost"
      aria-label={label}
      title={label}
      style={{
        display: "grid",
        placeItems: "center",
        width: 28,
        height: 28,
        flexShrink: 0,
        borderRadius: 999,
        border: `1px solid ${brand ? "var(--s-brand-line)" : "var(--s-border)"}`,
        background: brand ? "var(--s-brand-weak)" : "var(--s-sunken)",
        color: brand ? "var(--s-brand)" : "var(--s-t2)",
        cursor: "pointer",
      }}
    >
      <Icon size={15} />
    </button>
  );
}

/**
 * Distributing one city from the coordenação's side: which of its supervisões
 * answer for it. Reaching the supervisões from here is what makes the pairing
 * obvious — the supervisão tab lists all of them at once, where telling whose
 * they are means reading every subtitle.
 *
 * Toggles stage into the same delta map as the columns; the sticky bar saves.
 */
function DistribuirModal({
  alvo,
  supervisoes,
  citiesByNode,
  onToggle,
  onClose,
}: {
  alvo: Distribuicao;
  supervisoes: SupervisaoNo[];
  citiesByNode: Map<string, Set<string>>;
  onToggle: (codigoLocal: string, bind: boolean) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const temACidade = (s: SupervisaoNo) =>
    citiesByNode.get(s.codigoLocal)?.has(String(alvo.cidadeId)) ?? false;
  const visiveis = supervisoes.filter((s) => textMatches(query, s.nome, s.responsavel));
  const com = visiveis.filter(temACidade);
  const sem = visiveis.filter((s) => !temACidade(s));

  return (
    <ModalShell open onClose={onClose} maxWidth={520}>
      <ModalHeader eyebrow={alvo.coordenacao.nome} title={alvo.cidade} onClose={onClose} />

      <p style={{ margin: 0, fontSize: 12.5, color: "var(--s-t3)" }}>
        {supervisoes.length === 0
          ? "Esta coordenação não tem nenhuma supervisão abaixo dela."
          : `${supervisoes.filter(temACidade).length} de ${supervisoes.length} supervisão(ões) desta coordenação respondem por esta cidade.`}
      </p>

      {supervisoes.length > 0 && (
        <SearchInput value={query} onChange={setQuery} placeholder="Buscar supervisão ou responsável…" />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14, maxHeight: 340, overflowY: "auto" }}>
        <GrupoSupervisoes
          titulo="Com a cidade"
          itens={com}
          vazio="Nenhuma supervisão respondendo por esta cidade."
          atribuidas
          onToggle={onToggle}
        />
        <GrupoSupervisoes
          titulo="Sem a cidade"
          itens={sem}
          vazio="Todas as supervisões desta coordenação já têm a cidade."
          onToggle={onToggle}
        />
      </div>

      <PrimaryButton onClick={onClose}>Concluir</PrimaryButton>
    </ModalShell>
  );
}

function GrupoSupervisoes({
  titulo,
  itens,
  vazio,
  atribuidas,
  onToggle,
}: {
  titulo: string;
  itens: SupervisaoNo[];
  vazio: string;
  atribuidas?: boolean;
  onToggle: (codigoLocal: string, bind: boolean) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 800,
          letterSpacing: ".06em",
          textTransform: "uppercase",
          color: "var(--s-t3)",
        }}
      >
        {titulo} ({itens.length})
      </span>

      {itens.length === 0 ? (
        <p style={{ margin: 0, padding: "4px 2px", fontSize: 12, color: "var(--s-t3)" }}>{vazio}</p>
      ) : (
        itens.map((s) => (
          <div
            key={s.codigoLocal}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 11px",
              borderRadius: 10,
              background: atribuidas ? "var(--s-brand-weak)" : "var(--s-sunken)",
            }}
          >
            <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: atribuidas ? "var(--s-brand)" : "var(--s-t1)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {s.nome}
              </span>
              <span style={{ fontSize: 11, color: "var(--s-t3)" }}>{s.responsavel ?? "sem responsável"}</span>
            </span>
            <ActionPill
              tone={atribuidas ? "neutral" : "brand"}
              label={`${atribuidas ? "Remover de" : "Atribuir a"} ${s.nome}`}
              onClick={() => onToggle(s.codigoLocal, !atribuidas)}
            >
              {atribuidas ? "Remover" : "Atribuir"}
            </ActionPill>
          </div>
        ))
      )}
    </div>
  );
}

/**
 * Bindings on a node that is no longer bindable — it left the RH load, changed
 * level, or is one of the supervisões with no coordenação above. They already
 * grant nothing (the scope resolution only reads bindable nodes), so clearing
 * them is hygiene: it also frees the city visibly.
 */
function Orphans({
  orfaos,
  busy,
  run,
  cityById,
}: {
  orfaos: VinculoOrfao[];
  busy: boolean;
  run: ReturnType<typeof useAdminAction>["run"];
  cityById: Map<string, CidadeOpcao>;
}) {
  return (
    <Panel style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
      <span style={{ fontSize: 13, fontWeight: 800, color: "var(--s-t1)" }}>
        Vínculos órfãos ({orfaos.length})
      </span>
      <span style={{ fontSize: 12.5, color: "var(--s-t3)" }}>
        O nó saiu da estrutura coordenação → supervisão. O vínculo não dá acesso a ninguém e as cidades já
        estão livres.
      </span>
      {orfaos.map((o) => (
        <div
          key={o.codigoLocal}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
        >
          <span style={{ fontSize: 12.5, color: "var(--s-t2)" }}>
            Nó {o.codigoLocal} —{" "}
            {o.cidadeIds.map((id) => cityById.get(String(id))?.nome ?? `#${id}`).join(", ")}
          </span>
          <SecondaryButton onClick={() => run(() => limparVinculoOrfao(o.codigoLocal))} disabled={busy}>
            Remover
          </SecondaryButton>
        </div>
      ))}
    </Panel>
  );
}
