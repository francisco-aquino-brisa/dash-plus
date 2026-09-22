"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, MapPin, UserRound } from "lucide-react";
import { AdminScreen } from "./AdminScreen";
import { Panel, PrimaryButton, SearchInput, SecondaryButton } from "./primitives";
import { textMatches } from "./filter";
import { useAdminAction } from "./useAdminAction";
import { Segmented } from "@/components/ui/segmented";
import { limparVinculoOrfao, salvarVinculos } from "@/app/(app)/admin/actions";
import type { CidadeOpcao, Supervisao, VinculoOrfao } from "@/lib/data/admin/types";

type Mode = "responsavel" | "cidade";

const MODES = [
  { value: "responsavel" as const, label: "Por responsável" },
  { value: "cidade" as const, label: "Por cidade" },
];

const pairKey = (codigoLocal: string, cidadeId: number | string) => `${codigoLocal}|${cidadeId}`;

export function SupervisaoCidadesScreen({
  supervisoes,
  cidades,
  orfaos,
}: {
  supervisoes: Supervisao[];
  cidades: CidadeOpcao[];
  orfaos: VinculoOrfao[];
}) {
  const [mode, setMode] = useState<Mode>("responsavel");
  const [focused, setFocused] = useState<string | null>(null);
  const [onlyUnbound, setOnlyUnbound] = useState(false);
  const { busy, error, setError, run } = useAdminAction();

  /**
   * Edits live as a delta over the server's state instead of replacing it: a
   * save that lands (and re-renders with new props) makes the matching deltas
   * no-ops, and a move back to where it started stops counting as pending.
   */
  const base = useMemo(
    () => new Set(supervisoes.flatMap((s) => s.cidadeIds.map((id) => pairKey(s.codigoLocal, id)))),
    [supervisoes],
  );
  const [deltas, setDeltas] = useState<Map<string, boolean>>(new Map());

  const pending = useMemo(() => [...deltas].filter(([key, bind]) => base.has(key) !== bind), [deltas, base]);

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
  const savedCitiesByNode = useMemo(() => groupBy(base, "node"), [base]);
  const savedNodesByCity = useMemo(() => groupBy(base, "city"), [base]);

  const cityById = useMemo(() => new Map(cidades.map((c) => [String(c.id), c])), [cidades]);
  const nodeByCodigo = useMemo(() => new Map(supervisoes.map((s) => [s.codigoLocal, s])), [supervisoes]);

  function move(codigoLocal: string, cidadeId: number, bind: boolean) {
    setError(null);
    setDeltas((prev) => new Map(prev).set(pairKey(codigoLocal, cidadeId), bind));
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

  // The focused row belongs to whichever list the mode puts first, so it cannot
  // survive a mode switch.
  function switchMode(next: Mode) {
    setMode(next);
    setFocused(null);
  }

  const byResponsavel = mode === "responsavel";
  const unboundNodes = supervisoes.filter((s) => (citiesByNode.get(s.codigoLocal)?.size ?? 0) === 0).length;
  const unboundCities = cidades.filter((c) => (nodesByCity.get(String(c.id))?.size ?? 0) === 0).length;
  const alert = byResponsavel
    ? {
        n: unboundNodes,
        total: supervisoes.length,
        texto: "supervisões ainda sem cidade. Quem está abaixo delas não enxerga nenhuma cidade.",
      }
    : {
        n: unboundCities,
        total: cidades.length,
        texto: "cidades ainda sem responsável. Fora os admins, ninguém enxerga essas cidades.",
      };
  const filter = {
    label: byResponsavel ? "Só sem cidade" : "Só sem responsável",
    on: onlyUnbound,
    onToggle: () => setOnlyUnbound((v) => !v),
  };

  return (
    <AdminScreen
      title="Cidades por supervisão"
      subtitle="Quais cidades cada supervisão responde. O escopo sobe para a gestão e desce para a equipe."
      extra={
        <>
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

      {byResponsavel ? (
        <ByResponsavel
          supervisoes={supervisoes}
          cidades={cidades}
          citiesByNode={citiesByNode}
          nodesByCity={nodesByCity}
          savedCitiesByNode={savedCitiesByNode}
          onlyUnbound={onlyUnbound}
          focused={focused}
          onFocus={setFocused}
          onMove={move}
        />
      ) : (
        <ByCidade
          supervisoes={supervisoes}
          cidades={cidades}
          citiesByNode={citiesByNode}
          nodesByCity={nodesByCity}
          savedNodesByCity={savedNodesByCity}
          nodeByCodigo={nodeByCodigo}
          onlyUnbound={onlyUnbound}
          focused={focused}
          onFocus={setFocused}
          onMove={move}
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
    </AdminScreen>
  );
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

interface ListFilter {
  label: string;
  on: boolean;
  onToggle: () => void;
}

interface PanelProps {
  supervisoes: Supervisao[];
  cidades: CidadeOpcao[];
  citiesByNode: Map<string, Set<string>>;
  nodesByCity: Map<string, Set<string>>;
  onlyUnbound: boolean;
  focused: string | null;
  onFocus: (key: string) => void;
  onMove: (codigoLocal: string, cidadeId: number, bind: boolean) => void;
}

function ByResponsavel({
  supervisoes,
  cidades,
  citiesByNode,
  nodesByCity,
  savedCitiesByNode,
  onlyUnbound,
  focused,
  onFocus,
  onMove,
}: PanelProps & { savedCitiesByNode: Map<string, Set<string>> }) {
  const current = focused ? supervisoes.find((s) => s.codigoLocal === focused) : undefined;
  const bound = current ? (citiesByNode.get(current.codigoLocal) ?? new Set<string>()) : new Set<string>();

  return (
    <Columns>
      <Column
        placeholder="Supervisor de cidade"
        items={supervisoes
          .filter((s) => !onlyUnbound || (savedCitiesByNode.get(s.codigoLocal)?.size ?? 0) === 0)
          .map((s) => ({
            key: s.codigoLocal,
            title: s.responsavel ?? s.nome,
            subtitle: `${s.nome} · ${citiesByNode.get(s.codigoLocal)?.size ?? 0} cidade(s)`,
            search: [s.nome, s.responsavel],
            icon: <UserRound size={15} />,
          }))}
        selected={focused}
        onSelect={onFocus}
        empty={onlyUnbound ? "Toda supervisão já tem cidade." : "Nenhuma supervisão na carga atual do RH."}
      />

      <Column
        placeholder="Cidades atribuídas"
        empty={current ? "Nenhuma cidade atribuída." : "Selecione um supervisor à esquerda."}
        items={cidades
          .filter((c) => bound.has(String(c.id)))
          .map((c) => ({
            key: String(c.id),
            title: c.nome,
            subtitle: c.coordenacao,
            search: [c.nome, c.coordenacao],
          }))}
        action={
          current && { direction: "right", onClick: (k) => onMove(current.codigoLocal, Number(k), false) }
        }
      />

      <Column
        placeholder="Cidades disponíveis"
        empty={current ? "Nenhuma cidade disponível." : "Selecione um supervisor à esquerda."}
        items={
          current
            ? cidades
                .filter((c) => !bound.has(String(c.id)))
                .map((c) => {
                  const others = nodesByCity.get(String(c.id))?.size ?? 0;

                  return {
                    key: String(c.id),
                    title: c.nome,
                    subtitle:
                      others > 0 ? `${c.coordenacao} · já em ${others} supervisão(ões)` : c.coordenacao,
                    search: [c.nome, c.coordenacao],
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

function ByCidade({
  supervisoes,
  cidades,
  citiesByNode,
  nodesByCity,
  savedNodesByCity,
  nodeByCodigo,
  onlyUnbound,
  focused,
  onFocus,
  onMove,
}: PanelProps & {
  savedNodesByCity: Map<string, Set<string>>;
  nodeByCodigo: Map<string, Supervisao>;
}) {
  const current = focused ? cidades.find((c) => String(c.id) === focused) : undefined;
  const bound = current ? (nodesByCity.get(String(current.id)) ?? new Set<string>()) : new Set<string>();

  const nodeRow = (s: Supervisao) => ({
    key: s.codigoLocal,
    title: s.responsavel ?? s.nome,
    subtitle: `${s.nome} · ${citiesByNode.get(s.codigoLocal)?.size ?? 0} cidade(s)`,
    search: [s.nome, s.responsavel],
    icon: <UserRound size={15} />,
  });

  return (
    <Columns>
      <Column
        placeholder="Cidade"
        items={cidades
          .filter((c) => !onlyUnbound || (savedNodesByCity.get(String(c.id))?.size ?? 0) === 0)
          .map((c) => ({
            key: String(c.id),
            title: c.nome,
            subtitle: `${c.coordenacao} · ${nodesByCity.get(String(c.id))?.size ?? 0} responsável(is)`,
            search: [c.nome, c.coordenacao, c.gerencia],
            icon: <MapPin size={15} />,
          }))}
        selected={focused}
        onSelect={onFocus}
        empty={onlyUnbound ? "Toda cidade já tem responsável." : "Nenhuma cidade no organograma atual."}
      />

      <Column
        placeholder="Responsáveis atribuídos"
        empty={current ? "Nenhum responsável." : "Selecione uma cidade à esquerda."}
        items={[...bound]
          .map((codigo) => nodeByCodigo.get(codigo))
          .filter((s): s is Supervisao => s != null)
          .map(nodeRow)}
        action={current && { direction: "right", onClick: (k) => onMove(k, current.id, false) }}
      />

      <Column
        placeholder="Responsáveis disponíveis"
        empty={current ? "Nenhum responsável disponível." : "Selecione uma cidade à esquerda."}
        items={current ? supervisoes.filter((s) => !bound.has(s.codigoLocal)).map(nodeRow) : []}
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
}

interface MoveAction {
  direction: "left" | "right";
  onClick: (key: string) => void;
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
      <button type="button" onClick={onClick} className="bd-ghost" style={{ ...style, cursor: "pointer" }}>
        {content}
      </button>
    ) : (
      <div style={style}>{content}</div>
    );
  }

  const Arrow = action.direction === "right" ? ArrowRight : ArrowLeft;

  return (
    <div style={style}>
      {action.direction === "left" && <MoveButton onClick={action.onClick} Arrow={Arrow} />}
      {content}
      {action.direction === "right" && <MoveButton onClick={action.onClick} Arrow={Arrow} />}
    </div>
  );
}

function MoveButton({ onClick, Arrow }: { onClick: () => void; Arrow: typeof ArrowRight }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bd-ghost"
      aria-label="Mover"
      style={{
        display: "grid",
        placeItems: "center",
        width: 28,
        height: 28,
        flexShrink: 0,
        borderRadius: 999,
        border: "1px solid var(--s-brand-line)",
        background: "var(--s-brand-weak)",
        color: "var(--s-brand)",
        cursor: "pointer",
      }}
    >
      <Arrow size={15} />
    </button>
  );
}

/**
 * Bindings whose supervisão no longer exists in the RH load. They already grant
 * nothing (the scope query joins the live tree), so clearing them is hygiene —
 * it is also what makes the city visibly free again in this screen.
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
        A supervisão saiu da carga do RH. O vínculo não dá acesso a ninguém e as cidades já estão livres para
        outra supervisão.
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
