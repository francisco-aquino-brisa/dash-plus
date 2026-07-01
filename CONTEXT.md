# Brisa Dash

A centralized, controlled executive dashboard for Brisanet's commercial data, replacing ad-hoc PowerBI reports. It reads curated data from Databricks and presents it read-only to viewers; only the maintainer changes what the dashboard shows.

## Language

This glossary keeps Brisanet's business terms in their canonical Portuguese form (the ubiquitous language stakeholders actually use), with English definitions. Code identifiers and prose documentation are written in English; the UI is rendered in Portuguese.

## Roles

**Maintainer**:
The single person responsible for the dashboard — owns the code, configuration, and what indicators are shown. The only one who can "change things" (deploy, reconfigure). This is the project author.
_Avoid_: admin, owner, user.

**Viewer**:
Anyone who opens the dashboard to read data (e.g. the director). Has no edit capability — the screen is read-only. Authenticated via Brisanet SSO at the Databricks Apps layer.
_Avoid_: user, client.

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

## Data & caching

**Watermark**:
A cheap signal of when the source last updated (e.g. `MAX(data)` or a load-control table). The cache key includes it, so cached data is served until the source actually advances.

**Auto-refresh flag**:
Configurable toggle. Off = lazy TTL refresh. On = a periodic watermark probe re-fetches heavy data only when the source has advanced.
