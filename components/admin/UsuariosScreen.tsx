"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AtSign, CircleCheck, CircleX, Users } from "lucide-react";
import { AdminScreen } from "./AdminScreen";
import { AdminModal } from "./AdminModal";
import { ConfirmDelete } from "./ConfirmDelete";
import { AdminSelect } from "./AdminSelect";
import { AsyncSelect, type AsyncOption } from "./AsyncSelect";
import { Chip, Panel, RowActions } from "./primitives";
import { useAdminAction } from "./useAdminAction";
import { textMatches } from "./filter";
import { DataTable, type Column } from "@/components/ui/data-table";
import { WARN_TONE, nivelChipTone, statusChipTone } from "@/lib/data/admin/derive";
import {
  previewEscopo,
  removeUsuario,
  saveUsuario,
  searchUsuarioCandidates,
  searchUsuarioPessoas,
  type EscopoPreview,
} from "@/app/(app)/admin/actions";
import type { Cargo, Nivel, ScopeKind, Usuario } from "@/lib/data/admin/types";

interface Draft {
  id?: number;
  nome: string;
  email: string;
  /** Own CPF — only known on edit; on create the preview resolves it from the e-mail. */
  cpf: string | null;
  nivelId: number | null;
  cargoId: number | null;
  ativo: boolean;
  escopoTipo: ScopeKind;
  escopoCpf: string | null;
  escopoNome: string | null;
}

export function UsuariosScreen({
  usuarios,
  niveis,
  cargos,
}: {
  usuarios: Usuario[];
  niveis: Nivel[];
  cargos: Cargo[];
}) {
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [target, setTarget] = useState<Usuario | null>(null);
  const { busy, error, setError, run } = useAdminAction();

  const rows = useMemo(
    () => usuarios.filter((u) => textMatches(query, u.nome, u.email, u.nivelNome, u.cargoNome)),
    [usuarios, query],
  );

  const nivelOptions = niveis.map((n) => ({ id: n.id, label: n.nome }));
  const cargoOptions = cargos.map((c) => ({ id: c.id, label: c.nome }));

  const columns: Column<Usuario>[] = [
    {
      key: "usuario",
      header: "Usuário",
      render: (u) => (
        <span style={{ display: "block" }}>
          <span style={{ display: "block", fontWeight: 800, color: "var(--s-t1)" }}>{u.nome}</span>
          <span style={{ display: "block", fontSize: 11.5, color: "var(--s-t3)" }}>{u.email}</span>
        </span>
      ),
    },
    {
      key: "nivel",
      header: "Nível",
      render: (u) =>
        u.nivelNome ? (
          <Chip tone={nivelChipTone()}>{u.nivelNome}</Chip>
        ) : (
          <span style={{ color: "var(--s-t3)" }}>—</span>
        ),
    },
    {
      key: "cargo",
      header: "Cargo",
      render: (u) => <span style={{ color: "var(--s-t2)", fontWeight: 600 }}>{u.cargoNome ?? "—"}</span>,
    },
    {
      key: "escopo",
      header: "Escopo",
      render: (u) => <EscopoCell usuario={u} />,
    },
    {
      key: "status",
      header: "Status",
      render: (u) => <Chip tone={statusChipTone(u.ativo)}>{u.ativo ? "Ativo" : "Inativo"}</Chip>,
    },
    {
      key: "sincronizado",
      header: "Sincronizado",
      align: "center",
      render: (u) => <SyncIndicator on={u.sincronizado} />,
    },
    {
      key: "acoes",
      header: "",
      align: "right",
      render: (u) => <RowActions onEdit={() => openEdit(u)} onDelete={() => setTarget(u)} />,
    },
  ];

  function openNew() {
    setError(null);
    setDraft({
      nome: "",
      email: "",
      cpf: null,
      nivelId: niveis[0]?.id ?? null,
      cargoId: null,
      ativo: true,
      escopoTipo: "proprio",
      escopoCpf: null,
      escopoNome: null,
    });
  }

  function openEdit(u: Usuario) {
    setError(null);
    setDraft({
      id: u.id,
      nome: u.nome,
      email: u.email,
      cpf: u.cpf,
      nivelId: u.nivelId,
      cargoId: u.cargoId,
      ativo: u.ativo,
      escopoTipo: u.escopoTipo,
      escopoCpf: u.escopoCpf,
      escopoNome: u.escopoNome,
    });
  }

  // Search hierarchy candidates (server-side, max 100), mapped to the picker shape.
  const searchCandidates = useCallback(
    (query: string): Promise<AsyncOption[]> =>
      searchUsuarioCandidates(query).then((rows) =>
        rows.map((r) => ({ value: r.email, label: r.nome, hint: r.email })),
      ),
    [],
  );

  // The delegated-scope picker draws from everyone in the hierarchy, keyed by CPF.
  const searchPessoas = useCallback(
    (query: string): Promise<AsyncOption[]> =>
      searchUsuarioPessoas(query).then((rows) =>
        rows.map((r) => ({ value: r.cpf, label: r.nome, hint: r.cargo ?? r.email ?? undefined })),
      ),
    [],
  );

  function submit() {
    if (!draft) return;

    run(
      () =>
        saveUsuario({
          id: draft.id,
          // On create, the selected candidate e-mail; on edit, the server keeps the stored identity.
          email: draft.id ? undefined : draft.email,
          nivelId: draft.nivelId,
          cargoId: draft.cargoId,
          ativo: draft.ativo,
          escopoTipo: draft.escopoTipo,
          escopoCpf: draft.escopoCpf,
        }),
      () => setDraft(null),
    );
  }

  function confirmDelete() {
    if (!target) return;

    run(
      () => removeUsuario(target.id),
      () => setTarget(null),
    );
  }

  return (
    <AdminScreen
      title="Usuários"
      subtitle="Vincule cada pessoa a um nível de acesso e a um cargo"
      search={{ value: query, onChange: setQuery, placeholder: "Buscar por nome, e-mail…" }}
      action={{ label: "Vincular usuário", onClick: openNew }}
    >
      <Panel>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(u) => String(u.id)}
          minWidth={720}
          pageSize={25}
          empty={{ title: "Nenhum usuário", hint: "Vincule a primeira pessoa a um nível de acesso." }}
        />
      </Panel>

      {draft && (
        <AdminModal
          open
          onClose={() => setDraft(null)}
          eyebrow={draft.id ? "Editar usuário" : "Vincular usuário"}
          title={draft.id ? "Editar usuário" : "Vincular usuário"}
          onSubmit={submit}
          submitLabel={draft.id ? "Salvar" : "Vincular"}
          submitDisabled={!draft.email || (draft.escopoTipo === "gestor" && !draft.escopoCpf)}
          busy={busy}
          error={error}
        >
          {draft.id ? (
            // Edit: identity is fixed (came from the hierarchy) — show it, don't re-pick.
            <div>
              <FieldLabel>Usuário</FieldLabel>
              <div
                style={{
                  padding: "9px 12px",
                  borderRadius: 10,
                  background: "var(--s-sunken)",
                  border: "1px solid var(--s-border)",
                }}
              >
                <span style={{ display: "block", fontWeight: 800, color: "var(--s-t1)", fontSize: 13.5 }}>
                  {draft.nome}
                </span>
              </div>
            </div>
          ) : (
            <AsyncSelect
              label="Usuário"
              value={draft.email ? { value: draft.email, label: draft.nome, hint: draft.email } : null}
              onChange={(opt) => setDraft({ ...draft, nome: opt?.label ?? "", email: opt?.value ?? "" })}
              search={searchCandidates}
              placeholder="Selecionar pessoa da hierarquia…"
              searchPlaceholder="Buscar por nome, e-mail, matrícula…"
              emptyText="Nenhuma pessoa disponível (sem e-mail ou já cadastrada)."
            />
          )}
          {/* Email is the real address from the hierarchy — read-only, shown once a person is picked. */}
          {draft.email && (
            <div>
              <FieldLabel>E-mail (login)</FieldLabel>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "9px 12px",
                  borderRadius: 10,
                  background: "var(--s-sunken)",
                  border: "1px solid var(--s-border)",
                  color: "var(--s-t2)",
                  fontSize: 12.5,
                  fontWeight: 600,
                }}
              >
                <AtSign size={14} style={{ flex: "none", color: "var(--s-t3)" }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {draft.email}
                </span>
              </div>
            </div>
          )}
          <AdminSelect
            label="Nível de acesso"
            value={draft.nivelId}
            options={nivelOptions}
            onChange={(nivelId) => setDraft({ ...draft, nivelId })}
            placeholder="Selecionar nível…"
          />
          <AdminSelect
            label="Cargo"
            value={draft.cargoId}
            options={cargoOptions}
            onChange={(cargoId) => setDraft({ ...draft, cargoId })}
            placeholder="Selecionar cargo…"
            noneLabel="Sem cargo"
          />
          <EscopoField draft={draft} onChange={setDraft} search={searchPessoas} />
          {draft.id ? (
            <StatusToggle value={draft.ativo} onChange={(ativo) => setDraft({ ...draft, ativo })} />
          ) : (
            <div style={{ fontSize: 11.5, color: "var(--s-t3)" }}>Novo usuário entra sempre como Ativo.</div>
          )}
        </AdminModal>
      )}

      {target && (
        <ConfirmDelete
          open
          onClose={() => setTarget(null)}
          onConfirm={confirmDelete}
          question="Excluir este usuário?"
          recordName={`${target.nome} · ${target.email}`}
          busy={busy}
        />
      )}
    </AdminScreen>
  );
}

/** Boolean sync status as a suggestive icon: green check when synced, muted ✕ when not. */
function SyncIndicator({ on }: { on: boolean }) {
  return (
    <span
      title={on ? "Sincronizado" : "Não sincronizado"}
      aria-label={on ? "Sincronizado" : "Não sincronizado"}
      style={{ display: "inline-flex", color: on ? "var(--s-ok)" : "var(--s-t3)" }}
    >
      {on ? <CircleCheck size={18} strokeWidth={2.2} /> : <CircleX size={18} strokeWidth={2.2} />}
    </span>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        display: "block",
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: ".06em",
        textTransform: "uppercase",
        color: "var(--s-t3)",
        marginBottom: 6,
      }}
    >
      {children}
    </span>
  );
}

/** Pill group used by both the status and the escopo selectors. */
function Segmented<T extends string | boolean>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { label: string; val: T }[];
  onChange: (v: T) => void;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        padding: 3,
        borderRadius: 10,
        background: "var(--s-sunken)",
        border: "1px solid var(--s-border)",
      }}
    >
      {options.map((opt) => {
        const active = opt.val === value;

        return (
          <button
            key={opt.label}
            type="button"
            onClick={() => onChange(opt.val)}
            style={{
              padding: "6px 16px",
              borderRadius: 8,
              border: 0,
              background: active ? "var(--s-card)" : "transparent",
              color: active ? "var(--s-t1)" : "var(--s-t3)",
              font: "inherit",
              fontSize: 12.5,
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: active ? "var(--s-sh)" : undefined,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function StatusToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div>
      <FieldLabel>Status</FieldLabel>
      <Segmented
        value={value}
        onChange={onChange}
        options={[
          { label: "Ativo", val: true },
          { label: "Inativo", val: false },
        ]}
      />
    </div>
  );
}

const ESCOPO_OPTIONS: { label: string; val: ScopeKind }[] = [
  { label: "A própria posição", val: "proprio" },
  { label: "Vê o mesmo que", val: "gestor" },
  { label: "Tudo", val: "todos" },
];

/** One-line summary of a user's escopo for the table. */
function EscopoCell({ usuario }: { usuario: Usuario }) {
  if (usuario.escopoTipo === "todos") return <Chip tone={WARN_TONE}>Tudo</Chip>;

  if (usuario.escopoTipo === "gestor") {
    return (
      <span style={{ color: "var(--s-t2)", fontWeight: 600, fontSize: 12.5 }}>
        Vê como: {usuario.escopoNome ?? usuario.escopoCpf ?? "—"}
      </span>
    );
  }

  return <span style={{ color: "var(--s-t3)", fontWeight: 600, fontSize: 12.5 }}>Própria</span>;
}

/**
 * The data-scope field: whose view this user takes, plus a live read of what
 * that resolves to today. The preview matters because "a própria posição" means
 * nothing until you know whether the person answers for a node — a promotor
 * resolves to themselves, a supervisor to a whole subtree.
 */
function EscopoField({
  draft,
  onChange,
  search,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
  search: (query: string) => Promise<AsyncOption[]>;
}) {
  const [preview, setPreview] = useState<EscopoPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const { escopoTipo, escopoCpf, cpf, email } = draft;

  useEffect(() => {
    if (escopoTipo === "todos" || (escopoTipo === "gestor" && !escopoCpf)) {
      setPreview(null);

      return;
    }

    let stale = false;

    setLoading(true);
    previewEscopo({ escopoTipo, escopoCpf, cpf, email })
      .then((r) => {
        if (!stale) setPreview(r);
      })
      .finally(() => {
        if (!stale) setLoading(false);
      });

    return () => {
      stale = true;
    };
  }, [escopoTipo, escopoCpf, cpf, email]);

  return (
    <div>
      <FieldLabel>Escopo de dados</FieldLabel>
      <Segmented
        value={escopoTipo}
        options={ESCOPO_OPTIONS}
        onChange={(val) =>
          onChange({
            ...draft,
            escopoTipo: val,
            ...(val === "gestor" ? {} : { escopoCpf: null, escopoNome: null }),
          })
        }
      />
      {escopoTipo === "gestor" && (
        <div style={{ marginTop: 10 }}>
          <AsyncSelect
            label=""
            value={escopoCpf ? { value: escopoCpf, label: draft.escopoNome ?? escopoCpf } : null}
            onChange={(opt) =>
              onChange({ ...draft, escopoCpf: opt?.value ?? null, escopoNome: opt?.label ?? null })
            }
            search={search}
            placeholder="Selecionar pessoa…"
            searchPlaceholder="Buscar por nome, CPF, matrícula…"
            emptyText="Nenhuma pessoa encontrada na hierarquia."
          />
        </div>
      )}
      <EscopoPreviewLine tipo={escopoTipo} loading={loading} preview={preview} />
    </div>
  );
}

function EscopoPreviewLine({
  tipo,
  loading,
  preview,
}: {
  tipo: ScopeKind;
  loading: boolean;
  preview: EscopoPreview | null;
}) {
  const text = (() => {
    if (tipo === "todos") return "Vê todos os dados, sem restrição de hierarquia.";

    if (loading) return "Calculando…";

    if (!preview) return tipo === "gestor" ? "Selecione a pessoa." : null;

    if (preview.foraDaHierarquia) return "Não está na hierarquia do RH — não verá dado nenhum.";

    if (preview.nos.length === 0)
      return "Não responde por nenhuma estrutura — verá apenas os próprios dados.";

    return `${preview.nos.join(" · ")} · ${preview.pessoas} ${preview.pessoas === 1 ? "pessoa" : "pessoas"}`;
  })();

  if (!text) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        marginTop: 8,
        fontSize: 11.5,
        color: "var(--s-t3)",
      }}
    >
      <Users size={13} style={{ flex: "none" }} />
      <span>{text}</span>
    </div>
  );
}
