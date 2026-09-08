"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";

/**
 * Data table (DESIGN_SYSTEM §4.5).
 *
 * `--s-sunken` header in 9.5px uppercase; rows divided by `--s-border`; numbers
 * right-aligned with tabular figures. The whole thing scrolls horizontally with
 * a `minWidth` interior so columns never crush. An empty result never renders a
 * bare table — it shows an explained empty state.
 */
export interface Column<T> {
  key: string;
  header: string;
  align?: "left" | "center" | "right";
  /** Mark numeric columns so values use tabular figures + right alignment. */
  numeric?: boolean;
  render: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  /** Rows that read as selected — e.g. the row a cross-filter came from. */
  isRowSelected?: (row: T) => boolean;
  /** Interior min width so columns don't crush on narrow viewports. */
  minWidth?: number;
  /** Cap the body height and scroll vertically, keeping the header pinned. */
  maxHeight?: number;
  /** When set, paginate client-side at this page size (a pager shows past 1 page). */
  pageSize?: number;
  empty?: { title: string; hint: string };
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  isRowSelected,
  minWidth = 640,
  maxHeight,
  pageSize,
  empty = { title: "Nada por aqui", hint: "Ajuste os filtros para ver resultados." },
}: DataTableProps<T>) {
  const [page, setPage] = useState(1);

  // Reset to the first page whenever the row set changes (e.g. a new search).
  useEffect(() => setPage(1), [rows]);

  const pageCount = pageSize ? Math.max(1, Math.ceil(rows.length / pageSize)) : 1;
  const safePage = Math.min(page, pageCount);
  const visibleRows = pageSize ? rows.slice((safePage - 1) * pageSize, safePage * pageSize) : rows;

  if (rows.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          padding: "40px 16px",
          textAlign: "center",
        }}
      >
        <span
          style={{
            display: "grid",
            placeItems: "center",
            width: 40,
            height: 40,
            borderRadius: 12,
            background: "var(--s-sunken)",
            color: "var(--s-t3)",
          }}
        >
          <Inbox size={20} />
        </span>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--s-t1)" }}>{empty.title}</div>
        <div style={{ fontSize: 12, color: "var(--s-t3)", maxWidth: 260 }}>{empty.hint}</div>
      </div>
    );
  }

  return (
    <>
      <div style={{ overflowX: "auto", overflowY: maxHeight ? "auto" : undefined, maxHeight }}>
        <table style={{ width: "100%", minWidth, borderCollapse: "collapse" }}>
          <thead style={maxHeight ? { position: "sticky", top: 0, zIndex: 1 } : undefined}>
            <tr style={{ background: "var(--s-sunken)" }}>
              {columns.map((col) => (
                <th key={col.key} style={headCellStyle(col)}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, i) => {
              const selected = isRowSelected?.(row) ?? false;

              return (
                <tr
                  key={rowKey(row, i)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={onRowClick ? "bd-menuitem" : undefined}
                  style={{
                    borderTop: "1px solid var(--s-border)",
                    cursor: onRowClick ? "pointer" : "default",
                    background: selected ? "var(--s-brand-weak)" : undefined,
                    boxShadow: selected ? "inset 3px 0 0 var(--s-brand)" : undefined,
                  }}
                >
                  {columns.map((col) => (
                    <td key={col.key} style={bodyCellStyle(col)}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pageSize && rows.length > pageSize && (
        <Pager
          page={safePage}
          pageCount={pageCount}
          total={rows.length}
          from={(safePage - 1) * pageSize + 1}
          to={Math.min(safePage * pageSize, rows.length)}
          onPage={setPage}
        />
      )}
    </>
  );
}

/** Compact pager (DESIGN_SYSTEM §4.5) — range summary + prev/next, `--s-*` tokens. */
function Pager({
  page,
  pageCount,
  total,
  from,
  to,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  from: number;
  to: number;
  onPage: (page: number) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "10px 12px",
        borderTop: "1px solid var(--s-border)",
      }}
    >
      <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--s-t3)" }}>
        {from}–{to} de {total}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <PagerButton label="Anterior" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft size={14} strokeWidth={2.4} />
        </PagerButton>
        <span
          style={{ fontSize: 11.5, fontWeight: 700, color: "var(--s-t2)", minWidth: 64, textAlign: "center" }}
        >
          {page} / {pageCount}
        </span>
        <PagerButton label="Próxima" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
          <ChevronRight size={14} strokeWidth={2.4} />
        </PagerButton>
      </div>
    </div>
  );
}

function PagerButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      style={{
        display: "grid",
        placeItems: "center",
        width: 30,
        height: 30,
        borderRadius: 8,
        border: "1px solid var(--s-border)",
        background: "var(--s-card)",
        color: disabled ? "var(--s-t3)" : "var(--s-t1)",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {children}
    </button>
  );
}

type CellStyleInput = { align?: "left" | "center" | "right"; numeric?: boolean };

function headCellStyle(col: CellStyleInput): CSSProperties {
  return {
    textAlign: col.align ?? (col.numeric ? "right" : "left"),
    padding: "9px 12px",
    fontSize: 9.5,
    fontWeight: 700,
    letterSpacing: ".09em",
    textTransform: "uppercase",
    color: "var(--s-t3)",
    background: "var(--s-sunken)",
    whiteSpace: "nowrap",
  };
}

function bodyCellStyle(col: CellStyleInput): CSSProperties {
  return {
    textAlign: col.align ?? (col.numeric ? "right" : "left"),
    padding: "12px",
    fontSize: 12.5,
    fontWeight: 600,
    color: "var(--s-t1)",
    fontVariantNumeric: col.numeric ? "tabular-nums" : undefined,
    whiteSpace: "nowrap",
  };
}
