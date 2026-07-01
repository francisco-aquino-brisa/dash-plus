/**
 * Low-level swappable SQL client. Only the Databricks-backed repositories use
 * it directly; mock repositories generate data without SQL.
 *
 * Switching mock → Databricks = changing the `DATA_SOURCE` env + credentials,
 * with no changes to screens (see ADR 0002 / ADR 0003).
 */
export interface DataClient {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}
