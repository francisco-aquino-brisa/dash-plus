"use client";

import type { CSSProperties, ReactNode } from "react";
import { Inbox } from "lucide-react";

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
  align?: "left" | "right";
  /** Mark numeric columns so values use tabular figures + right alignment. */
  numeric?: boolean;
  render: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  /** Interior min width so columns don't crush on narrow viewports. */
  minWidth?: number;
  empty?: { title: string; hint: string };
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  minWidth = 640,
  empty = { title: "Nada por aqui", hint: "Ajuste os filtros para ver resultados." },
}: DataTableProps<T>) {
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
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", minWidth, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "var(--s-sunken)" }}>
            {columns.map((col) => (
              <th key={col.key} style={headCellStyle(col)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={rowKey(row, i)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={onRowClick ? "bd-menuitem" : undefined}
              style={{
                borderTop: "1px solid var(--s-border)",
                cursor: onRowClick ? "pointer" : "default",
              }}
            >
              {columns.map((col) => (
                <td key={col.key} style={bodyCellStyle(col)}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type CellStyleInput = { align?: "left" | "right"; numeric?: boolean };

function headCellStyle(col: CellStyleInput): CSSProperties {
  return {
    textAlign: col.align ?? (col.numeric ? "right" : "left"),
    padding: "9px 12px",
    fontSize: 9.5,
    fontWeight: 700,
    letterSpacing: ".09em",
    textTransform: "uppercase",
    color: "var(--s-t3)",
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
