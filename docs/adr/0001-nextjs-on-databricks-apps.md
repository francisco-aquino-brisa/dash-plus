# Next.js (App Router) on Databricks Apps

We build the dashboard as a single Next.js (App Router) application using `output: 'standalone'`, deployed to Databricks Apps as a Node server (`command: ["node", "server.js"]`, listening on `$PORT`). A single Next app serves both UI and server-side data access, so there is no separate backend/frontend.

## Considered Options

The reference prototypes in `docs/references/` are built with **TanStack Start** (Vite + `@tanstack/react-router` + `@tanstack/react-start`), which is also a full-stack Node SSR framework deployable to Databricks Apps with near-zero porting. We chose Next.js anyway because it is more mainstream, has a documented Databricks Apps deployment path, a larger ecosystem, and is the framework the sole maintainer wants to maintain long-term. (Next.js does not use Vite — it bundles with Turbopack/webpack; the two are alternatives, not combined.)

## Consequences

The prototypes' UI layer (shadcn/Radix components, Recharts, Tailwind 4, OKLch color tokens) is framework-agnostic and ports cleanly. Only the routing and data-fetching layers are re-implemented: TanStack Router → App Router, and TanStack Query → React Server Components plus a server-side cache. The `docs/references/` prototypes stay in the repo as a runnable visual reference until our Next.js version is built, then are no longer consulted or depended on.
