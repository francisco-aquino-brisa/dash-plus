"use client";

import { useMemo, useState } from "react";
import { AtSign } from "lucide-react";
import { AdminScreen } from "./AdminScreen";
import { AdminModal } from "./AdminModal";
import { ConfirmDelete } from "./ConfirmDelete";
import { AdminSelect } from "./AdminSelect";
import { Chip, Field, Panel, RowActions } from "./primitives";
import { useAdminAction } from "./useAdminAction";
import { textMatches } from "./filter";
import { DataTable, type Column } from "@/components/ui/data-table";
import { deriveEmail, nivelChipTone, statusChipTone } from "@/lib/data/admin/derive";
import { removeUsuario, saveUsuario } from "@/app/(app)/admin/actions";
import type { Cargo, Nivel, Usuario } from "@/lib/data/admin/types";

interface Draft {
  id?: number;
  nome: string;
  nivelId: number | null;
  cargoId: number | null;
  ativo: boolean;
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
          <Chip tone={nivelChipTone(u.nivelNome)}>{u.nivelNome}</Chip>
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
      key: "status",
      header: "Status",
      render: (u) => <Chip tone={statusChipTone(u.ativo)}>{u.ativo ? "Ativo" : "Inativo"}</Chip>,
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
    setDraft({ nome: "", nivelId: niveis[0]?.id ?? null, cargoId: null, ativo: true });
  }

  function openEdit(u: Usuario) {
    setError(null);
    setDraft({ id: u.id, nome: u.nome, nivelId: u.nivelId, cargoId: u.cargoId, ativo: u.ativo });
  }

  function submit() {
    if (!draft) return;

    run(
      () =>
        saveUsuario({
          id: draft.id,
          nome: draft.nome,
          nivelId: draft.nivelId,
          cargoId: draft.cargoId,
          ativo: draft.ativo,
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

  const previewEmail = draft ? deriveEmail(draft.nome) : "";

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
          submitDisabled={!draft.nome.trim() || !previewEmail}
          busy={busy}
          error={error}
        >
          <Field
            label="Nome completo"
            value={draft.nome}
            onChange={(nome) => setDraft({ ...draft, nome })}
            placeholder="Ex.: Marcia Chaves de Aquino"
            autoFocus
          />
          {/* Email is derived from the name (DESIGN_SYSTEM §5) — confirmation, not a field. */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 12px",
              borderRadius: 10,
              background: "var(--s-sunken)",
              border: "1px dashed var(--s-border-2)",
              color: previewEmail ? "var(--s-t2)" : "var(--s-t3)",
              fontSize: 12.5,
              fontWeight: 600,
            }}
          >
            <AtSign size={14} style={{ flex: "none", color: "var(--s-t3)" }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {previewEmail || "O e-mail é gerado a partir do nome"}
            </span>
          </div>
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

function StatusToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div>
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
        Status
      </span>
      <div
        style={{
          display: "inline-flex",
          padding: 3,
          borderRadius: 10,
          background: "var(--s-sunken)",
          border: "1px solid var(--s-border)",
        }}
      >
        {[
          { label: "Ativo", val: true },
          { label: "Inativo", val: false },
        ].map((opt) => {
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
    </div>
  );
}
