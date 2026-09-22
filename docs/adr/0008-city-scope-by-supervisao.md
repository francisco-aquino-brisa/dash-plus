# City scope by supervisão

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
- 403 cities in the current `vw_organograma_cidades` load — the operated ones.
  The dimension (`public_base_cidade`) has 2.339 and the cube repeats all of
  them per competência, so neither is the right pool for the picker.
- 2.188 of 2.853 people in `vw_hierarquia` sit under a supervisão; 61 are
  gestores with supervisões below them. The remaining ~604 (inspeção
  operacional, administrativo) resolve to no city at all.
- 227 supervisões are named after the city they cover ("CIDADE - PAULO
  AFONSO/BA 2"), which is what makes filling the screen by hand tractable.

## Decision

**The binding is `tb_supervisao_cidades (codigo_local, revan_cidade_id)` — node
to city, never person to city.** The city belongs to the chair: replacing the
supervisor changes nothing, and the successor inherits the cities with no
re-cadastro. The admin still picks a supervisão by name, and the person's name
is shown only to identify it.

**Propagation is the RH tree, read live, in both directions.** A reader's cities
are those bound to any node that is (a) inside a subtree they answer for — the
gerente/coordenador case — or (b) an ancestor of a position they occupy — the
promotor case. Both are prefix tests on `id_estrutura`, so the whole resolution
is one query, in `lib/auth/city-scope.ts`. Since only `nivel = 'supervisao'`
nodes can be bound, "nearest ancestor" and "union of ancestors" are the same
rule and no choice between them has to be encoded.

**A node that leaves the RH load frees its cities.** The resolution joins the
current `data_carga`, so a binding to an extinct node stops matching and grants
nothing; the admin screen lists those as órfãos so they can be cleared. Note
this keys on the NODE, not the person: a supervisor being replaced does not free
anything.

**N:N, no uniqueness.** The RH itself splits Fortaleza, Caucaia, João Pessoa,
Campina Grande, Caruaru, Paulo Afonso, Mauriti and Marechal Deodoro across two
supervisões each, so a city may answer to more than one node. Only the exact
(node, city) pair is deduplicated, via MERGE.

**No binding means no city.** An admin (or `escopo_tipo = 'todos'`) is
unrestricted; everyone else with an empty resolution sees the "nenhuma cidade
atribuída" state, never the full dataset. A warehouse failure resolves the same
way — the gate fails closed.

## Consequences

**Rollout is ordered, and the order matters.** The gate bites the moment it
ships: until `tb_supervisao_cidades` exists (DDL in
[docs/ddl/tb_supervisao_cidades.sql](../ddl/tb_supervisao_cidades.sql), needs
ALL PRIVILEGES) and is populated, every non-admin with the Cidades page sees the
empty state. Create the table, fill the 299 supervisões in `/admin/cidades`,
then release.

**The admin screen is a transfer list with two pivots.** "Por responsável"
lists supervisões, their cities and the free ones; "Por cidade" lists cities,
their responsáveis and the free ones. Both write the same row, so both produce
the same unit of change — a (node, city) pair with a direction — and the screen
holds those as a delta over the server state until "Salvar". One save is one
MERGE plus one DELETE; saving each arrow click instead would be one Delta commit
per click.

**The cache stays global.** `getCityDataset` still fetches and caches one
dataset for everyone; `getScopedCityDataset` slices it in memory per request.
Keying the cache by scope would refetch ~93k rows per distinct scope for nothing.

**The picker cannot bind a city outside the organograma.** Cities absent from
`vw_organograma_cidades` have no gerência either, so nobody owns them — they
stay visible only to admins.

**Resolution costs two extra round-trips per request** for a restricted reader
(the managed nodes and their own positions, then the cities), memoized per
request with `cache()`. Admins short-circuit before any query.
