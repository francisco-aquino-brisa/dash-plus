"use client";

import type { CSSProperties, ReactNode } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { ChevronDown, ChevronUp, Users, type LucideIcon } from "lucide-react";
import type { NivelHierarquia } from "@/lib/data/organograma/types";
import { NODE_HEIGHT_BY_TYPE, NODE_WIDTH } from "./layout";

/** Single-line truncation for the name/role text rows — the height each card
 * declares (layout.ts) only holds true if a long name can never wrap to a
 * second line and push the box taller than what was laid out for it. */
const ELLIPSIS: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

export const NIVEL_LABEL: Record<NivelHierarquia, string> = {
  diretoria: "Diretoria",
  gerencia_executiva: "Gerência Executiva",
  gerencia_funcional: "Gerência Funcional",
  coordenacao: "Coordenação",
  supervisao: "Supervisão",
  lideranca: "Liderança",
};

const HANDLE_STYLE: CSSProperties = {
  opacity: 0,
  width: 1,
  height: 1,
  minWidth: 0,
  minHeight: 0,
  border: "none",
  background: "transparent",
};

function Handles() {
  return (
    <>
      <Handle type="target" position={Position.Top} style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Bottom} style={HANDLE_STYLE} />
    </>
  );
}

function Card({
  children,
  type,
  accent,
  dashed,
  onClick,
}: {
  children: ReactNode;
  /** Node type key into `NODE_HEIGHT_BY_TYPE` — the box is exactly this tall,
   * never taller, so it always matches what layout.ts told dagre and xyflow. */
  type: keyof typeof NODE_HEIGHT_BY_TYPE;
  accent?: "brand" | "muted";
  dashed?: boolean;
  onClick?: () => void;
}) {
  const style: CSSProperties = {
    width: NODE_WIDTH,
    height: NODE_HEIGHT_BY_TYPE[type],
    boxSizing: "border-box",
    overflow: "hidden",
    padding: "9px 12px",
    borderRadius: 12,
    border: `1px ${dashed ? "dashed" : "solid"} ${accent === "brand" ? "var(--s-brand-line)" : "var(--s-border)"}`,
    background: accent === "brand" ? "var(--s-brand-weak)" : "var(--s-card)",
    cursor: onClick ? "pointer" : "default",
    textAlign: "left",
  };

  return (
    <div style={style} onClick={onClick}>
      <Handles />
      {children}
    </div>
  );
}

function SituacaoBadge({ situacao }: { situacao: string | null }) {
  if (!situacao || situacao === "ATIVO") return null;

  return (
    <span
      style={{
        display: "inline-block",
        marginTop: 4,
        padding: "1px 7px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 700,
        color: "var(--s-warn)",
        background: "var(--s-warn-bg)",
      }}
    >
      {situacao}
    </span>
  );
}

function ExpandButton({
  icon: Icon,
  onToggle,
  label,
}: {
  /** The caller picks the icon for what the click actually does — an
   * ancestor's button always reveals someone further up (chevron up), while a
   * manager's toggles between showing/hiding the team below it (down to
   * reveal, up to collapse back). Inferring one icon for both from a single
   * `expanded` flag is what made the ancestor button point the wrong way. */
  icon: LucideIcon;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      style={{
        flex: "none",
        display: "grid",
        placeItems: "center",
        width: 22,
        height: 22,
        borderRadius: 999,
        border: "1px solid var(--s-border)",
        background: "var(--s-sunken)",
        color: "var(--s-t2)",
        cursor: "pointer",
      }}
    >
      <Icon size={13} />
    </button>
  );
}

export interface AncestorNodeData extends Record<string, unknown> {
  nivel: NivelHierarquia;
  nome: string;
  responsavelNome: string;
  canExpandUp: boolean;
  onExpandUp: () => void;
}

export function AncestorNode({ data }: NodeProps) {
  const d = data as AncestorNodeData;

  return (
    <Card type="ancestor" accent="muted">
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: ".04em",
              color: "var(--s-t3)",
              textTransform: "uppercase",
              ...ELLIPSIS,
            }}
          >
            {NIVEL_LABEL[d.nivel]}
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--s-t1)", marginTop: 2, ...ELLIPSIS }}>
            {d.nome}
          </div>
          <div style={{ fontSize: 11, color: "var(--s-t3)", marginTop: 1, ...ELLIPSIS }}>
            {d.responsavelNome}
          </div>
        </div>
        {d.canExpandUp && <ExpandButton icon={ChevronUp} onToggle={d.onExpandUp} label="Ver gestor acima" />}
      </div>
    </Card>
  );
}

export interface SelfNodeData extends Record<string, unknown> {
  nome: string;
  cargo: string | null;
  situacao: string | null;
}

export function SelfNode({ data }: NodeProps) {
  const d = data as SelfNodeData;

  return (
    <Card type="self" accent="brand">
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: ".05em",
          color: "var(--s-brand)",
          textTransform: "uppercase",
        }}
      >
        Você
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--s-t1)", marginTop: 2, ...ELLIPSIS }}>
        {d.nome}
      </div>
      {d.cargo && (
        <div style={{ fontSize: 11.5, color: "var(--s-t2)", marginTop: 1, ...ELLIPSIS }}>{d.cargo}</div>
      )}
      <SituacaoBadge situacao={d.situacao} />
    </Card>
  );
}

export interface ManagerNodeData extends Record<string, unknown> {
  nivel: NivelHierarquia;
  nome: string;
  responsavelNome: string;
  totalPessoas: number;
  hasMore: boolean;
  expanded: boolean;
  onToggle: () => void;
}

export function ManagerNode({ data }: NodeProps) {
  const d = data as ManagerNodeData;

  return (
    <Card type="manager">
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: ".04em",
              color: "var(--s-t3)",
              textTransform: "uppercase",
              ...ELLIPSIS,
            }}
          >
            {NIVEL_LABEL[d.nivel]}
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--s-t1)", marginTop: 2, ...ELLIPSIS }}>
            {d.nome}
          </div>
          <div style={{ fontSize: 11, color: "var(--s-t3)", marginTop: 1, ...ELLIPSIS }}>
            {d.responsavelNome}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              marginTop: 5,
              fontSize: 10.5,
              color: "var(--s-t3)",
            }}
          >
            <Users size={11} />
            {d.totalPessoas} {d.totalPessoas === 1 ? "pessoa" : "pessoas"}
          </div>
        </div>
        {d.hasMore && (
          <ExpandButton
            icon={d.expanded ? ChevronUp : ChevronDown}
            onToggle={d.onToggle}
            label={d.expanded ? "Recolher" : "Expandir"}
          />
        )}
      </div>
    </Card>
  );
}

export interface PersonNodeData extends Record<string, unknown> {
  nome: string;
  cargo: string | null;
  situacao: string | null;
  isSelf: boolean;
}

export function PersonNode({ data }: NodeProps) {
  const d = data as PersonNodeData;

  return (
    <Card type="person" accent={d.isSelf ? "brand" : undefined}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--s-t1)", ...ELLIPSIS }}>{d.nome}</div>
      {d.cargo && (
        <div style={{ fontSize: 11, color: "var(--s-t3)", marginTop: 1, ...ELLIPSIS }}>{d.cargo}</div>
      )}
      <SituacaoBadge situacao={d.situacao} />
    </Card>
  );
}

export interface GroupNodeData extends Record<string, unknown> {
  label: string;
  onOpen: () => void;
}

export function GroupNode({ data }: NodeProps) {
  const d = data as GroupNodeData;

  return (
    <Card type="grupo" dashed onClick={d.onOpen}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, height: "100%" }}>
        <span
          style={{
            flex: "none",
            display: "grid",
            placeItems: "center",
            width: 26,
            height: 26,
            borderRadius: 999,
            background: "var(--s-sunken)",
            color: "var(--s-t2)",
          }}
        >
          <Users size={13} />
        </span>
        <span
          style={{ minWidth: 0, flex: 1, fontSize: 12, fontWeight: 700, color: "var(--s-t1)", ...ELLIPSIS }}
        >
          {d.label}
        </span>
      </div>
    </Card>
  );
}

export const ORG_NODE_TYPES = {
  ancestor: AncestorNode,
  self: SelfNode,
  manager: ManagerNode,
  person: PersonNode,
  // "grupo", never "group" — see the note on NODE_HEIGHT_BY_TYPE in layout.ts.
  grupo: GroupNode,
};
