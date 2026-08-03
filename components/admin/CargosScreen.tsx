"use client";

import { useMemo, useState } from "react";
import { AdminScreen } from "./AdminScreen";
import { AdminModal } from "./AdminModal";
import { ConfirmDelete } from "./ConfirmDelete";
import { Field, Panel, RowActions, TextAreaField } from "./primitives";
import { useAdminAction } from "./useAdminAction";
import { textMatches } from "./filter";
import { DataTable, type Column } from "@/components/ui/data-table";
import { removeCargo, saveCargo } from "@/app/(app)/admin/actions";
import type { Cargo } from "@/lib/data/admin/types";

interface Draft {
  id?: number;
  nome: string;
  descricao: string;
}

export function CargosScreen({ cargos }: { cargos: Cargo[] }) {
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [target, setTarget] = useState<Cargo | null>(null);
  const { busy, error, setError, run } = useAdminAction();

  const rows = useMemo(() => cargos.filter((c) => textMatches(query, c.nome, c.descricao)), [cargos, query]);

  const columns: Column<Cargo>[] = [
    {
      key: "nome",
      header: "Cargo",
      render: (c) => <span style={{ fontWeight: 700, color: "var(--s-t1)" }}>{c.nome}</span>,
    },
    {
      key: "pessoas",
      header: "Pessoas",
      numeric: true,
      render: (c) => c.pessoas,
    },
    {
      key: "acoes",
      header: "",
      align: "right",
      render: (c) => (
        <RowActions locked={c.locked} onEdit={() => openEdit(c)} onDelete={() => setTarget(c)} />
      ),
    },
  ];

  function openNew() {
    setError(null);
    setDraft({ nome: "", descricao: "" });
  }

  function openEdit(c: Cargo) {
    setError(null);
    setDraft({ id: c.id, nome: c.nome, descricao: c.descricao ?? "" });
  }

  function submit() {
    if (!draft) return;

    run(
      () => saveCargo({ id: draft.id, nome: draft.nome, descricao: draft.descricao }),
      () => setDraft(null),
    );
  }

  function confirmDelete() {
    if (!target) return;

    run(
      () => removeCargo(target.id),
      () => setTarget(null),
    );
  }

  return (
    <AdminScreen
      title="Cargos"
      subtitle="Funções que descrevem a pessoa na operação"
      search={{ value: query, onChange: setQuery, placeholder: "Buscar cargo…" }}
      action={{ label: "Novo cargo", onClick: openNew }}
    >
      <Panel>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(c) => String(c.id)}
          minWidth={480}
          empty={{ title: "Nenhum cargo", hint: "Crie o primeiro cargo para vincular às pessoas." }}
        />
      </Panel>

      {draft && (
        <AdminModal
          open
          onClose={() => setDraft(null)}
          eyebrow={draft.id ? "Editar cargo" : "Novo cargo"}
          title={draft.id ? "Editar cargo" : "Novo cargo"}
          onSubmit={submit}
          submitLabel={draft.id ? "Salvar" : "Criar cargo"}
          submitDisabled={!draft.nome.trim()}
          busy={busy}
          error={error}
        >
          <Field
            label="Nome"
            value={draft.nome}
            onChange={(nome) => setDraft({ ...draft, nome })}
            placeholder="Ex.: Gerente comercial"
            autoFocus
          />
          <TextAreaField
            label="Descrição"
            value={draft.descricao}
            onChange={(descricao) => setDraft({ ...draft, descricao })}
            placeholder="O que a pessoa neste cargo faz"
          />
        </AdminModal>
      )}

      {target && (
        <ConfirmDelete
          open
          onClose={() => setTarget(null)}
          onConfirm={confirmDelete}
          question="Excluir este cargo?"
          recordName={target.nome}
          busy={busy}
        />
      )}
    </AdminScreen>
  );
}
