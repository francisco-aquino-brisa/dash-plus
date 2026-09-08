import { Database } from "lucide-react";

/**
 * Shown when the module cannot reach its source. The HC Zerado screens are a
 * port of an app that only ever read the real table, so there is no mock to fall
 * back to — saying so is better than inventing headcount.
 */
export function HcSemFonte({ motivo }: { motivo: string }) {
  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        gap: 10,
        padding: "56px 20px",
        border: "1px dashed var(--s-border-2)",
        borderRadius: 14,
        background: "var(--s-card)",
        textAlign: "center",
      }}
    >
      <Database size={22} style={{ color: "var(--s-t3)" }} />
      <h2 className="font-display" style={{ fontSize: 15, fontWeight: 800, color: "var(--s-t1)" }}>
        Sem acesso aos dados
      </h2>
      <p style={{ fontSize: 12.5, color: "var(--s-t3)", maxWidth: 460 }}>{motivo}</p>
    </div>
  );
}
