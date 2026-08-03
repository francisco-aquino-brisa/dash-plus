"use client";

import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Plus, RotateCw } from "lucide-react";
import { useReportNavPending } from "@/lib/ui/nav-pending";
import { PrimaryButton, SearchInput } from "./primitives";

/**
 * Shared chrome for every admin list screen (DESIGN_SYSTEM §5 + §7): orange
 * eyebrow, 30px title, `--s-t3` subtitle and an "Atualizar" button that re-reads
 * the server data. Below the header, an optional search row with the primary
 * action, then the screen's panel. Entrance follows §6 (opacity/translateY, 300ms).
 */
export function AdminScreen({
  title,
  subtitle,
  search,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  search?: { value: string; onChange: (v: string) => void; placeholder?: string };
  action?: { label: string; onClick: () => void };
  children: ReactNode;
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();

  useReportNavPending(refreshing);

  return (
    <div style={{ padding: "clamp(18px, 4vw, 34px)", animation: "bdIn .3s ease both" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "var(--s-brand)",
              }}
            >
              Administração
            </div>
            <h1
              className="font-display"
              style={{
                margin: "6px 0 0",
                fontSize: "clamp(24px, 4vw, 30px)",
                fontWeight: 800,
                letterSpacing: "-.02em",
                color: "var(--s-t1)",
              }}
            >
              {title}
            </h1>
            <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--s-t3)" }}>{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => startRefresh(() => router.refresh())}
            disabled={refreshing}
            className="bd-ghost"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              height: 40,
              padding: "0 14px",
              borderRadius: 11,
              border: "1px solid var(--s-border)",
              background: "var(--s-card)",
              color: "var(--s-t2)",
              font: "inherit",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: refreshing ? "not-allowed" : "pointer",
            }}
          >
            <RotateCw size={15} style={{ animation: refreshing ? "bdSpin 1s linear infinite" : undefined }} />
            Atualizar
          </button>
        </div>

        {/* Search + primary action */}
        {(search || action) && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {search && (
              <SearchInput value={search.value} onChange={search.onChange} placeholder={search.placeholder} />
            )}
            {action && (
              <PrimaryButton onClick={action.onClick} style={{ height: 44 }}>
                <Plus size={16} />
                {action.label}
              </PrimaryButton>
            )}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
