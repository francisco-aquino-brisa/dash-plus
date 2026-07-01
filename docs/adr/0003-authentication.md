# Authentication: Brisanet SSO + stateless JWT, service principal for data

Two independent identity layers:

**Viewer login** uses Brisanet's own SSO (not Databricks platform auth, not next-auth). The flow is CPF-based against `revan.brisanet.net.br/sso/v1`: `GET /auth/steps?login={cpf}` discovers name/picture and whether OTP/captcha are required, then `POST /auth/login` authenticates. On success the app issues a **stateless JWT** (HS256 via `jose`) stored in an httpOnly cookie (`brisa_session`, ~8h TTL). `middleware.ts` verifies the cookie on every protected route (Edge-compatible). A local `stub-sso` server mocks the SSO for development.

**Data queries** run under a single Databricks **service principal** (OAuth M2M, `DATABRICKS_SP_CLIENT_ID/SECRET`), never on-behalf-of the viewer. Viewers therefore need no Databricks grants, and the data is identical for all of them — which is what makes the global shared cache (ADR 0002) correct.

## Why

The auth model is lifted from an existing sibling project (`../dashboard`) that already implements it against Brisanet's real SSO. We reuse only that module (jwt, sso client, `/api/auth` routes, middleware, stub) into the fresh `dash` project; its UI (Tremor/Tailwind 3) is discarded in favor of the prototype's stack (shadcn/Recharts/Tailwind 4). The login page is rebuilt in the new design.

## Consequences

Viewers do not need Databricks workspace accounts. The session is stateless (no session store). Authorization is binary (authenticated or not) — there is one maintainer and read-only viewers, no roles. If queries ever need per-user identity, the global cache would have to be partitioned per user (see ADR 0002).
