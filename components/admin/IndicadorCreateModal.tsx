"use client";

import { useState } from "react";
import { AdminModal } from "./AdminModal";
import { AddBtn, RemoveBtn } from "./IndicadorCalcBuilder";
import { Field } from "./primitives";
import { SelectMenu } from "./SelectMenu";
import { ServicoFieldsForm } from "./ServicoFieldsForm";
import { useAdminAction } from "./useAdminAction";
import { criarIndicador } from "@/app/(app)/admin/indicadores/actions";
import { CATEGORY_META } from "@/lib/data/indicators/ui";
import { emptyServicoDraft, type ServicoDraft } from "@/lib/data/indicators/types";

const STATUS_OPTS = [
  { value: "Ativo", label: "Ativo" },
  { value: "Inativo", label: "Inativo" },
];
const CATEGORIA_OPTS = CATEGORY_META.map((c) => ({ value: c.key, label: c.label }));

/** Creates an indicador geral together with its first serviço(s) — an indicador with zero serviços isn't addressable anywhere else. */
export function IndicadorCreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [id, setId] = useState("");
  const [categoria, setCategoria] = useState(CATEGORY_META[0].key);
  const [nome, setNome] = useState("");
  const [status, setStatus] = useState("Ativo");
  const [servicos, setServicos] = useState<ServicoDraft[]>([emptyServicoDraft()]);
  const { busy, error, run } = useAdminAction();

  const addServico = () => setServicos((prev) => [...prev, emptyServicoDraft()]);
  const removeServico = (i: number) => setServicos((prev) => prev.filter((_, idx) => idx !== i));
  const updateServico = (i: number, d: ServicoDraft) =>
    setServicos((prev) => prev.map((s, idx) => (idx === i ? d : s)));

  function submit() {
    run(() => criarIndicador({ id: id.trim(), categoria, nome: nome.trim(), status, servicos }), onCreated);
  }

  return (
    <AdminModal
      open
      onClose={onClose}
      eyebrow="Novo indicador"
      title="Novo indicador"
      onSubmit={submit}
      submitLabel="Criar indicador"
      submitDisabled={!id.trim() || !nome.trim() || servicos.length === 0}
      busy={busy}
      error={error}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Código" value={id} onChange={setId} placeholder="ex.: BA14" mono autoFocus />
        <SelectMenu label="Categoria" value={categoria} options={CATEGORIA_OPTS} onChange={setCategoria} />
      </div>
      <Field label="Nome" value={nome} onChange={setNome} placeholder="ex.: Nova métrica de base" />
      <SelectMenu label="Status" value={status} options={STATUS_OPTS} onChange={setStatus} />

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "var(--s-t1)" }}>
            Serviços <span style={{ color: "var(--s-bad)" }}>*</span>
          </span>
          <span style={{ flex: 1 }} />
          <AddBtn onClick={addServico}>Serviço</AddBtn>
        </div>

        {servicos.map((s, i) => (
          <div
            key={i}
            style={{
              border: "1px solid var(--s-border)",
              borderRadius: 10,
              padding: 12,
              background: "var(--s-sunken)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {servicos.length > 1 && (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <RemoveBtn onClick={() => removeServico(i)} label="Remover serviço" />
              </div>
            )}
            <ServicoFieldsForm draft={s} onChange={(next) => updateServico(i, next)} />
          </div>
        ))}
      </div>
    </AdminModal>
  );
}
