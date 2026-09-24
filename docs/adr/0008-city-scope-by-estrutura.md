# City scope by coordenação and supervisão

Adds a second data-scope axis. **ADR 0004/0007** decide what a user may open;
`lib/auth/scope.ts` narrows the rows of facts that carry a person. City cubes
carry no person, so until now the Cidades screen was the one screen a permitted
user saw whole. This narrows it by city.

## Context

The RH hierarchy (`vw_hierarquia_rh`, 474 nodes) has no notion of which cities a
supervisão answers for — the business asked for a binding that we own. What the
RH does give is the shape to propagate it: `id_estrutura` is a materialized path
(`1.3.10.11.16`) and `codigo_local` is its last segment, unique across all 474
nodes and stable when a node is re-parented.

Numbers at the time of writing (verified against the warehouse):

- 299 supervisão nodes, 259 of them with people below; 65 coordenações, 25
  gerências funcionais, 6 executivas, 1 diretoria, 78 lideranças.
- 1.155 cities in the picker: `public_base_cidade` (2.339 rows, the registry)
  narrowed to the ones the cubes still move in the last three competências.
  The registry alone lists cities that were never operated, and the cubes repeat
  every registered city per competência whether it has customers or not.
- 2.188 of 2.853 people in `vw_hierarquia` sit under a supervisão; 61 are
  gestores with supervisões below them. The remaining ~604 (inspeção
  operacional, administrativo) resolve to no city at all.
- 281 of the 299 supervisões hang under a coordenação; the other 18 hang
  straight off a gerência funcional.
- `vw_organograma_cidades` carries its own `gerencia`/`coordenacao` per city,
  and it answers the same question as this ADR with different numbers: 31
  coordenação names against 65 RH nodes, only 12 matching, and "AGILITY" (57
  cities) and "NOVOS NEGOCIOS" (64) are not RH nodes at all. It also covers only
  403 cities, leaving 521 cities with an active base unassignable. Nothing reads
  it any more — the registry is the city source, the RH tree is the structure.

## Decision

**Two levels bind, in one table: `tb_supervisao_cidades (codigo_local,
revan_cidade_id)`.** The coordenação holds the pool; the supervisões under it
split that pool. `codigo_local` already identifies any RH node, so a second
table would duplicate the read, write and resolution paths to encode a
distinction the RH already answers (`vw_hierarquia_rh.nivel`) — and Delta
enforces neither FK nor uniqueness, so the split would buy no guarantee either.
The pool rule lives in the write path, which is where it has to live in either
design.

**A supervisão may only take a city its coordenação holds.** Checked server-side
against the coordenação's state _after_ the same batch, so adding a city to the
coordenação and handing it to a supervisão in one save is legitimate.

**Node, never person.** The city belongs to the chair: replacing the supervisor
changes nothing, and the successor inherits with no re-cadastro.

**Propagation is the RH tree, read live, and the two directions are NOT
symmetric:**

- up — a gestor sees every city bound anywhere in a subtree they answer for, so
  a coordenador sees their pool plus what the supervisões hold (a subset);
- down — everyone else sees the cities of the **nearest bindable node above
  them, and only that node's**. Not the union of the ancestors: a promotor under
  an empty supervisão sees nothing, never the coordenação's pool, which belongs
  to the sibling supervisões too. Verified against the live tree.

The binding set is a few hundred rows, so `lib/auth/city-scope.ts` reads it
whole and runs the prefix logic in TypeScript instead of as an OR-chain in SQL.

**The 18 supervisões with no coordenação above are out of scope.** With no pool
to draw from they cannot be filled, so they are not listed and nobody below them
sees a city. If the business needs them, the RH tree is the place to fix it.

**Removing a city from a coordenação cascades to the supervisões below.** The
screen names the affected supervisões and asks; the cascade itself is recomputed
server-side on save, so a stale client cannot widen or narrow it.

**N:N, no uniqueness.** The RH itself splits Fortaleza, Caucaia, João Pessoa,
Campina Grande, Caruaru, Paulo Afonso, Mauriti and Marechal Deodoro across two
supervisões each. Only the exact (node, city) pair is deduplicated, via MERGE.

**No binding means no city.** An admin (or `escopo_tipo = 'todos'`) is
unrestricted; everyone else with an empty resolution sees the "nenhuma cidade
atribuída" state, never the full dataset. A warehouse failure resolves the same
way — the gate fails closed.

**The Cities dashboard reads the structure from here too.** Its Gerência and
Coordenação filters used to be the cubes' own columns, which carry the
organograma taxonomy (31 coordenação names, 1.927 cities as "-"). They are now
gerência → coordenação → supervisão → cidade from `tb_supervisao_cidades` over
the RH tree, cascading in both directions like the HC Zerado panel, multi-select,
each option showing the node's responsável under its name. The same names feed
the Quadrantes and Negativos panels, so the screen speaks one taxonomy.

Two rules keep that honest:

- The filter is a **dataset narrowing**, not a row predicate — `codigo_local`
  lives in the bindings, not in the cube rows, and a city may hang off more than
  one node, so a multi-bound city answers to each of them
  (`cidadesDaEstrutura` + `applyEstrutura`).
- The **label** written onto each record is single-valued (a record is one
  city × tecnologia × mês), so a multi-bound city is grouped under the first
  path in name order. The intended model is one coordenação per city.

An unbound city keeps its rows and its Cidade filter entry, and groups under
"Não registrado" — which today is nearly every city, since the bindings table
has just started being filled.

## Consequences

**Rollout is ordered, and the order matters.** `tb_supervisao_cidades` exists
in the warehouse since 2026-09-22 (`codigo_local STRING`, `revan_cidade_id INT`,
`criado_por`, `criado_em`, `atualizado_em`; `id` is IDENTITY). The gate bites the
moment the code ships: every non-admin with the Cidades page sees the empty state
until their branch is filled. Fill the 65 coordenações, distribute to the 281
supervisões in `/admin/cidades`, then release.

**The admin screen is a transfer list with a tab per level and two pivots.**
The tab picks coordenação or supervisão; "Por responsável" lists nodes, their
cities and the available ones, "Por cidade" flips it. Every combination writes
the same row, so they all produce one unit of change — a (node, city) pair with
a direction — and the screen holds those as a delta over the server state until
"Salvar". One save is one MERGE plus one DELETE; saving each arrow click instead
would be one Delta commit per click.

**The table name is now narrower than what it holds** — it carries coordenação
bindings too. Renaming it is a one-line ALTER plus the constant in
`lib/data/admin/tables.ts`; cheap now, expensive once the 65 pools are filled.

**The cache stays global.** `getCityDataset` still fetches and caches one
dataset for everyone; `getScopedCityDataset` slices it in memory per request.
Keying the cache by scope would refetch ~93k rows per distinct scope for nothing.

**The picker cannot bind a city the dashboard does not measure.** The pool is
the registry intersected with the cubes' last three competências (any base,
sale, install or HP); the write path re-checks it. A city outside it would grant
an empty dashboard to whoever received it, and one that goes quiet keeps its
binding — the check runs on write, not on read.

**Resolution costs two extra round-trips per request** for a restricted reader
(the managed nodes and their own positions, then the cities), memoized per
request with `cache()`. Admins short-circuit before any query.
