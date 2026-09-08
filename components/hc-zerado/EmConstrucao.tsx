import { Hammer } from "lucide-react";

/**
 * Placeholder for the module's screens that have not been ported yet. The
 * migration lands one screen at a time, and an explicit "not here yet" beats a
 * dead link in the sidebar.
 */
export function EmConstrucao({ titulo, descricao }: { titulo: string; descricao: string }) {
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
      <Hammer size={22} style={{ color: "var(--s-brand)" }} />
      <h2 className="font-display" style={{ fontSize: 15, fontWeight: 800, color: "var(--s-t1)" }}>
        {titulo}
      </h2>
      <p style={{ fontSize: 12.5, color: "var(--s-t3)", maxWidth: 460 }}>{descricao}</p>
      <span
        style={{
          border: "1px solid var(--s-border)",
          borderRadius: 999,
          padding: "3px 10px",
          background: "var(--s-sunken)",
          color: "var(--s-t3)",
          fontSize: 10.5,
          fontWeight: 700,
        }}
      >
        Migração em andamento
      </span>
    </div>
  );
}
