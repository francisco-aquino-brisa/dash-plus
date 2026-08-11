"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AlertTriangle } from "lucide-react";
import { ModalShell } from "./AdminModal";
import { DangerButton, SecondaryButton } from "./primitives";

/**
 * Destructive confirmation (DESIGN_SYSTEM §4.8). Every deletion routes through
 * this: an alert icon on `--s-bad-bg`, the question, the record name, the "não dá
 * para desfazer" consequence and a `--s-bad` confirm button.
 */
export function ConfirmDelete({
  open,
  onClose,
  onConfirm,
  question,
  recordName,
  busy,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  question: string;
  recordName: string;
  busy?: boolean;
  /** Surfaces a refused deletion (e.g. a business-rule guard) instead of failing silently. */
  error?: string | null;
}) {
  return (
    <ModalShell open={open} onClose={onClose} maxWidth={420}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          textAlign: "center",
        }}
      >
        <span
          style={{
            display: "grid",
            placeItems: "center",
            width: 48,
            height: 48,
            borderRadius: 14,
            background: "var(--s-bad-bg)",
            color: "var(--s-bad)",
          }}
        >
          <AlertTriangle size={22} />
        </span>
        <DialogPrimitive.Title
          className="font-display"
          style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--s-t1)" }}
        >
          {question}
        </DialogPrimitive.Title>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--s-t2)" }}>{recordName}</div>
        <div style={{ fontSize: 12.5, color: "var(--s-t3)" }}>Não dá para desfazer.</div>
      </div>
      {error && (
        <div
          style={{
            padding: "9px 12px",
            borderRadius: 10,
            background: "var(--s-bad-bg)",
            color: "var(--s-bad)",
            fontSize: 12,
            fontWeight: 700,
            textAlign: "center",
          }}
        >
          {error}
        </div>
      )}
      <div style={{ display: "flex", gap: 10 }}>
        <SecondaryButton onClick={onClose} disabled={busy}>
          Cancelar
        </SecondaryButton>
        <DangerButton onClick={onConfirm} disabled={busy} style={{ flex: 1 }}>
          {busy ? "Excluindo…" : "Excluir"}
        </DangerButton>
      </div>
    </ModalShell>
  );
}
