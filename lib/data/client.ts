import type { DataClient } from "./types";

export type { DataClient } from "./types";

/** True when the app is wired to the real Databricks warehouse. */
export function isDatabricks(): boolean {
  return process.env.DATA_SOURCE === "databricks";
}

/**
 * Low-level SQL client factory. The Databricks driver is imported on demand so
 * a mock-mode build/dev does not pull in the native `@databricks/sql` deps.
 */
export function getDataClient(): DataClient {
  return new LazyDatabricksClient();
}

class LazyDatabricksClient implements DataClient {
  async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
    const { DatabricksDataClient } = await import("./databricks");
    return new DatabricksDataClient().query<T>(sql, params);
  }
}
