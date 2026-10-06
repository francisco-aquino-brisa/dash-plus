"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, Pencil, Trash2 } from "lucide-react";
import { AdminModal } from "./AdminModal";
import { AddBtn } from "./IndicadorCalcBuilder";
import { ConfirmDelete } from "./ConfirmDelete";
import { Field } from "./primitives";
import { SelectMenu } from "./SelectMenu";
import { useAdminAction } from "./useAdminAction";
import {
  adicionarPaginaIndicador,
  removerPaginaIndicador,
  salvarPaginaIndicador,
} from "@/app/(app)/admin/indicadores/actions";
import { blocoLabel, CATALOG_PAGES } from "@/lib/data/indicators/pages";
import type { PaginaCatalogo, PaginaIndicador } from "@/lib/data/indicators/types";

const PADRAO_OPTS = [
  { value: "sim", label: "Sim — já vem marcado no primeiro acesso" },
  { value: "nao", label: "Não — o usuário adiciona pelo seletor" },
];

/** "Onde aparece": the page blocks that show this serviço as a card. */
export function IndicadorPaginas({
  servicoId,
  servicoNome,
  paginas,
  catalogo,
  semEspecificacao,
}: {
  servicoId: string;
  servicoNome: string;
  paginas: PaginaIndicador[];
  catalogo: PaginaCatalogo[];
  semEspecificacao: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<PaginaIndicador | null>(null);
  const [removing, setRemoving] = useState<PaginaIndicador | null>(null);
  const { busy, error, run } = useAdminAction();
  const router = useRouter();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: ".06em",
            textTransform: "uppercase",
            color: "var(--s-t3)",
          }}
        >
          Onde aparece
        </span>
        <span style={{ flex: 1 }} />
        {catalogo.length > 0 && <AddBtn onClick={() => setAdding(true)}>Adicionar a uma tela</AddBtn>}
      </div>

      {semEspecificacao && paginas.length > 0 && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--s-warn)" }}>
          Sem especificação de cálculo válida, este serviço fica oculto nas telas.
        </p>
      )}

      {paginas.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: "var(--s-t3)", fontStyle: "italic" }}>
          Não aparece em nenhuma tela.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {paginas.map((p) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid var(--s-border)",
                background: "var(--s-sunken)",
                fontSize: 12.5,
              }}
            >
              <LayoutGrid size={14} style={{ color: "var(--s-t3)", flexShrink: 0 }} />
              <span style={{ fontWeight: 700, color: "var(--s-t1)" }}>
                {p.paginaNome} › {blocoLabel(p.rota, p.bloco)}
              </span>
              <span style={{ color: "var(--s-t3)" }}>
                ordem {p.ordem}
                {p.padrao ? " · marcado por padrão" : ""}
              </span>
              <span style={{ flex: 1 }} />
              <IconBtn label="Editar" onClick={() => setEditing(p)}>
                <Pencil size={14} />
              </IconBtn>
              <IconBtn label="Remover da tela" onClick={() => setRemoving(p)} danger>
                <Trash2 size={14} />
              </IconBtn>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <AdicionarModal
          servicoId={servicoId}
          servicoNome={servicoNome}
          catalogo={catalogo}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            router.refresh();
          }}
        />
      )}

      {editing && (
        <EditarModal
          pagina={editing}
          servicoNome={servicoNome}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}

      {removing && (
        <ConfirmDelete
          open
          onClose={() => setRemoving(null)}
          onConfirm={() =>
            run(
              () => removerPaginaIndicador(removing.id),
              () => {
                setRemoving(null);
                router.refresh();
              },
            )
          }
          question="Remover o card desta tela?"
          recordName={`${servicoNome} — ${removing.paginaNome} › ${blocoLabel(removing.rota, removing.bloco)}`}
          busy={busy}
          error={error}
        />
      )}
    </div>
  );
}

function AdicionarModal({
  servicoId,
  servicoNome,
  catalogo,
  onClose,
  onSaved,
}: {
  servicoId: string;
  servicoNome: string;
  catalogo: PaginaCatalogo[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [paginaId, setPaginaId] = useState(catalogo.length === 1 ? String(catalogo[0].id) : "");
  const [bloco, setBloco] = useState("");
  const [ordem, setOrdem] = useState("10");
  const [padrao, setPadrao] = useState("nao");
  const { busy, error, run } = useAdminAction();

  const rota = catalogo.find((p) => String(p.id) === paginaId)?.rota;
  const blocos = CATALOG_PAGES.find((p) => p.rota === rota)?.blocos ?? [];

  return (
    <AdminModal
      open
      onClose={onClose}
      eyebrow={`${servicoId} · onde aparece`}
      title={`Adicionar "${servicoNome}" a uma tela`}
      onSubmit={() =>
        run(
          () =>
            adicionarPaginaIndicador({
              paginaId: Number(paginaId),
              bloco,
              servicoId,
              ordem: Number(ordem),
              padrao: padrao === "sim",
            }),
          onSaved,
        )
      }
      submitLabel="Adicionar"
      submitDisabled={!paginaId || !bloco || ordem.trim() === ""}
      busy={busy}
      error={error}
    >
      <SelectMenu
        label="Página"
        value={paginaId}
        options={catalogo.map((p) => ({ value: String(p.id), label: p.nome }))}
        onChange={(v) => {
          setPaginaId(v);
          setBloco("");
        }}
      />
      <SelectMenu
        label="Bloco"
        value={bloco}
        options={blocos.map((b) => ({ value: b.key, label: b.label }))}
        onChange={setBloco}
        disabled={!paginaId}
      />
      <Field
        label="Ordem"
        value={ordem}
        onChange={setOrdem}
        hint="Posição do card no bloco — menor aparece primeiro."
      />
      <SelectMenu label="Marcado por padrão" value={padrao} options={PADRAO_OPTS} onChange={setPadrao} />
    </AdminModal>
  );
}

function EditarModal({
  pagina,
  servicoNome,
  onClose,
  onSaved,
}: {
  pagina: PaginaIndicador;
  servicoNome: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [ordem, setOrdem] = useState(String(pagina.ordem));
  const [padrao, setPadrao] = useState(pagina.padrao ? "sim" : "nao");
  const { busy, error, run } = useAdminAction();

  return (
    <AdminModal
      open
      onClose={onClose}
      eyebrow={`${pagina.paginaNome} › ${blocoLabel(pagina.rota, pagina.bloco)}`}
      title={servicoNome}
      onSubmit={() => run(() => salvarPaginaIndicador(pagina.id, Number(ordem), padrao === "sim"), onSaved)}
      submitLabel="Salvar"
      submitDisabled={ordem.trim() === ""}
      busy={busy}
      error={error}
    >
      <Field
        label="Ordem"
        value={ordem}
        onChange={setOrdem}
        hint="Posição do card no bloco — menor aparece primeiro."
      />
      <SelectMenu label="Marcado por padrão" value={padrao} options={PADRAO_OPTS} onChange={setPadrao} />
    </AdminModal>
  );
}

function IconBtn({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="bd-ghost"
      onClick={onClick}
      title={label}
      aria-label={label}
      style={{
        display: "inline-grid",
        placeItems: "center",
        width: 28,
        height: 28,
        borderRadius: 8,
        border: "1px solid var(--s-border)",
        background: "var(--s-card)",
        color: danger ? "var(--s-bad)" : "var(--s-t2)",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
