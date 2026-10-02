# City binding at any level of the RH tree

Supersedes the "two levels bind" and "the 18 supervisões with no coordenação
above are out of scope" parts of [ADR 0008](./0008-city-scope-by-estrutura.md).
Everything else there stands.

## Context

The business has city owners outside the coordenação → supervisão pair. The case
that surfaced it: the gerências funcionais COMERCIAL REGIONAL B2C 05 and 11 have
no coordenação, so their supervisões (Jeremoabo, Paulo Afonso, Pontalina…) hang
straight off the gerência. `vw_hierarquia` fills `coordenacao` with the
gerência's own name there, but `vw_hierarquia_rh` has no coordenação node.

It is not an exception, it is the shape of the tree (current load, verified):

| child ← parent                      | nodes |
| ----------------------------------- | ----- |
| supervisão ← coordenação            | 280   |
| supervisão ← gerência funcional     | 19    |
| coordenação ← gerência funcional    | 62    |
| coordenação ← diretoria / executiva | 3 + 3 |
| liderança ← coordenação             | 35    |
| liderança ← supervisão              | 46    |

Any rule tied to named levels breaks somewhere else in this tree.

## Decision

**Every level but liderança binds** (`BINDABLE_LEVELS` in
`lib/data/estrutura-sql.ts`). `tb_supervisao_cidades` needs no change —
`codigo_local` already identifies any node.

**A node may only take the cities of the nearest node above it that holds
any.** Empty nodes in between are skipped, so a supervisão under an empty
coordenação draws from the gerência. With nothing bound above, the node is a
root and may take any operated city.

**Visibility down is unchanged: the nearest bindable node wins, even when
empty.** The business chose this over letting an undistributed pool flow down:
a promotor under an empty supervisão sees nothing, never the pool above.
Liderança stays out of the bindable set precisely so that an empty liderança
does not hide its supervisão's cities from the team.

**Removing a city cascades to every node below, at any depth**, not only the
direct children.

**Filling an empty node must cover what is already bound below it.** It becomes
the pool of those nodes, so the save refuses otherwise; the screen offers to
include those cities in one click.

The save replays the batch over the whole binding set and the tree (both are a
few hundred rows) and diffs, so every rule is checked against the state after
the batch, on the server. `lib/data/admin/tree-pool.ts` holds the rules,
pure, so the screen previews exactly what the server enforces.

## Consequences

**The admin screen is a tree**, not a tab per level: the node on the left, its
cities and the available ones on the right, with where the pool comes from.
The tree stops above supervisão — users found the extra level hard to read —
so a supervisão gets its cities from its parent, through the per-city
"who below answers for it" dialog, or from "Por cidade", which lists every
node holding the city and every node that may receive it.

**The Cities dashboard filters keep gerência → coordenação → supervisão.** Each
binding is read off the ancestors of its node; a level the path does not have is
null. A gerência pool therefore shows under its gerência with no coordenação.

**The 19 supervisões under a gerência are now bindable**, and so are the nodes
above coordenação. Nobody gains a city until one is bound — existing bindings
keep meaning what they meant.

**The table name is even narrower now.** Renaming it to `tb_estrutura_cidades`
is still one ALTER plus the constant in `lib/data/admin/tables.ts`.
