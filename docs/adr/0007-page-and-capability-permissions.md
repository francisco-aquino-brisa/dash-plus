# Page and capability permissions

Activates the `tb_paginas` / `tb_permissoes` / `tb_permissoes_nivel` model that
**ADR 0005** created but left unenforced: until now the only real gate was the
`isAdmin` claim, and every authenticated user reached every screen.

## Context

The admin area already lets the sustentação team register pages
(`/admin/paginas`), declare capabilities under them (`/admin/capacidades`) and
grant those to níveis (`/admin/permissoes`). Nothing in the app read any of it.

Two needs, at different grains:

- **Now** — a screen appears in the menu, and can be opened, only for a nível
  that holds at least one capability on it.
- **Next** — individual cards, buttons and fields are gated the same way. The
  worked example is HC Zerado "Justificar HC": the colaborador edits their own
  justificativa while their gestores only read it; the gestor edits the
  devolutiva and observação while the vendedor only reads those back. "Gestor"
  spans four níveis (Gerente Executivo, Gerente Funcional, Coordenador,
  Supervisor), which is precisely why the grant is a capability granted to
  several níveis rather than a check on the nível's name.

The target workflow is that sustentação creates the capability and hands us the
label; we add only the gate, at the one component it restricts.

## Decision

**A page is open when the nível holds ANY capability on it.** Page access is
keyed by `tb_paginas.rota`, not by a label, so the `visualizar_*` rows can be
renamed freely. This is deliberately the literal rule: an action-only grant on a
page also opens that page, which is what makes "gestor may answer a
justificativa" imply "gestor may open Justificar HC" without a second grant.

**A capability is checked by its `tb_permissoes.label`.** The label is therefore
an identifier, not a caption: renaming one switches its gate off silently. The
labels the code depends on are listed in `lib/auth/capabilities.ts`, and
`/admin/capacidades` marks those rows "usada no código" and warns before a
rename.

**The whole model rides in the session cookie**, resolved once by the gate at
mint time: `caps` (the labels), `rotas` (the pages reached by at least one of
them, ordered by `tb_paginas.id`) and `catalogo` (every registered rota). No
check costs a query, and the Edge middleware can gate and redirect on its own. A
grant therefore takes effect on the user's next entry — see Consequences.

`catalogo` is there for one reason: "not in the catalog, so open" cannot be told
from "in it and not granted" by `rotas` alone.

**Where each check runs:**

| Check                     | Where                                                    |
| ------------------------- | -------------------------------------------------------- |
| `/admin/*`                | middleware, on `isAdmin` alone                           |
| `/` → first held page     | middleware / `/bootstrap`                                |
| page access               | `app/(app)/layout.tsx` (every screen renders through it) |
| capability, server        | `can()` / `canAny()` — and inside every gated action     |
| capability, client        | `<Can cap>` / `useCan()` from `lib/auth/client`          |
| `/api/*` serving a screen | `requirePageSession(rota)` / `requireCap(label)`         |

An `/api` route that is global chrome rather than a screen's data — the sidebar's
freshness pulse — stays on `requireSession()` alone: gating it on a page would
403 in a loop for everyone who does not hold that page.

The page gate sits in the `(app)` layout rather than in the middleware because
deciding it needs the page catalog, which the Edge cannot query. `x-pathname` is
forwarded from the middleware so the layout knows what was asked for.

**A route outside the catalog is not gated.** `/organograma` and `/perfil` stay
open to any authenticated user until somebody registers them. Only `/admin/*` is
closed without being in the catalog.

**Redirects follow the grants.** `/`, entry via `/bootstrap`, a denied page and
"voltar aos dashboards" all resolve to the user's _first held page_ — never a
hardcoded `/dashboard` they may not hold. With no page at all the user lands on
`/sem-acesso?motivo=permissao`, which is worded differently from the
not-registered case so they bother the right team.

**Admins bypass everything** and carry no grants in their cookie. The seeded
`admin` nível holds no row in `tb_permissoes_nivel`, and gating it on data would
mean one bad grant could lock the administrators out of the screen that fixes
grants.

## Consequences

- **A grant takes effect on the user's next entry** (re-login, or cookie expiry
  ≤8h) — the accepted trade for a query-free check. `/admin/permissoes` says so
  in its subtitle.
- **A page registered after a cookie was minted is not gated for that session.**
  It matches no entry in the session's `catalogo`, so it reads as "outside the
  catalog, therefore open", until the user re-enters. Registering a screen and
  expecting it closed for people already signed in does not work; the way to
  close that window is the alternative below.
- **The alternative, if this ever matters:** invert the default so an
  unregistered route is CLOSED, keeping `/perfil` and friends in the code-level
  `ALWAYS_OPEN` list. `catalogo` then leaves the cookie entirely and a new screen
  is invisible until it is registered and granted. Rejected for now because it
  means every new screen must be registered before anyone can reach it.
- **The cookie grows with the grants.** Labels are stored verbatim, so a nível
  with roughly 50+ capabilities would approach the 4 KB cookie limit. Well beyond
  the current handful; the escape hatch is to resolve `caps` server-side per
  request (as ADR 0004 originally described) and keep only `rotas` in the token.
- **Session payloads are versioned** (`SESSION_VERSION`). A cookie of an older
  shape verifies as invalid and is re-minted, so it can never be read as "this
  user was granted nothing".
- **Hiding a control is not a check.** `<Can>` decides what is worth rendering;
  the server action it guards must call `can()` itself, and a card whose _data_
  is restricted must not be rendered server-side at all.
- Capability-level gates are wired one at a time as sustentação delivers the
  labels. `lib/auth/capabilities.ts` is empty on purpose — a label listed there
  but absent from the warehouse denies everyone but admins.
