import "server-only";

import { DatabricksDataClient } from "@/lib/data/databricks";
import { SOURCES } from "./sources";

/**
 * Column lists for every registered source, keyed by the Databricks view name,
 * read once from `information_schema` and handed to the builder so its `coluna`
 * dropdowns and the expression validator match the real schema. One bounded query;
 * degrades to empty lists on failure (the builder still works, just without
 * column autocomplete).
 */

const CAT = process.env.DATABRICKS_CITIES_CATALOG ?? "gdb_brisanet_comunidade_dev";
const SCHEMA = process.env.DATABRICKS_CITIES_SCHEMA ?? "projeto_brisa_performance";

export async function readSourceColumns(): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};

  for (const t of SOURCES) out[t] = [];

  try {
    const placeholders = SOURCES.map(() => "?").join(", ");

    const rows = await new DatabricksDataClient().query<{ table_name: unknown; column_name: unknown }>(
      `SELECT table_name, column_name
         FROM \`${CAT}\`.information_schema.columns
        WHERE table_schema = ? AND table_name IN (${placeholders})
        ORDER BY table_name, ordinal_position`,
      [SCHEMA, ...SOURCES],
    );

    for (const r of rows) {
      const t = String(r.table_name);

      if (t in out) out[t].push(String(r.column_name));
    }
  } catch (err) {
    console.error("[indicators] readSourceColumns failed:", err);
  }

  return out;
}
