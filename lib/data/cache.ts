import { getCacheConfig } from "./config";

/**
 * Global, in-process, watermark-aware cache (see ADR 0002).
 *
 * All queries run under a single identity, so the data is identical for every
 * viewer — one shared cache is correct. Keys are namespaced per logical query.
 * The cached value is kept as long as the source watermark is unchanged; a TTL
 * ceiling forces a re-run as a safety net.
 *
 * This lives behind a small surface so it can later be swapped for an external
 * store (Lakebase/Redis) if the app ever scales to multiple instances.
 */

interface Entry {
  watermark: string;
  value: unknown;
  storedAt: number;
}

// Survive Next.js dev hot-reloads by stashing the map on globalThis.
const g = globalThis as unknown as { __brisaCache?: Map<string, Entry> };
const store: Map<string, Entry> = g.__brisaCache ?? (g.__brisaCache = new Map());

/**
 * Return the cached value for `key` if its watermark matches and it is within
 * the TTL ceiling; otherwise run `producer`, store and return it.
 */
export async function cachedByWatermark<T>(
  key: string,
  watermark: string,
  producer: () => Promise<T>,
): Promise<T> {
  const ttlMs = getCacheConfig().ttlSeconds * 1000;
  const hit = store.get(key);
  const fresh = hit && hit.watermark === watermark && Date.now() - hit.storedAt < ttlMs;
  if (fresh) return hit!.value as T;

  const value = await producer();
  store.set(key, { watermark, value, storedAt: Date.now() });
  return value;
}
