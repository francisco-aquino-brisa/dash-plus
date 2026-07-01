-- =============================================================================
-- Brisa Dash — permission store (níveis, setores, usuários, capabilities, grants)
-- =============================================================================
-- TARGET: the app-owned Postgres store (Lakebase on Databricks Apps).
-- This is READ-WRITE and belongs to the app.
--
-- ⚠️  DO NOT run this on the Databricks analytics catalogs. Those are READ-ONLY
--     (project hard rule). This DDL is Postgres; run it against Lakebase/Postgres.
--
-- See docs/adr/0004-role-and-sector-permissions.md for the design rationale.
--
-- Two permission axes:
--   • Feature visibility → capabilities granted to a nível or setor.
--   • Data scope         → each user's (escopo_tipo, escopo_valor) → a WHERE filter.
-- =============================================================================

BEGIN;

-- --- helper: keep `atualizado_em` fresh on UPDATE -----------------------------
CREATE OR REPLACE FUNCTION set_atualizado_em() RETURNS trigger AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- --- níveis: hierarchical rank / role (drives feature visibility) -------------
CREATE TABLE niveis (
  id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome         text        NOT NULL UNIQUE,
  descricao    text,
  criado_em    timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_niveis_upd BEFORE UPDATE ON niveis
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- --- setores: functional area (also drives feature visibility) ----------------
CREATE TABLE setores (
  id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome         text        NOT NULL UNIQUE,
  descricao    text,
  criado_em    timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_setores_upd BEFORE UPDATE ON setores
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- --- usuarios_app: app-managed layer over the SSO login -----------------------
-- Keyed by CPF (the SSO login). Adds nível/setor and the data scope.
-- Seeded initially from Databricks `cadastro_usuario` (the 5 current ADMINs).
CREATE TABLE usuarios_app (
  cpf          char(11)    PRIMARY KEY CHECK (cpf ~ '^[0-9]{11}$'),
  matricula    text,
  nome         text        NOT NULL,
  email        text,
  nivel_id     integer     REFERENCES niveis(id),
  setor_id     integer     REFERENCES setores(id),
  ativo        boolean     NOT NULL DEFAULT true,

  -- data scope: what this user's position lets them see (see ADR 0004)
  escopo_tipo  text        NOT NULL DEFAULT 'all'
                 CHECK (escopo_tipo IN ('all','gerencia','gerente','coordenador','supervisor')),
  escopo_valor text,       -- value from organograma_cidades; NULL only when escopo_tipo = 'all'

  criado_em    timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),

  -- 'all' scope has no value; every other scope must name a value
  CONSTRAINT usuarios_app_escopo_valor_ck
    CHECK ((escopo_tipo = 'all') = (escopo_valor IS NULL))
);
CREATE INDEX idx_usuarios_app_nivel ON usuarios_app(nivel_id);
CREATE INDEX idx_usuarios_app_setor ON usuarios_app(setor_id);
CREATE TRIGGER trg_usuarios_app_upd BEFORE UPDATE ON usuarios_app
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- --- capabilities: the manifest of gate-able UI units -------------------------
-- One stable key per screen/card/chart/table that can be hidden.
CREATE TABLE capabilities (
  key       text        PRIMARY KEY,            -- e.g. 'card:cidades.churn'
  label     text        NOT NULL,               -- human-readable, pt-BR
  tipo      text        NOT NULL CHECK (tipo IN ('screen','card','chart','table')),
  tela      text        NOT NULL,               -- owning screen: 'cidades' | 'vendas' | 'produtividade' | 'admin'
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- --- grants: which nível OR setor may see which capability --------------------
-- Exactly one of (nivel_id, setor_id) is set per row. A user's effective
-- capabilities = union of grants for their nível and their setor.
CREATE TABLE grants (
  id             integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  capability_key text    NOT NULL REFERENCES capabilities(key) ON DELETE CASCADE,
  nivel_id       integer REFERENCES niveis(id)  ON DELETE CASCADE,
  setor_id       integer REFERENCES setores(id) ON DELETE CASCADE,
  criado_em      timestamptz NOT NULL DEFAULT now(),

  -- exactly one subject (nível xor setor)
  CONSTRAINT grants_one_subject_ck
    CHECK ((nivel_id IS NOT NULL) <> (setor_id IS NOT NULL))
);
-- no duplicate (capability, subject) — partial indexes because NULLs are distinct
CREATE UNIQUE INDEX uq_grant_nivel ON grants(capability_key, nivel_id) WHERE nivel_id IS NOT NULL;
CREATE UNIQUE INDEX uq_grant_setor ON grants(capability_key, setor_id) WHERE setor_id IS NOT NULL;

COMMIT;

-- =============================================================================
-- SEED (examples — adjust the níveis/setores names to Brisanet's real ones)
-- =============================================================================
BEGIN;

INSERT INTO niveis (nome, descricao) VALUES
  ('Diretor',     'Visão executiva — vê tudo'),
  ('Gerente',     'Gerência'),
  ('Coordenador', 'Coordenação'),
  ('Supervisor',  'Supervisão'),
  ('Analista',    'Acesso operacional');

INSERT INTO setores (nome) VALUES
  ('Comercial'), ('Marketing'), ('Financeiro'), ('Operações');

-- Manifest of the current screens/components. Refine keys as components get wired.
INSERT INTO capabilities (key, label, tipo, tela) VALUES
  -- Cidades (components/dashboard)
  ('screen:cidades',           'Tela — Performance Cidades',       'screen', 'cidades'),
  ('card:cidades.kpis',        'Cidades — KPIs',                   'card',   'cidades'),
  ('chart:cidades.historico',  'Cidades — Histórico',              'chart',  'cidades'),
  ('chart:cidades.quartil',    'Cidades — Quartis (TAM)',          'chart',  'cidades'),
  ('table:cidades.negativas',  'Cidades — Cidades Negativas',      'table',  'cidades'),
  -- Vendas (components/sales)
  ('screen:vendas',            'Tela — Vendas · Canais',           'screen', 'vendas'),
  ('card:vendas.kpis',         'Vendas — KPIs',                    'card',   'vendas'),
  ('chart:vendas.pdu',         'Vendas — PDU',                     'chart',  'vendas'),
  ('chart:vendas.canais',      'Vendas — Análise de Canais',       'chart',  'vendas'),
  ('card:vendas.selecao-livre','Vendas — Seleção Livre',           'card',   'vendas'),
  -- Produtividade (components/produtividade)
  ('screen:produtividade',     'Tela — Produtividade',             'screen', 'produtividade'),
  ('table:produtividade.ranking','Produtividade — Ranking Vendedores','table','produtividade'),
  ('chart:produtividade.tam',  'Produtividade — TAM',              'chart',  'produtividade'),
  -- Admin
  ('screen:admin',             'Tela — Administração de acessos',  'screen', 'admin');

-- Example grants: Diretor and Gerente can open all three screens; only Diretor
-- reaches the admin screen. (Real grants are managed via the admin UI.)
INSERT INTO grants (capability_key, nivel_id)
SELECT c.key, n.id
FROM capabilities c
CROSS JOIN niveis n
WHERE c.key IN ('screen:cidades','screen:vendas','screen:produtividade')
  AND n.nome IN ('Diretor','Gerente');

INSERT INTO grants (capability_key, nivel_id)
SELECT 'screen:admin', id FROM niveis WHERE nome = 'Diretor';

COMMIT;
