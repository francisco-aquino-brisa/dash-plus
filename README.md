# Brisa Dash

Centralized executive dashboard for Brisanet commercial data, deployed to
Databricks Apps. Next.js (App Router), single Node app — UI + server-side data
access. See [CONTEXT.md](./CONTEXT.md) for the domain glossary and
[docs/adr/](./docs/adr/) for the architectural decisions.

## v1 scope

**Tela 1 — Performance Cidades** as a full vertical slice: layout faithful to
the `docs/references/performance_cidades_vendas_canais` prototype, indicators on
the real `indicadores_cidades` schema, local mock data, watermark-aware cache,
Brisanet SSO login. Other screens follow the same pattern later.

## Run locally (mock data + stub SSO)

```bash
npm install
npm run stub        # terminal 1 — fake Brisanet SSO on :4555
npm run dev         # terminal 2 — Next dev (reads .env.local)
```

Open http://localhost:3000 → redirected to `/login`. Sign in with any **valid
CPF** (e.g. `529.982.247-25`) and any password except `wrong`.

`.env.local` already points `SSO_BASE_URL` at the stub and sets
`DATA_SOURCE=mock`. Copy `.env.example` for the full list of variables.

## Deploy to Databricks Apps

**Databricks Apps builds the source itself.** On each deploy it runs `npm install`
then `npm run build` (`next build`) on the synced source, then the `command` in
[app.yaml](./app.yaml) — `next start` on the injected `$DATABRICKS_APP_PORT`. So
you sync the **repo source** (not a prebuilt bundle); Apps installs and builds it.
The runtime injects the app service principal's `DATABRICKS_HOST` /
`DATABRICKS_CLIENT_ID` / `DATABRICKS_CLIENT_SECRET` automatically
(`lib/data/databricks.ts` consumes them) — don't put those in `app.yaml`.

> `.gitignore` excludes `node_modules`, `.next` (Apps reinstalls/rebuilds) and
> `docs/references` (~1.1 GB of prototypes) so `databricks sync` stays lean.

### One-time prerequisites

- Databricks CLI authenticated: `databricks auth login --host <workspace-url>`.
- **Service principal grants** — the app runs as its own SP, not your user. Grant
  it `USE CATALOG`/`USE SCHEMA` + `SELECT` on `projeto_brisa_performance.*` (incl.
  `cadastro_usuario`, `ficha_indicadores`, `vw_hc_zerado_vendedor`) and the sales
  schema, plus `CAN USE` on the SQL Warehouse. Without this the screens fall back
  to mock and **login fails** (the gate reads `cadastro_usuario`).
- **Session secret (2 steps)** — `app.yaml` has `JWT_SECRET` → `valueFrom: jwt-secret`,
  which references an app **resource**, so you need both:
  ```bash
  databricks secrets create-scope brisa
  databricks secrets put-secret brisa jwt-secret --string-value "$(openssl rand -hex 32)"
  ```
  then in the app (UI → _Edit_ → _Resources_ → _Add_ → _Secret_) add a resource
  **named `jwt-secret`** pointing to scope `brisa`, key `jwt-secret`, permission
  `READ`. (Without the resource the deploy fails: `jwt-secret not found`.)
- Add a **SQL Warehouse** resource for the warehouse the app queries.
- **SSO reachability** — the Apps runtime must reach `https://revan.brisanet.net.br`
  (the real SSO); otherwise login times out.

### Deploy / redeploy

Run from the repo root (`.` = the source; Apps builds it):

```bash
# sync the source up (one-shot, or --watch to keep pushing on save)
databricks sync . /Workspace/Users/francisco.aquino@timebrisa.com.br/brisa-dash-plus-src

# deploy — Apps runs `npm install` + `npm run build`, then `next start`
databricks apps deploy brisa-dash-plus --source-code-path /Workspace/Users/francisco.aquino@timebrisa.com.br/brisa-dash-plus-src

# (optional) pull the deployed source back down to inspect it
databricks workspace export-dir /Workspace/Users/francisco.aquino@timebrisa.com.br/brisa-dash-plus-src .
```

> Keep the `sync` target and the `--source-code-path` **identical**. Watch the
> build/runtime in the app's **Logs** tab — the first deploy's usual failures are
> the SP grants and SSO reachability above, not packaging.

## Design system

Custom light theme ("Brisanet harmonic") on top of shadcn. Every design value is
an **OKLch CSS variable** in [app/globals.css](./app/globals.css), exposed as
Tailwind utilities via `@theme inline` (Tailwind v4). **Never hard-code hex — use
a token.** Stack: shadcn/Radix primitives (`components/ui/`), Recharts, date-fns;
code in English, UI copy in pt-BR.

**Color** — semantic tokens used as `bg-*` / `text-*` / `border-*`:

| Token                                    | Role                                   |
| ---------------------------------------- | -------------------------------------- |
| `background` / `foreground`              | soft off-white canvas / ink            |
| `primary`                                | warm coral-orange — actions & emphasis |
| `accent`                                 | soft teal                              |
| `secondary` / `muted`                    | quiet surfaces / secondary text        |
| `success` `warning` `destructive`        | status (KPI attainment, churn…)        |
| `chart-1…5`                              | Recharts series colors                 |
| `card` `popover` `border` `input` `ring` | surfaces & controls                    |

Gradients/shadows are utilities: `bg-gradient-primary`, `bg-gradient-card`,
`text-gradient`, `shadow-elegant`, `shadow-glow` (body carries a fixed
`--gradient-glow`).

**Typography** — Display (`h1–h4`, `font-display`): Space Grotesk, tracking
`-0.02em`; Body: Inter. Loaded in [app/layout.tsx](./app/layout.tsx).

**Shape & motion** — radius scale from `--radius: 0.75rem` (`rounded-lg/xl/2xl`);
cards use `backdrop-blur`; animations respect `prefers-reduced-motion`. A `dark:`
variant is wired but the app ships **light-only**.

**Recurring patterns** (reuse — don't re-invent):

| Pattern       | Classes                                                                        |
| ------------- | ------------------------------------------------------------------------------ |
| Section card  | `rounded-2xl border border-border bg-card/40 p-5 shadow-elegant backdrop-blur` |
| KPI card      | `rounded-xl border border-border bg-gradient-card p-5`                         |
| Filter bar    | `rounded-xl border border-border bg-card/60 p-3 backdrop-blur`                 |
| Mini stat     | `rounded-lg border border-border bg-secondary/30 p-3`                          |
| Field label   | `text-[10px] font-medium uppercase tracking-wider text-muted-foreground`       |
| Progress fill | `success` ≥100% · `warning` ≥70% · else `destructive`                          |

**Shared building blocks** — `components/ui/filter-select` (dimension dropdown,
"Todos" = cleared) and `mock-data-badge`; [lib/format.ts](./lib/format.ts)
(pt-BR numbers/months/percent), [lib/date.ts](./lib/date.ts) (ISO ↔ Date + range
labels), [lib/copy.ts](./lib/copy.ts) (shared pt-BR strings),
[lib/utils.ts](./lib/utils.ts) (`cn()`).

> **Building UI:** compose from `components/ui/` primitives, style only with
> tokens, keep copy in pt-BR (centralize repeats in `lib/copy.ts`), and follow the
> patterns above so the three screens stay consistent.

## Layout

```
app/            routes: /login, /dashboard, /api/auth/*, /api/cities/freshness
components/     ui/ primitives (shadcn) + dashboard/ (Tela 1)
lib/auth/       Brisanet SSO session (JWT) — lifted from ../dashboard
lib/sso/        SSO client
lib/data/       DataClient, watermark cache, config
lib/data/cities/  types, compute (KPIs), mock, databricks repo, repository
scripts/        stub-sso.mjs (local SSO mock)
docs/           CSVs, prototypes (references), ADRs
```

# dash-plus
