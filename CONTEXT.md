# Brisa Dash

A centralized, controlled executive dashboard for Brisanet's commercial data, replacing ad-hoc PowerBI reports. It reads curated data from Databricks and presents it read-only to viewers; only the maintainer changes what the dashboard shows.

## Language

This glossary keeps Brisanet's business terms in their canonical Portuguese form (the ubiquitous language stakeholders actually use), with English definitions. Code identifiers and prose documentation are written in English; the UI is rendered in Portuguese.

## Roles & access

Identity is no longer a login form. The app runs inside Databricks Apps and reads
the authenticated user's **email** from the platform header (`X-Forwarded-Email`;
locally, a `DEV_USER_EMAIL` env fallback). The old Brisanet-SSO/CPF login is
removed. See ADR 0005.

**Usuário do app**:
A person allowed into the dashboard. Access requires an **active row in
`tb_usuarios`** keyed by `email`; absent or `ativo = false` → no access
("Sem acesso"). The row also carries `nivel_id` and `cpf` (kept for joins with
other tables, not for login).
_Avoid_: viewer, client.

**Nível**:
The access level of a usuário (`tb_niveis`, referenced by
`tb_usuarios.nivel_id`). Drives which features/routes are visible.

**Admin**:
A usuário whose nível is `admin`. Sees the "Administração" area (button + routes),
enforced by the `isAdmin` claim carried in the session token — both the sidebar
button and the `/admin/*` routes gate on it.

**Maintainer**:
The project author — owns the code and configuration. A code/ops role, not a
runtime permission.
_Avoid_: admin (that is a runtime nível), owner.

## Org hierarchy

**Cidade**:
A city where Brisanet operates, classified by `tipo_cidade` as ONLY (5G only), HÍBRIDA (5G + FWA + FTTH) or FTTH (FTTH only). The base grain of the Cities screen, always shown as "Cidade / UF".

**Tipo de Cidade**:
Service-availability class of a city: ONLY, HÍBRIDA, or FTTH. (The prototype mock also uses Capital/Interior/etc.; the real classification is service-based.)

**Tecnologia**:
The access technology of a service: FTTH, FWA, **Banda Larga** (= FTTH + FWA combined), or 5G.

## Indicators (Cities screen)

**Competência**:
The monthly reference period of the data, stored as the first day of the month (`yyyy-MM-01`).

**Base Ativa**:
Count of active customers for a technology. "Crescimento Base Ativa" = active base this month minus last month.

**Crescimento de Base**:
Net base growth = (active base + closed) this month minus the same last month. Distinct from "Crescimento Base Ativa" (which counts only active customers).

**Base Fechada**:
Closed/blocked customers — includes blocked, auto-deactivated, and requested-deactivation customers.

**Takeup** (FTTH only):
Penetration = (active base + closed) / Home Passed × 100.

**Home Passed**:
FTTH homes the network can reach (`total_de_hp`).

**Churn Rate**:
Monthly cancellation rate = cancellations / active base × 100. Lower is better.

**Churn Safra**:
Cohort churn — customers cancelled from the cohort installed 4 months ago, over total installs of that same cohort. For 5G, includes blocked customers.

**Vendas Criadas / Efetivadas / Instaladas**:
Sales funnel stages — orçamentos created, then confirmed (efetivado), then installed. "Efetivado × Criado" and "Instalado × Efetivado" are the conversion ratios between stages.

**Ativações 5G**:
5G chip activations in the city; tracked on an independent base from FTTH/FWA.

**Cidade Negativa**:
A city that missed its target — flagged for negative growth (Crescimento) and/or negative active-base growth (Base Ativa). The Cities screen lists these.

**Quartil (TAM de Cidades)**:
Distribution of cities into 4 buckets by % attainment of their target: Q1 ≥100%, Q2 70–99%, Q3 0–69%, Q4 <0%.

**Meta**:
The target value for an indicator at a given grain (city × indicator × competência). Every KPI is shown as Meta vs Resultado with an attainment % (Atingimento) and, for the current month, a pro-rata Projeção. For FTTH/FWA the targets live **inside** `indicadores_cidades` (`meta_crescimento`, `meta_orcamento`, `meta_orcamentos_efetivados`, `meta_instalacao`) — no separate metas table. Known gaps: there is no active-base target (`meta_base_ativa`, currently proxied) and `indicadores_cidades_5g` carries **no** target columns (5G activation target unknown).

**Gestão**:
The operating company / partner dimension on `indicadores_cidades` (`gestao`), e.g. BRISANET or AGILITY. (This is the prototype's "Empresa".)

## HC Zerado

**HC**:
A consultant with an active employment link on a given day (headcount). The grain
is person × day; the person is identified by **matrícula**. Only an active
**Situação** counts as HC.
_Avoid_: vendedor (that is the sales role, not the headcount unit), colaborador.

**Situação**:
The state of the employment link on that day — active, vacation, leave
(maternity, social security, accident), admitted, inactive. Only the active
state feeds Ociosidade; the others are reported as headcount composition.

**HC Zerado**:
An HC that recorded no sale on a given day, counted only over the services and
sale status that the **Regras Globais** charge for. A person is zerado per day,
never per period — a period is a count of zeroed days.

**Ociosidade**:
Share of HC Zerado over active HC, for a day and a cut (management, coordination,
city, channel). Lower is better.

**PDU**:
Produção diária útil — production per business day per active HC. Read daily
(cumulative through the month) or monthly (one point per closed month).

**Regras Globais**:
The configuration that decides what counts as a sale for the purpose of being
zerado: which services are charged, which sale status, and which **Agilidade**.
It overrides the user's own filters — a rule locked here cannot be relaxed on
screen.

**Agilidade**:
Whether a sale moved through its stages on the same day — created and confirmed
on the same day, or confirmed and installed on the same day.

**Justificativa**:
The record explaining one zeroed day for one HC. Carries a categoria, a written
motivo, and a status — em análise, aprovado, or rejeitado — plus the leader's
parecer. One justificativa per HC per day.

## Data & caching

**Watermark**:
A cheap signal of when the source last updated (e.g. `MAX(data)` or a load-control table). The cache key includes it, so cached data is served until the source actually advances.

**Auto-refresh flag**:
Configurable toggle. Off = lazy TTL refresh. On = a periodic watermark probe re-fetches heavy data only when the source has advanced.
