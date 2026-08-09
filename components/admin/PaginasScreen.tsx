"use client";

import { useMemo, useState } from "react";
import { AdminScreen } from "./AdminScreen";
import { AdminModal } from "./AdminModal";
import { ConfirmDelete } from "./ConfirmDelete";
import { Field, Panel, RowActions } from "./primitives";
import { PAGE_ICONS, PageIcon } from "./icons";
import { useAdminAction } from "./useAdminAction";
import { textMatches } from "./filter";
import { DataTable, type Column } from "@/components/ui/data-table";
import { removePagina, savePagina } from "@/app/(app)/admin/actions";
import type { Pagina } from "@/lib/data/admin/types";

interface Draft {
  id?: number;
  nome: string;
  icone: string;
  rota: string;
}

export function PaginasScreen({ paginas }: { paginas: Pagina[] }) {
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [target, setTarget] = useState<Pagina | null>(null);
  const { busy, error, setError, run } = useAdminAction();

  const rows = useMemo(
    () => paginas.filter((p) => textMatches(query, p.nome, p.rota, p.icone)),
    [paginas, query],
  );

  const columns: Column<Pagina>[] = [
    {
      key: "nome",
      header: "Página",
      render: (p) => (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              display: "grid",
              placeItems: "center",
              width: 30,
              height: 30,
              borderRadius: 9,
              background: "var(--s-brand-weak)",
              color: "var(--s-brand)",
            }}
          >
            <PageIcon name={p.icone} size={16} />
          </span>
          <span style={{ fontWeight: 700, color: "var(--s-t1)" }}>{p.nome}</span>
        </span>
      ),
    },
    {
      key: "rota",
      header: "Rota",
      render: (p) => <span style={{ color: "var(--s-t3)", fontWeight: 600 }}>{p.rota ?? "—"}</span>,
    },
    {
      key: "caps",
      header: "Permissões",
      numeric: true,
      render: (p) => p.capCount,
    },
    {
      key: "acoes",
      header: "",
      align: "right",
      render: (p) => <RowActions onEdit={() => openEdit(p)} onDelete={() => setTarget(p)} />,
    },
  ];

  function openNew() {
    setError(null);
    setDraft({ nome: "", icone: PAGE_ICONS[0].key, rota: "" });
  }

  function openEdit(p: Pagina) {
    setError(null);
    setDraft({ id: p.id, nome: p.nome, icone: p.icone ?? PAGE_ICONS[0].key, rota: p.rota ?? "" });
  }

  function submit() {
    if (!draft) return;

    run(
      () => savePagina({ id: draft.id, nome: draft.nome, icone: draft.icone, rota: draft.rota }),
      () => setDraft(null),
    );
  }

  function confirmDelete() {
    if (!target) return;

    run(
      () => removePagina(target.id),
      () => setTarget(null),
    );
  }

  return (
    <AdminScreen
      title="Páginas"
      subtitle="As telas que compõem o dashboard"
      search={{ value: query, onChange: setQuery, placeholder: "Buscar página…" }}
      action={{ label: "Nova página", onClick: openNew }}
    >
      <Panel>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(p) => String(p.id)}
          minWidth={560}
          empty={{
            title: "Nenhuma página",
            hint: "Cadastre as telas do dashboard para dar permissões a elas.",
          }}
        />
      </Panel>

      {draft && (
        <AdminModal
          open
          onClose={() => setDraft(null)}
          eyebrow={draft.id ? "Editar página" : "Nova página"}
          title={draft.id ? "Editar página" : "Nova página"}
          onSubmit={submit}
          submitLabel={draft.id ? "Salvar" : "Criar página"}
          submitDisabled={!draft.nome.trim()}
          busy={busy}
          error={error}
        >
          <Field
            label="Nome"
            value={draft.nome}
            onChange={(nome) => setDraft({ ...draft, nome })}
            placeholder="Ex.: Performance Cidades"
            autoFocus
          />
          <Field
            label="Rota"
            value={draft.rota}
            onChange={(rota) => setDraft({ ...draft, rota })}
            placeholder="Ex.: /dashboard"
            mono
          />
          <IconPicker value={draft.icone} onChange={(icone) => setDraft({ ...draft, icone })} />
        </AdminModal>
      )}

      {target && (
        <ConfirmDelete
          open
          onClose={() => setTarget(null)}
          onConfirm={confirmDelete}
          question="Excluir esta página?"
          recordName={target.nome}
          busy={busy}
        />
      )}
    </AdminScreen>
  );
}

function IconPicker({ value, onChange }: { value: string; onChange: (key: string) => void }) {
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
        Ícone
      </span>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(40px, 1fr))", gap: 6 }}>
        {PAGE_ICONS.map(({ key, Icon }) => {
          const active = key === value;

          return (
            <button
              key={key}
              type="button"
              title={key}
              onClick={() => onChange(key)}
              className="bd-ghost"
              style={{
                display: "grid",
                placeItems: "center",
                height: 40,
                borderRadius: 10,
                border: `1px solid ${active ? "var(--s-brand)" : "var(--s-border)"}`,
                background: active ? "var(--s-brand-weak)" : "var(--s-sunken)",
                color: active ? "var(--s-brand)" : "var(--s-t2)",
                cursor: "pointer",
              }}
            >
              <Icon size={17} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
