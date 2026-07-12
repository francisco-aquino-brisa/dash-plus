// File-based OAuth token cache for Databricks U2M (browser login) — LOCAL DEV ONLY.
//
// The @databricks/sql connector only ships an in-memory persistence, so the
// browser tab reopens on every new process. This stores the U2M token (access +
// refresh) in a gitignored file (chmod 600) so the dev server and the helper
// scripts reuse it across runs — the browser only opens again once the refresh
// token finally expires.
//
// PROD is unaffected: Databricks Apps uses M2M (service principal) and never
// touches this file.

import { readFileSync, writeFileSync, chmodSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import OAuthTokenMod from "@databricks/sql/dist/connection/auth/DatabricksOAuth/OAuthToken.js";

const OAuthToken = OAuthTokenMod?.default ?? OAuthTokenMod;

// Project root is two levels up from lib/data/.
const CACHE_FILE = join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".databricks-oauth-cache.json");

function readAll() {
  try {
    return JSON.parse(readFileSync(CACHE_FILE, "utf8"));
  } catch {
    return {};
  }
}

export class FilePersistence {
  async persist(host, token) {
    const all = readAll();

    all[host] = {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      scopes: token.scopes,
    };
    writeFileSync(CACHE_FILE, JSON.stringify(all), { mode: 0o600 });

    try {
      chmodSync(CACHE_FILE, 0o600);
    } catch {
      /* best effort */
    }
  }

  async read(host) {
    const entry = readAll()[host];

    if (!entry?.accessToken) return undefined;

    return new OAuthToken(entry.accessToken, entry.refreshToken, entry.scopes);
  }
}
