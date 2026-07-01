# Data access and caching strategy

All Databricks queries run server-side under a single app identity (a service principal — see auth ADR), so the data is identical for every viewer. Therefore the app uses **one global, in-process cache shared across all users**, keyed by `(datasetId, normalizedParams, sourceWatermark)`.

## Query strategy is chosen by volume, not by screen

- **Small datasets** (e.g. the curated per-city/month `indicadores_cidades`, a few thousand rows): fetch the broad slice once *without* the dimensional filters in the `WHERE`, cache it, and apply filters/aggregations in JS. Switching filters costs zero extra queries.
- **Large fact tables** (e.g. `waves_consolidado_orcamento`, up to ~1M rows/month): never fetch raw rows — push `GROUP BY` and filters into SQL and cache the small aggregated result. Detail rows only on explicit drill-down.

Rule of thumb: if the unfiltered slice would exceed ~50k rows, aggregate in SQL.

## Freshness: watermark, not blind TTL

The source refreshes hourly, so a short TTL would re-fetch identical data ~60×/hour for no freshness gain. Instead, the cache key includes a **source watermark** (e.g. `MAX(data)` or a load-control table). While the watermark is unchanged, cached data is served indefinitely.

A configurable **auto-refresh flag** controls behavior on top of this:
- **Off**: lazy TTL (~1h default, configurable, 1-minute floor) — re-fetch on next visit after expiry.
- **On**: a cheap watermark probe runs every ~1 minute and triggers the heavy query *only* when the source has actually advanced.

## Update (verified against real data)

`indicadores_cidades` (+ `indicadores_cidades_5g`) is ~93k rows over 12 months —
**medium, not small**. Shipping all rows to the browser produced a ~10 MB page,
so the Cities screen computes the whole view-model **on the server** (over the
cached dataset) and ships only the result (~0.6 MB unfiltered, ~0.14 MB filtered).
Filters are URL search params: changing one re-renders the server component and
recomputes from the **in-process cache** — no extra warehouse query. The
"fetch broad once, aggregate in memory" principle still holds; the aggregation
just runs server-side rather than in the client.

## Consequences

The cache lives behind a swappable interface. In-memory per-process is correct for a single low-traffic instance; if the app ever scales to multiple instances, the implementation can be replaced with an external store (Lakebase/Redis) without touching callers. Global shared caching is only valid while all queries use a single identity; per-user query identity would require per-user cache partitioning.
