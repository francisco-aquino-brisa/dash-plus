"use client";

import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { PrimaryButton, SecondaryButton } from "./primitives";

/**
 * Modal shell (DESIGN_SYSTEM §4.7): overlay `rgba(15,15,26,.45)` + blur, centered
 * card with `--r-modal` radius and `max-height: calc(100% - 48px)`. Built on Radix
 * Dialog for focus-trap + Escape, styled inline with `--s-*` like the DrillModal.
 * On mobile it stays a centered card (the admin forms are short); the AppShell's
 * own sheets cover the bottom-sheet navigation case.
 */
export function ModalShell({
  open,
  onClose,
  children,
  maxWidth = 440,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: number;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgba(15,15,26,.45)",
            backdropFilter: "blur(3px)",
            animation: "bdFade .2s ease both",
          }}
        />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          style={{
            position: "fixed",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 81,
            width: "calc(100vw - 32px)",
            maxWidth,
            maxHeight: "calc(100% - 48px)",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            padding: 20,
            background: "var(--s-card)",
            border: "1px solid var(--s-border)",
            borderRadius: "var(--r-modal)",
            boxShadow: "var(--s-sh-2)",
            animation: "bdModalIn .18s ease both",
          }}
        >
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Header: eyebrow + title + 34px close button (§4.7). */
export function ModalHeader({
  eyebrow,
  title,
  onClose,
}: {
  eyebrow: string;
  title: string;
  onClose: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: "var(--s-brand)",
          }}
        >
          {eyebrow}
        </div>
        <DialogPrimitive.Title
          className="font-display"
          style={{
            margin: "4px 0 0",
            fontSize: 19,
            fontWeight: 800,
            letterSpacing: "-.01em",
            color: "var(--s-t1)",
          }}
        >
          {title}
        </DialogPrimitive.Title>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar"
        className="bd-ghost"
        style={{
          flex: "none",
          display: "grid",
          placeItems: "center",
          width: 34,
          height: 34,
          borderRadius: 10,
          border: "1px solid var(--s-border)",
          background: "var(--s-sunken)",
          color: "var(--s-t2)",
          cursor: "pointer",
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}

/** Standard form modal: header + body + footer (secondary left, primary rest). */
export function AdminModal({
  open,
  onClose,
  eyebrow,
  title,
  children,
  onSubmit,
  submitLabel,
  busy,
  submitDisabled,
  error,
}: {
  open: boolean;
  onClose: () => void;
  eyebrow: string;
  title: string;
  children: ReactNode;
  onSubmit: () => void;
  submitLabel: string;
  busy?: boolean;
  submitDisabled?: boolean;
  error?: string | null;
}) {
  return (
    <ModalShell open={open} onClose={onClose}>
      <ModalHeader eyebrow={eyebrow} title={title} onClose={onClose} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
        {error && (
          <div
            style={{
              padding: "9px 12px",
              borderRadius: 10,
              background: "var(--s-bad-bg)",
              color: "var(--s-bad)",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {error}
          </div>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 2 }}>
          <SecondaryButton onClick={onClose} disabled={busy}>
            Cancelar
          </SecondaryButton>
          <PrimaryButton type="submit" disabled={busy || submitDisabled} style={{ flex: 1 }}>
            {busy ? "Salvando…" : submitLabel}
          </PrimaryButton>
        </div>
      </form>
    </ModalShell>
  );
}
