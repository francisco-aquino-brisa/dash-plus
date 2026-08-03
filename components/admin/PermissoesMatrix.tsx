"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Info } from "lucide-react";
import { AdminScreen } from "./AdminScreen";
import { Panel } from "./primitives";
import { PageIcon } from "./icons";
import { textMatches } from "./filter";
import { useSetNavPending } from "@/lib/ui/nav-pending";
import { nivelChipTone } from "@/lib/data/admin/derive";
import { togglePerm } from "@/app/(app)/admin/actions";
import { permKey, type Capacidade, type Nivel, type Pagina } from "@/lib/data/admin/types";

/**
 * Capacidades por nível (SCREENS §6): level chips on top, a live counter, and one
 * card per página with a checkbox per capability. The `admin` level is fully
 * granted and locked, shown with a blue notice (DESIGN_SYSTEM §5). Toggles are
 * optimistic and revert if the server action fails.
 */
export function PermissoesMatrix({
  niveis,
  paginas,
  capacidades,
  perms,
}: {
  niveis: Nivel[];
  paginas: Pagina[];
  capacidades: Capacidade[];
  perms: string[];
}) {
  const [activeId, setActiveId] = useState<number | null>(niveis[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [granted, setGranted] = useState<Set<string>>(() => new Set(perms));
  const setPending = useSetNavPending();

  // Re-seed from the server whenever the granted set changes underneath (e.g. after
  // "Atualizar" reloads the page).
  useEffect(() => {
    setGranted(new Set(perms));
  }, [perms]);

  const active = niveis.find((n) => n.id === activeId) ?? null;
  const totalCaps = capacidades.length;

  const groups = useMemo(() => groupByPage(capacidades, paginas, query), [capacidades, paginas, query]);

  const activeGrantedCount = useMemo(() => {
    if (!active) return 0;

    if (active.locked) return totalCaps;

    return capacidades.reduce((n, c) => n + (granted.has(permKey(active.id, c.id)) ? 1 : 0), 0);
  }, [active, capacidades, granted, totalCaps]);

  async function toggle(capId: number, next: boolean) {
    if (!active || active.locked) return;

    const key = permKey(active.id, capId);

    setGranted((prev) => {
      const n = new Set(prev);

      next ? n.add(key) : n.delete(key);

      return n;
    });
    setPending(true);

    try {
      const res = await togglePerm(active.id, capId, next);

      if (!res.ok) {
        setGranted((prev) => {
          const n = new Set(prev);

          next ? n.delete(key) : n.add(key);

          return n;
        });
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <AdminScreen
      title="Capacidades por nível"
      subtitle="Marque o que cada nível pode fazer"
      search={{ value: query, onChange: setQuery, placeholder: "Buscar capacidade…" }}
    >
      {/* Level chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {niveis.map((n) => {
          const isActive = n.id === activeId;
          const tone = nivelChipTone(n.nome);

          return (
            <button
              key={n.id}
              type="button"
              onClick={() => setActiveId(n.id)}
              style={{
                padding: "8px 16px",
                borderRadius: "var(--r-pill)",
                border: `1px solid ${isActive ? "var(--s-brand)" : "var(--s-border)"}`,
                background: isActive ? tone.bg : "var(--s-card)",
                color: isActive ? tone.fg : "var(--s-t2)",
                font: "inherit",
                fontSize: 12.5,
                fontWeight: 800,
                cursor: "pointer",
                transition: ".16s",
              }}
            >
              {n.nome}
            </button>
          );
        })}
      </div>

      {active && (
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span className="font-display" style={{ fontSize: 18, fontWeight: 800, color: "var(--s-t1)" }}>
            {active.nome}
          </span>
          <span style={{ fontSize: 12.5, color: "var(--s-t3)", fontWeight: 700 }}>
            {activeGrantedCount} de {totalCaps} capacidades ativas
          </span>
        </div>
      )}

      {active?.locked && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            padding: "12px 14px",
            borderRadius: 12,
            background: "var(--s-blue-bg)",
            border: "1px solid var(--s-blue)",
            color: "var(--s-blue)",
          }}
        >
          <Info size={16} style={{ flex: "none", marginTop: 1 }} />
          <span style={{ fontSize: 12.5, fontWeight: 700 }}>
            O nível Admin tem todas as capacidades e não pode ser alterado.
          </span>
        </div>
      )}

      {groups.length === 0 ? (
        <Panel>
          <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--s-t3)", fontSize: 13 }}>
            {capacidades.length === 0
              ? "Cadastre páginas e capacidades para montar a matriz."
              : "Nenhuma capacidade encontrada para a busca."}
          </div>
        </Panel>
      ) : (
        <div
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}
        >
          {groups.map((g) => (
            <Panel key={g.key} style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
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
                  <PageIcon name={g.icone} size={16} />
                </span>
                <span
                  className="font-display"
                  style={{ fontSize: 15, fontWeight: 800, color: "var(--s-t1)" }}
                >
                  {g.nome}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {g.caps.map((c) => {
                  const on = active?.locked ? true : !!active && granted.has(permKey(active.id, c.id));

                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={active?.locked}
                      onClick={() => toggle(c.id, !on)}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 12px",
                        borderRadius: 11,
                        border: `1px solid ${on ? "var(--s-brand-line)" : "var(--s-border)"}`,
                        background: on ? "var(--s-brand-weak)" : "var(--s-sunken)",
                        font: "inherit",
                        cursor: active?.locked ? "not-allowed" : "pointer",
                        transition: ".16s",
                      }}
                    >
                      <span
                        style={{
                          flex: "none",
                          display: "grid",
                          placeItems: "center",
                          width: 20,
                          height: 20,
                          marginTop: 1,
                          borderRadius: 6,
                          border: `1px solid ${on ? "var(--s-brand)" : "var(--s-border-2)"}`,
                          background: on ? "var(--s-brand)" : "transparent",
                          color: "#fff",
                        }}
                      >
                        {on && <Check size={13} />}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span
                          style={{
                            display: "block",
                            fontFamily: "var(--font-mono, ui-monospace, monospace)",
                            fontSize: 12.5,
                            fontWeight: 800,
                            color: on ? "var(--s-brand)" : "var(--s-t1)",
                          }}
                        >
                          {c.label}
                        </span>
                        {c.descricao && (
                          <span
                            style={{ display: "block", fontSize: 11.5, color: "var(--s-t3)", marginTop: 1 }}
                          >
                            {c.descricao}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Panel>
          ))}
        </div>
      )}
    </AdminScreen>
  );
}

interface Group {
  key: string;
  nome: string;
  icone: string | null;
  caps: Capacidade[];
}

function groupByPage(capacidades: Capacidade[], paginas: Pagina[], query: string): Group[] {
  const filtered = capacidades.filter((c) => textMatches(query, c.label, c.descricao));
  const groups: Group[] = [];
  const indexByKey = new Map<string, number>();

  for (const p of paginas) {
    indexByKey.set(`p${p.id}`, groups.length);
    groups.push({ key: `p${p.id}`, nome: p.nome, icone: p.icone, caps: [] });
  }

  const orphanKey = "none";

  for (const c of filtered) {
    const key = c.paginaId != null && indexByKey.has(`p${c.paginaId}`) ? `p${c.paginaId}` : orphanKey;

    if (key === orphanKey && !indexByKey.has(orphanKey)) {
      indexByKey.set(orphanKey, groups.length);
      groups.push({ key: orphanKey, nome: "Sem página", icone: null, caps: [] });
    }

    groups[indexByKey.get(key)!].caps.push(c);
  }

  return groups.filter((g) => g.caps.length > 0);
}
