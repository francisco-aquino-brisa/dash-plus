# Identity from Databricks Apps + níveis in Databricks `tb_*` tables

Supersedes the SSO/CPF login of **ADR 0003** and revises the permission store of
**ADR 0004**. Adopted for the `new-ui` migration.

## Context

The redesign (`docs/references/new_ui`) drops the login screen entirely. The app
runs inside **Databricks Apps**, which authenticates the user at the platform edge
and forwards their identity on every request. There is therefore no reason to run
a second, app-level credential flow (Brisanet SSO by CPF).

Separately, the permission layer that ADR 0004 planned for **Postgres/Lakebase**
was instead created as **Delta tables in the analytics workspace**
(`gdb_brisanet_comunidade_dev.projeto_brisa_performance`). We align with what
exists rather than stand up a second store, and we trim the model to what the
new UI actually uses.

## Decision

**Identity comes from the platform, not a form.**

- The authenticated email is read from the **`X-Forwarded-Email`** header injected
  by Databricks Apps. Locally (no header) a **`DEV_USER_EMAIL`** env var stands in,
  and only when `NODE_ENV !== 'production'` — prod never trusts an env fallback.
- The **email is the login key** (Databricks does not forward CPF).

**Access gate.** A request is authorized iff an **active** row exists in
`tb_usuarios` for that email. The row joins `tb_niveis` for the access level.
Absent or `ativo = false` → a "Sem acesso" screen, not a redirect to a login page.

**Session token still exists**, minted after the gate resolves and cached in an
httpOnly cookie (~8h, unchanged from ADR 0003's mechanism). It carries the compact
user data the UI needs: `{ email, nome, cpf, nivelId, nivel, isAdmin }`, where
`isAdmin = (nivel === 'admin')`.

**Where each piece runs** (the Edge/Node split is forced by the stack):

- `middleware.ts` runs on the **Edge** and only verifies the cookie (jose is
  Edge-safe). It cannot query Databricks (`@databricks/sql` is Node-only). When the
  cookie is missing/expired it rewrites to a **bootstrap** route.
- The **bootstrap** route runs on **Node**, reads the header, runs the single gate
  query, mints the token, sets the cookie, and redirects to the target.
- **Admin gating** needs no query: the middleware reads the `isAdmin` claim from the
  cookie and blocks `/admin/*` for non-admins. The same claim shows/hides the
  "Administração" entry.

**Permission model (Databricks `tb_*`).** Keyed to what the new UI uses:

```
tb_niveis          { id, nome, descricao, … }        -- nome='admin' is the seeded level
tb_cargos          { id, nome, descricao, … }        -- nome='Administrador' is the seeded cargo
tb_usuarios        { id, cpf, matricula, nome, email, nivel_id→tb_niveis, cargo_id→tb_cargos, ativo, … }
tb_paginas         { id, nome, icone, rota, … }
tb_permissoes      { id, label(snake_case), descricao, pagina_id→tb_paginas, … }
tb_permissoes_nivel{ permissao_id→tb_permissoes, nivel_id→tb_niveis }
```

The ADR 0004 axes of **setor** and **data scope** (`escopo_tipo`/`escopo_valor`)
are **dropped** — the new UI has no functional-area split and no per-row hierarchy
scoping. `cpf` is retained only as a join key to other warehouse tables.

## Why not keep ADR 0003/0004 as-is

- **SSO by CPF is redundant** behind Databricks Apps, which already authenticated
  the user. Keeping it means a second password/OTP flow for an identity we already
  have — and the CPF it keyed on is not even forwarded by the platform.
- **`cadastro_usuario` cannot be the gate:** its email domain is
  `@grupobrisanet.com.br` while the forwarded identity is `@timebrisa.com.br`, so an
  email match never lands. `tb_usuarios` is seeded with the `@timebrisa.com.br`
  identity instead.
- **Lakebase/Postgres was never provisioned;** the `tb_*` Delta tables were. Using
  them avoids a second datastore for a small, low-write policy set.

## Consequences

- **The read-only hard rule (CLAUDE.md) gains one carve-out.** The `tb_*` tables are
  app-owned (created under the maintainer, who has `ALL PRIVILEGES` on the schema)
  and the Administração area will **write** to them. Every _analytics_ catalog stays
  strictly read-only; only these six app-tables are writable, and only from the
  admin path. This tension is revisited in the Administração phase (the alternative
  is still to move the writable layer to Lakebase as ADR 0004 intended).
- **Staleness window:** a nível change is not reflected until the cookie expires
  (≤8h) or is re-minted. Acceptable at this volume.
- **Spoofing surface:** `X-Forwarded-Email` is trusted only in production (behind the
  platform, which sets and strips it); the env fallback is dev-only.
- Removed from the codebase: `app/login`, `app/api/auth/*`, `lib/sso/*`,
  `lib/auth/cpf.ts`, `lib/auth/authz.ts`, OTP/captcha. `lib/auth/jwt.ts`
  (`SessionUser` reshaped), `session.ts`, `api.ts` and `middleware.ts` are adapted.
- CONTEXT.md's role glossary is updated (usuário do app / nível / admin).
