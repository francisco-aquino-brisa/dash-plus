import "server-only";

import { cache } from "react";
import { DatabricksDataClient } from "@/lib/data/databricks";
import { SOURCE_META, SOURCES } from "./sources";

/**
 * Column lists for every registered source, read once from `information_schema`
 * so the builder's dropdowns and the validator match the real schema. Degrades to
 * empty lists on failure (the builder still works, just without autocomplete).
 */

const CAT = process.env.DATABRICKS_CITIES_CATALOG ?? "gdb_brisanet_comunidade_dev";
const SCHEMA = process.env.DATABRICKS_CITIES_SCHEMA ?? "projeto_brisa_performance";

const DATE_TYPES = new Set(["DATE", "TIMESTAMP", "TIMESTAMP_NTZ"]);

export interface SourceSchema {
  columns: Record<string, string[]>;
  /** Columns an indicator may pick as its competência; the default is always listed. */
  dateColumns: Record<string, string[]>;
}

export const readSourceSchema = cache(async (): Promise<SourceSchema> => {
  const columns: Record<string, string[]> = {};
  const dateColumns: Record<string, string[]> = {};

  for (const t of SOURCES) {
    columns[t] = [];
    dateColumns[t] = [];
  }

  try {
    const placeholders = SOURCES.map(() => "?").join(", ");

    const rows = await new DatabricksDataClient().query<{
      table_name: unknown;
      column_name: unknown;
      data_type: unknown;
    }>(
      `SELECT table_name, column_name, data_type
         FROM \`${CAT}\`.information_schema.columns
        WHERE table_schema = ? AND table_name IN (${placeholders})
        ORDER BY table_name, ordinal_position`,
      [SCHEMA, ...SOURCES],
    );

    for (const r of rows) {
      const t = String(r.table_name);
      const col = String(r.column_name);

      if (!(t in columns)) continue;

      columns[t].push(col);

      if (col === SOURCE_META[t]?.competencia || DATE_TYPES.has(String(r.data_type).toUpperCase()))
        dateColumns[t].push(col);
    }
  } catch (err) {
    console.error("[indicators] readSourceSchema failed:", err);
  }

  return { columns, dateColumns };
});

export async function readSourceColumns(): Promise<Record<string, string[]>> {
  const { columns } = await readSourceSchema();

  return columns;
}
