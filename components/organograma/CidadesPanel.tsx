"use client";

import { useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { SearchInput } from "@/components/admin/primitives";
import { textMatches } from "@/components/admin/filter";
import { nivelRhLabel } from "@/lib/data/admin/derive";
import { usePermissions } from "@/lib/auth/client";
import type { OrgChartResult, OrgCidade, OrgTreeNode } from "@/lib/data/organograma/types";

interface Linha {
  path: string;
  nivel: string;
  nome: string;
  responsavel: string;
  /** How deep in the drawn tree, for the indent. Ancestors are always 0. */
  nivelIndent: number;
  cidades: OrgCidade[];
}

/**
 * The city side of the same structure the chart draws: one row per node that
 * holds cities, in the order the tree reads. A node with none is left out —
 * the great majority of the tree (lideranças, gerências) can never hold any.
 */
export function CidadesPanel({ chart }: { chart: OrgChartResult }) {
  const [query, setQuery] = useState("");
  const { isAdmin } = usePermissions();

  const linhas = useMemo(() => achatar(chart), [chart]);
  const visiveis = linhas.filter(
    (l) => textMatches(query, l.nome, l.responsavel) || l.cidades.some((c) => textMatches(query, c.nome)),
  );
  const total = new Set(linhas.flatMap((l) => l.cidades.map((c) => c.id))).size;

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "clamp(14px, 3vw, 24px)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "var(--s-t2)" }}>
            <strong>{total}</strong> cidade(s) na sua estrutura
          </span>
          <div style={{ flex: 1, minWidth: 220 }}>
            <SearchInput value={query} onChange={setQuery} placeholder="Buscar cidade ou responsável…" />
          </div>
        </div>

        {visiveis.length === 0 ? (
          <p style={{ margin: 0, padding: "28px 4px", fontSize: 13, color: "var(--s-t3)" }}>
            {linhas.length > 0
              ? "Nada encontrado para essa busca."
              : isAdmin
                ? "Nenhuma cidade atribuída a esta estrutura. O vínculo é feito em Administração › Cidades por estrutura."
                : "Nenhuma cidade atribuída à sua estrutura."}
          </p>
        ) : (
          visiveis.map((linha) => (
            <div
              key={linha.path}
              style={{
                marginLeft: linha.nivelIndent * 16,
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid var(--s-border)",
                background: "var(--s-card)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: "var(--s-t1)" }}>{linha.nome}</span>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: ".06em",
                    textTransform: "uppercase",
                    color: "var(--s-brand)",
                  }}
                >
                  {linha.nivel}
                </span>
                <span style={{ fontSize: 11.5, color: "var(--s-t3)" }}>
                  {linha.responsavel} · {linha.cidades.length} cidade(s)
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {linha.cidades.map((cidade) => (
                  <span
                    key={cidade.id}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "4px 9px",
                      borderRadius: 999,
                      background: "var(--s-sunken)",
                      color: "var(--s-t2)",
                      fontSize: 11.5,
                      fontWeight: 600,
                    }}
                  >
                    <MapPin size={11} style={{ color: "var(--s-t3)" }} />
                    {cidade.nome}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function achatar(chart: OrgChartResult): Linha[] {
  const linhas: Linha[] = [];

  const push = (path: string, nivel: string, nome: string, responsavel: string, nivelIndent: number) => {
    const cidades = chart.cidades[path];

    if (cidades?.length) linhas.push({ path, nivel, nome, responsavel, nivelIndent, cidades });
  };

  // Root first: the chain comes in with the immediate manager leading.
  for (const ancestor of [...chart.ancestors].reverse()) {
    push(ancestor.path, nivelRhLabel(ancestor.nivel), ancestor.nome, ancestor.responsavelNome, 0);
  }

  const walk = (node: OrgTreeNode, depth: number) => {
    push(node.path, nivelRhLabel(node.nivel), node.nome, node.responsavelNome, depth);
    node.children.forEach((child) => walk(child, depth + 1));
  };

  chart.subtrees.forEach((tree) => walk(tree, 1));

  return linhas;
}
