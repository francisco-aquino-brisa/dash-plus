"use client";

import { useMemo, useState } from "react";
import { AdminScreen } from "./AdminScreen";
import { AdminModal } from "./AdminModal";
import { ConfirmDelete } from "./ConfirmDelete";
import { AdminSelect } from "./AdminSelect";
import { Chip, Field, Panel, RowActions, TextAreaField } from "./primitives";
import { PageIcon } from "./icons";
import { useAdminAction } from "./useAdminAction";
import { textMatches } from "./filter";
import { DataTable, type Column } from "@/components/ui/data-table";
import { normalizeCapabilityLabelInput } from "@/lib/data/admin/derive";
import { removeCapacidade, saveCapacidade } from "@/app/(app)/admin/actions";
import type { Capacidade, Pagina } from "@/lib/data/admin/types";

interface Draft {
  id?: number;
  label: string;
  descricao: string;
  paginaId: number | null;
}

export function CapacidadesScreen({
  capacidades,
  paginas,
}: {
  capacidades: Capacidade[];
  paginas: Pagina[];
}) {
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [target, setTarget] = useState<Capacidade | null>(null);
  const { busy, error, setError, run } = useAdminAction();

  const rows = useMemo(
    () => capacidades.filter((c) => textMatches(query, c.label, c.descricao, c.paginaNome)),
    [capacidades, query],
  );

  const pageOptions = paginas.map((p) => ({ id: p.id, label: p.nome, hint: p.rota ?? undefined }));
  const iconByPage = new Map(paginas.map((p) => [p.id, p.icone]));

  const columns: Column<Capacidade>[] = [
    {
      key: "label",
      header: "Capacidade",
      render: (c) => (
        <span
          style={{
            fontFamily: "var(--font-mono, ui-monospace, monospace)",
            fontWeight: 700,
            color: "var(--s-t1)",
          }}
        >
          {c.label}
        </span>
      ),
    },
    {
      key: "descricao",
      header: "Descrição",
      render: (c) => <span style={{ color: "var(--s-t2)", fontWeight: 600 }}>{c.descricao ?? "—"}</span>,
    },
    {
      key: "pagina",
      header: "Página",
      render: (c) =>
        c.paginaNome ? (
          <Chip tone={{ fg: "var(--s-t2)", bg: "var(--s-sunken)" }}>
            <PageIcon name={iconByPage.get(c.paginaId ?? -1) ?? null} size={13} />
            {c.paginaNome}
          </Chip>
        ) : (
          <span style={{ color: "var(--s-t3)" }}>—</span>
        ),
    },
    {
      key: "acoes",
      header: "",
      align: "right",
      render: (c) => <RowActions onEdit={() => openEdit(c)} onDelete={() => setTarget(c)} />,
    },
  ];

  function openNew() {
    setError(null);
    setDraft({ label: "", descricao: "", paginaId: paginas[0]?.id ?? null });
  }

  function openEdit(c: Capacidade) {
    setError(null);
    setDraft({ id: c.id, label: c.label, descricao: c.descricao ?? "", paginaId: c.paginaId });
  }

  function submit() {
    if (!draft) return;

    run(
      () =>
        saveCapacidade({
          id: draft.id,
          label: draft.label,
          descricao: draft.descricao,
          paginaId: draft.paginaId,
        }),
      () => setDraft(null),
    );
  }

  function confirmDelete() {
    if (!target) return;

    run(
      () => removeCapacidade(target.id),
      () => setTarget(null),
    );
  }

  return (
    <AdminScreen
      title="Capacidades"
      subtitle="Ações permitidas dentro de cada página"
      search={{ value: query, onChange: setQuery, placeholder: "Buscar capacidade…" }}
      action={{ label: "Nova capacidade", onClick: openNew }}
    >
      <Panel>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(c) => String(c.id)}
          minWidth={640}
          empty={{ title: "Nenhuma capacidade", hint: "Crie capacidades e associe cada uma a uma página." }}
        />
      </Panel>

      {draft && (
        <AdminModal
          open
          onClose={() => setDraft(null)}
          eyebrow={draft.id ? "Editar capacidade" : "Nova capacidade"}
          title={draft.id ? "Editar capacidade" : "Nova capacidade"}
          onSubmit={submit}
          submitLabel={draft.id ? "Salvar" : "Criar capacidade"}
          submitDisabled={!draft.label.trim()}
          busy={busy}
          error={error}
        >
          <Field
            label="Identificador"
            value={draft.label}
            onChange={(label) => setDraft({ ...draft, label: normalizeCapabilityLabelInput(label) })}
            placeholder="ex.: ver_todas_gerencias"
            hint="Normalizado automaticamente: minúsculo, sem acento, com _."
            mono
            autoFocus
          />
          <TextAreaField
            label="Descrição"
            value={draft.descricao}
            onChange={(descricao) => setDraft({ ...draft, descricao })}
            placeholder="O que esta capacidade libera"
          />
          <AdminSelect
            label="Página"
            value={draft.paginaId}
            options={pageOptions}
            onChange={(paginaId) => setDraft({ ...draft, paginaId })}
            placeholder="Selecionar página…"
            noneLabel="Sem página"
          />
        </AdminModal>
      )}

      {target && (
        <ConfirmDelete
          open
          onClose={() => setTarget(null)}
          onConfirm={confirmDelete}
          question="Excluir esta capacidade?"
          recordName={target.label}
          busy={busy}
        />
      )}
    </AdminScreen>
  );
}
