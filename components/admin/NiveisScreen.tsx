"use client";

import { useMemo, useState } from "react";
import { AdminScreen } from "./AdminScreen";
import { AdminModal } from "./AdminModal";
import { ConfirmDelete } from "./ConfirmDelete";
import { Chip, Field, Panel, RowActions, TextAreaField } from "./primitives";
import { useAdminAction } from "./useAdminAction";
import { textMatches } from "./filter";
import { DataTable, type Column } from "@/components/ui/data-table";
import { BLUE_TONE, BRAND_TONE } from "@/lib/data/admin/derive";
import { removeNivel, saveNivel } from "@/app/(app)/admin/actions";
import type { Nivel } from "@/lib/data/admin/types";

interface Draft {
  id?: number;
  nome: string;
  descricao: string;
}

export function NiveisScreen({ niveis, totalCaps }: { niveis: Nivel[]; totalCaps: number }) {
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [target, setTarget] = useState<Nivel | null>(null);
  const { busy, error, setError, run } = useAdminAction();

  const rows = useMemo(() => niveis.filter((n) => textMatches(query, n.nome, n.descricao)), [niveis, query]);

  const columns: Column<Nivel>[] = [
    {
      key: "nome",
      header: "Nível",
      render: (n) => <Chip tone={n.locked ? BLUE_TONE : BRAND_TONE}>{n.nome}</Chip>,
    },
    {
      key: "descricao",
      header: "Descrição",
      render: (n) => <span style={{ color: "var(--s-t2)", fontWeight: 600 }}>{n.descricao ?? "—"}</span>,
    },
    {
      key: "caps",
      header: "Permissões",
      render: (n) => (
        <span style={{ color: "var(--s-t3)", fontWeight: 700 }}>
          {n.capCount} de {totalCaps}
        </span>
      ),
    },
    {
      key: "acoes",
      header: "",
      align: "right",
      render: (n) => (
        <RowActions locked={n.locked} onEdit={() => openEdit(n)} onDelete={() => setTarget(n)} />
      ),
    },
  ];

  function openNew() {
    setError(null);
    setDraft({ nome: "", descricao: "" });
  }

  function openEdit(n: Nivel) {
    setError(null);
    setDraft({ id: n.id, nome: n.nome, descricao: n.descricao ?? "" });
  }

  function submit() {
    if (!draft) return;

    run(
      () => saveNivel({ id: draft.id, nome: draft.nome, descricao: draft.descricao }),
      () => setDraft(null),
    );
  }

  function confirmDelete() {
    if (!target) return;

    run(
      () => removeNivel(target.id),
      () => setTarget(null),
    );
  }

  return (
    <AdminScreen
      title="Níveis de acesso"
      subtitle="Defina os níveis e o que cada um enxerga"
      search={{ value: query, onChange: setQuery, placeholder: "Buscar nível…" }}
      action={{ label: "Novo nível", onClick: openNew }}
    >
      <Panel>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(n) => String(n.id)}
          minWidth={560}
          empty={{ title: "Nenhum nível", hint: "Crie o primeiro nível de acesso para começar." }}
        />
      </Panel>

      {draft && (
        <AdminModal
          open
          onClose={() => setDraft(null)}
          eyebrow={draft.id ? "Editar nível" : "Novo nível"}
          title={draft.id ? "Editar nível de acesso" : "Novo nível de acesso"}
          onSubmit={submit}
          submitLabel={draft.id ? "Salvar" : "Criar nível"}
          submitDisabled={!draft.nome.trim()}
          busy={busy}
          error={error}
        >
          <Field
            label="Nome"
            value={draft.nome}
            onChange={(nome) => setDraft({ ...draft, nome })}
            placeholder="Ex.: Supervisor"
            autoFocus
          />
          <TextAreaField
            label="Descrição"
            value={draft.descricao}
            onChange={(descricao) => setDraft({ ...draft, descricao })}
            placeholder="O que este nível pode acessar"
          />
        </AdminModal>
      )}

      {target && (
        <ConfirmDelete
          open
          onClose={() => setTarget(null)}
          onConfirm={confirmDelete}
          question="Excluir este nível?"
          recordName={target.nome}
          busy={busy}
        />
      )}
    </AdminScreen>
  );
}
