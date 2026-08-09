"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Info, Loader2 } from "lucide-react";
import { AdminScreen } from "./AdminScreen";
import { Panel } from "./primitives";
import { PageIcon } from "./icons";
import { textMatches } from "./filter";
import { useSetNavPending } from "@/lib/ui/nav-pending";
import { isAdminNivel } from "@/lib/data/admin/derive";
import { togglePerm } from "@/app/(app)/admin/actions";
import { permKey, type Capacidade, type Nivel, type Pagina } from "@/lib/data/admin/types";

/**
 * Capacidades por nível (SCREENS §6): level chips on top, a live counter, and one
 * card per página with a checkbox per capability. The `admin` level is fully
 * granted and locked, shown with a blue notice (DESIGN_SYSTEM §5). Each toggle
 * disables its own checkbox (spinner) until the server answers, then commits the
 * new state on success or leaves it unchanged on failure — no double-fire.
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
  // Keys whose grant/revoke request is in flight — the checkbox is disabled and
  // shows a spinner until the server answers, so a double-click can't fire twice.
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const setNavPending = useSetNavPending();

  // Re-seed from the server whenever the granted set changes underneath (e.g. after
  // "Atualizar" reloads the page).
  useEffect(() => {
    setGranted(new Set(perms));
  }, [perms]);

  // Light the shell loader while any toggle is in flight.
  useEffect(() => {
    setNavPending(pendingKeys.size > 0);
  }, [pendingKeys, setNavPending]);

  const active = niveis.find((n) => n.id === activeId) ?? null;
  const totalCaps = capacidades.length;
  // Only `admin` is locked IN THE MATRIX (all caps, non-editable). `vendedor` is
  // record-locked but its capabilities are editable here.
  const adminLocked = !!active && isAdminNivel(active.nome);

  const groups = useMemo(() => groupByPage(capacidades, paginas, query), [capacidades, paginas, query]);

  const activeGrantedCount = useMemo(() => {
    if (!active) return 0;

    if (isAdminNivel(active.nome)) return totalCaps;

    return capacidades.reduce((n, c) => n + (granted.has(permKey(active.id, c.id)) ? 1 : 0), 0);
  }, [active, capacidades, granted, totalCaps]);

  async function toggle(capId: number, next: boolean) {
    if (!active || adminLocked) return;

    const key = permKey(active.id, capId);

    // Ignore clicks while this checkbox's request is still open.
    if (pendingKeys.has(key)) return;

    setPendingKeys((prev) => new Set(prev).add(key));

    try {
      const res = await togglePerm(active.id, capId, next);

      // Commit the new state only on success; on failure the checkbox keeps its
      // previous state (there is no optimistic flip to undo).
      if (res.ok) {
        setGranted((prev) => {
          const n = new Set(prev);

          next ? n.add(key) : n.delete(key);

          return n;
        });
      }
    } catch {
      // network/unexpected error — leave the checkbox unchanged.
    } finally {
      setPendingKeys((prev) => {
        const n = new Set(prev);

        n.delete(key);

        return n;
      });
    }
  }

  return (
    <AdminScreen
      title="Permissões por nível"
      subtitle="Marque o que cada nível pode fazer"
      search={{ value: query, onChange: setQuery, placeholder: "Buscar permissão…" }}
    >
      {/* Level chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {niveis.map((n) => {
          const isActive = n.id === activeId;

          return (
            <button
              key={n.id}
              type="button"
              onClick={() => setActiveId(n.id)}
              style={{
                padding: "8px 16px",
                borderRadius: "var(--r-pill)",
                border: `1px solid ${isActive ? "var(--s-brand)" : "var(--s-border)"}`,
                background: "var(--s-card)",
                color: isActive ? "var(--s-brand)" : "var(--s-t2)",
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
            {activeGrantedCount} de {totalCaps} permissões ativas
          </span>
        </div>
      )}

      {adminLocked && (
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
            O nível Admin tem todas as permissões e não pode ser alterado.
          </span>
        </div>
      )}

      {groups.length === 0 ? (
        <Panel>
          <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--s-t3)", fontSize: 13 }}>
            {capacidades.length === 0
              ? "Cadastre páginas e permissões para montar a matriz."
              : "Nenhuma permissão encontrada para a busca."}
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
                  const key = active ? permKey(active.id, c.id) : "";
                  const busy = pendingKeys.has(key);
                  const on = adminLocked ? true : !!active && granted.has(key);
                  const disabled = adminLocked || busy;

                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={disabled}
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
                        cursor: adminLocked ? "not-allowed" : busy ? "wait" : "pointer",
                        opacity: busy ? 0.65 : 1,
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
                          border: `1px solid ${on || busy ? "var(--s-brand)" : "var(--s-border-2)"}`,
                          background: on && !busy ? "var(--s-brand)" : "transparent",
                          color: on && !busy ? "#fff" : "var(--s-brand)",
                        }}
                      >
                        {busy ? (
                          <Loader2 size={13} style={{ animation: "bdSpin .7s linear infinite" }} />
                        ) : (
                          on && <Check size={13} />
                        )}
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
