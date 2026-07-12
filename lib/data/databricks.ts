import { DBSQLClient } from "@databricks/sql";
import type { ConnectionOptions } from "@databricks/sql/dist/contracts/IDBSQLClient";
import type { DBSQLParameterValue } from "@databricks/sql/dist/DBSQLParameter";
import { FilePersistence } from "./databricks-oauth-cache.mjs";
import type { DataClient } from "./types";

/**
 * Production implementation of DataClient using the official `@databricks/sql`
 * driver. It connects to a SQL Warehouse under the app's single service
 * principal (OAuth M2M), runs the query and tears everything down. Stays
 * inactive while `DATA_SOURCE !== 'databricks'`.
 *
 * Authentication (see ADR 0003):
 *   - Service principal:  DATABRICKS_SP_CLIENT_ID + DATABRICKS_SP_CLIENT_SECRET (preferred)
 *   - Personal PAT:       DATABRICKS_TOKEN
 *
 * Parameters are passed as `ordinalParameters` (`?` placeholders), never
 * concatenated into the SQL.
 */
export class DatabricksDataClient implements DataClient {
  async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    const client = new DBSQLClient();

    await client.connect(buildConnectionOptions());

    const session = await client.openSession();

    try {
      const op = await session.executeStatement(sql, {
        runAsync: true,
        ordinalParameters: params as DBSQLParameterValue[],
      });

      try {
        const rows = await op.fetchAll();

        return rows as T[];
      } finally {
        await op.close();
      }
    } finally {
      await session.close();
      await client.close();
    }
  }
}

function buildConnectionOptions(): ConnectionOptions {
  const host = required("DATABRICKS_HOST");
  // On Databricks Apps, the SQL Warehouse is bound as an app resource and its id
  // is injected as DATABRICKS_WAREHOUSE_ID (valueFrom the resource key). Building
  // the path from the bound warehouse guarantees the app's OAuth token is
  // authorized for the warehouse it queries (avoids a 403 from a mismatched path).
  // Falls back to an explicit DATABRICKS_HTTP_PATH for local dev / scripts.
  const warehouseId = process.env.DATABRICKS_WAREHOUSE_ID;
  const path = warehouseId ? `/sql/1.0/warehouses/${warehouseId}` : required("DATABRICKS_HTTP_PATH");

  // Service principal (OAuth M2M). On Databricks Apps these are injected as
  // DATABRICKS_CLIENT_ID/SECRET; locally we use the SP_ -prefixed vars.
  const clientId = process.env.DATABRICKS_SP_CLIENT_ID ?? process.env.DATABRICKS_CLIENT_ID;
  const clientSecret = process.env.DATABRICKS_SP_CLIENT_SECRET ?? process.env.DATABRICKS_CLIENT_SECRET;
  const token = process.env.DATABRICKS_TOKEN;

  if (clientId && clientSecret) {
    return {
      host,
      path,
      authType: "databricks-oauth",
      oauthClientId: clientId,
      oauthClientSecret: clientSecret,
    };
  }

  if (token) {
    return { host, path, authType: "access-token", token };
  }

  // User-to-Machine OAuth (interactive browser login). For LOCAL DEV only —
  // PATs are disabled org-wide and service principals may need an admin. The
  // first query opens a browser; the token is cached to a gitignored file so it
  // is reused across restarts (the tab only reopens once the token fully expires).
  if (process.env.DATABRICKS_AUTH === "oauth-u2m") {
    return { host, path, authType: "databricks-oauth", persistence: new FilePersistence() };
  }

  throw new Error(
    "Databricks credentials missing: set DATABRICKS_SP_CLIENT_ID/SECRET (M2M) or DATABRICKS_AUTH=oauth-u2m (local browser login)",
  );
}

function required(name: string): string {
  const value = process.env[name];

  if (!value) throw new Error(`${name} is not configured`);

  return value;
}
