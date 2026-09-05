"use client";

import { useState } from "react";
import { AdminModal } from "./AdminModal";
import { ServicoFieldsForm } from "./ServicoFieldsForm";
import { useAdminAction } from "./useAdminAction";
import { adicionarServico, salvarServico } from "@/app/(app)/admin/indicadores/actions";
import {
  emptyServicoDraft,
  servicoDraftFrom,
  type IndicadorServico,
  type ServicoDraft,
} from "@/lib/data/indicators/types";

/** Add a new serviço to an indicador, or edit an existing one — same fields, `id` locks once it exists. */
export function ServicoFormModal({
  idIndicadorGeral,
  categoria,
  indicadorGeral,
  existing,
  onClose,
  onSaved,
}: {
  idIndicadorGeral: string;
  categoria: string;
  indicadorGeral: string;
  /** Present when editing; absent when adding a new serviço. */
  existing?: IndicadorServico;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<ServicoDraft>(() =>
    existing ? servicoDraftFrom(existing) : emptyServicoDraft(),
  );
  const { busy, error, run } = useAdminAction();

  function submit() {
    run(
      () =>
        existing
          ? salvarServico(idIndicadorGeral, categoria, indicadorGeral, draft)
          : adicionarServico(idIndicadorGeral, categoria, indicadorGeral, draft),
      onSaved,
    );
  }

  return (
    <AdminModal
      open
      onClose={onClose}
      eyebrow={existing ? "Editar serviço" : "Adicionar serviço"}
      title={existing ? existing.indicadorServico || existing.servico : "Novo serviço"}
      onSubmit={submit}
      submitLabel={existing ? "Salvar" : "Adicionar serviço"}
      submitDisabled={!draft.id.trim() || !draft.servico.trim() || !draft.indicadorServico.trim()}
      busy={busy}
      error={error}
    >
      <ServicoFieldsForm draft={draft} onChange={setDraft} idEditable={!existing} />
    </AdminModal>
  );
}
