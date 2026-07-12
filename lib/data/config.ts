/**
 * Cache / freshness configuration (see ADR 0002).
 *
 * The source refreshes hourly, so freshness is driven by a cheap source
 * "watermark" rather than a blind short TTL. The TTL below is a safety ceiling
 * that forces a re-probe even if the watermark gets stuck.
 */
export interface CacheConfig {
  /** Safety ceiling: re-run the producer after this many seconds regardless. */
  ttlSeconds: number;
  /** When true, the UI polls the watermark and refreshes when the source advances. */
  autoRefresh: boolean;
  /** How often (seconds) the client polls the freshness endpoint when autoRefresh is on. */
  pollSeconds: number;
}

function intEnv(name: string, fallback: number, min = 1): number {
  const raw = process.env[name];
  const parsed = raw ? parseInt(raw, 10) : NaN;

  return Number.isFinite(parsed) && parsed >= min ? parsed : fallback;
}

export function getCacheConfig(): CacheConfig {
  return {
    // Default 1h, aligned to the hourly source cadence. Floor of 60s (configurable).
    ttlSeconds: intEnv("DATA_CACHE_TTL_SECONDS", 3600, 60),
    autoRefresh: process.env.DATA_AUTO_REFRESH === "true",
    pollSeconds: intEnv("DATA_WATERMARK_POLL_SECONDS", 60, 15),
  };
}
