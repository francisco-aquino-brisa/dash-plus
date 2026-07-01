# Role/sector permissions and hierarchy-based data scope

Supersedes the "authorization is binary, no roles" stance of ADR 0003 and extends
the caching key of ADR 0002. The dashboard grows from *one maintainer + identical
read-only viewers* to **viewers who see different components and different data
rows depending on their role, sector, and place in the org hierarchy.**

## Two independent permission axes

Two questions were being conflated; they are modelled separately.

- **Feature visibility** — *which* cards/charts/screens a viewer may see. Driven by
  **nível** (hierarchical rank/role) and **setor** (functional area), never by
  individual user. A viewer's visible features = the union of what their nível and
  their setor are granted.
- **Data scope** — *which rows* a viewer sees inside a component they can access
  (e.g. a supervisor sees only their team's cities; a director sees all). Driven by
  the viewer's position in the **org hierarchy**.

## Why not Databricks-native permissions (alternatives considered)

Databricks natively offers an app-access gate (App ACL `CAN_USE`/`CAN_MANAGE`) and
row-level security in Unity Catalog (row filters, dynamic views, column masks). We
do **not** use them for this, because:

1. **They cannot do feature visibility.** Hiding a chart from a role is a UI
   concern; Unity Catalog has no concept of it.
2. **They cannot provide the self-service admin UI** the maintainer wants — UC
   grants are managed via SQL/Terraform/console, not by checkboxes in our app.
3. **The identity model does not fit.** Viewers authenticate via Brisanet SSO and
   all queries run under a single service principal (ADR 0003); Unity Catalog only
   ever sees the service principal, not the viewer. Native row-level security would
   require switching to on-behalf-of-user auth — turning every viewer into a
   Databricks/UC principal, abandoning the SSO+SP model, breaking the shared cache
   (ADR 0002), and *still* leaving the identity→hierarchy mapping problem below
   unsolved.

Row scoping is therefore enforced **in the app** (the service principal reads the
broad slice, the app applies a `WHERE` predicate before returning data). Keeping
the service principal least-privileged (`SELECT` only) remains good hygiene.

## Where the policy lives: an app-owned Postgres store

The analytics access is **read-only** (project hard rule) and the app is otherwise
stateless. The permission policy needs a **read-write** store the app owns —
separate from the analytics warehouse. We use **Lakebase (managed Postgres on
Databricks Apps)**, already named in ADR 0002 as the external store option.

- The DDL for this store is [db/permissions/0001_init.sql](../../db/permissions/0001_init.sql).
  It runs on **Postgres/Lakebase, never on the analytics catalogs** — creating
  these tables in Databricks would violate the read-only rule.
- The existing Databricks `cadastro_usuario` (matricula, cpf, nome, email,
  usuario_ativo, permissao — 5 ADMIN rows today) stays read-only. The new
  `usuarios_app` table is the app-managed layer that adds nível/setor/scope, keyed
  by CPF, and becomes the self-service gate. It is seeded from the current ADMINs.

## Identity → scope binding (bind it, do not derive it)

The org hierarchy exists in `organograma_cidades` (EMPRESA → GERENCIA → GERENTE →
COORDENACAO → COORDENADOR → CIDADE → SUPERVISOR) and in the consultor-grain view
`vw_producao_hc_zero_venda`. But it is **keyed only by name** — there is no stable
employee id, and no CPF/matrícula linking a logged-in user to their node. So a
viewer's scope **cannot be reliably auto-derived** by joining on names.

Instead the scope is **assigned explicitly** in the admin UI: each `usuarios_app`
row carries `escopo_tipo` ∈ {`all`, `gerencia`, `gerente`, `coordenador`,
`supervisor`} and `escopo_valor` (the matching name/code). The admin picks
`escopo_valor` from a dropdown populated by the **distinct live values** of
`organograma_cidades` (15 gerências, 19 gerentes, 46 coordenadores, 144
supervisores). Deterministic, and immune to homonyms and to managers who never
appear as consultores.

## Enforcement

- **Login:** SSO validates the CPF, then the app loads the `usuarios_app` row
  (nível, setor, escopo). If absent or `ativo = false`, access is denied.
- **Session (JWT):** carries the compact `nivel`, `setor`, and a derived `scopeKey`
  (e.g. `all`, `ger:ROMULO FERRALME`). The full capability list is resolved
  server-side per request from the store (cheap, cacheable) — the cookie stays small.
- **Feature visibility:** enforced in the Server Component / route — a viewer
  without a capability neither fetches its data nor renders it. Never hide with CSS
  alone (the data would still ship).
- **Data scope:** the `scopeKey` becomes a `WHERE` predicate on every data query
  (filtering on the hierarchy name columns).

## Cache impact (extends ADR 0002)

The cache key gains the `scopeKey`: `(datasetId, normalizedParams, sourceWatermark,
scopeKey)`. Because scope is a small, bounded set (~225 classes, plus `all`),
viewers who share a scope share a cache entry — the whole directorate (`all`) shares
one. This partitions the cache by *scope*, not by *user*, so it does not explode.

## Consequences

- This is now a stateful app: it depends on a provisioned Postgres/Lakebase store.
- A new **admin** screen (`screen:admin` capability) is required to manage níveis,
  setores, user assignments, and the capability × (nível/setor) grant matrix.
- Every gate-able component must be given a stable capability key and wired to the
  server-side check — a one-time pass over `components/dashboard`, `components/sales`,
  `components/produtividade`.
- CLAUDE.md's "viewers are all identical, read-only" framing and CONTEXT.md's binary
  Maintainer/Viewer role model must be updated to describe níveis and setores.
