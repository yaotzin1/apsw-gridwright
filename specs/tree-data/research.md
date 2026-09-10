# Research: Tree data

## The contradiction in the request

Nested set identifies a node by an interval `(left, right)`, and ancestry is
`a.left < b.left && b.right < a.right`. That works because a node sits inside exactly one parent's
interval. A node with two parents cannot have one interval pair.

Three ways out were put to the requester.

### Option A — Placements (chosen)

A row may be placed at many points. Each placement is a node with its own interval, depth, path and
expansion state; all of them share one `rowId` and one row object.

**Chosen because** the nested set stays exact, arbitrary graphs work, and the semantics match what
people already understand from a file manager showing a hardlink in two folders. Editing the row
reaches every placement, because there is one row. Expanding reaches one, because there are two
positions.

**Cost.** A subtree under a doubly-placed row is materialised twice, so a node under N ancestors
each placed M ways multiplies. Cycles must be detected on the path rather than by a visited set,
because revisiting a row legitimately happens.

### Option B — Closure table

Store edges plus a transitive closure. One node per row, a true graph.

**Rejected because** it loses the interval arithmetic entirely: ancestry becomes a lookup, subtree
size becomes a count, and the flat display order still needs a chosen parent, which is Option A
wearing a different hat. It also contradicts the explicit request for a nested set.

### Option C — Single parent only

**Rejected because** it drops a capability that was asked for.

## Nested set on the client

Nested set is usually argued for in SQL, where it turns a recursive descendant query into one range
scan. On a client the argument is different and, here, stronger:

- The interval order **is** the render order. A tree grid's core job is producing a flat list in
  depth-first order, and the model produces it as a by-product.
- Filtering a tree needs "does this node have a matching descendant", which is an interval
  containment test.
- Subtree size, needed for the child count and for the announced label, is arithmetic.

The cost is that inserting or moving invalidates the intervals of everything to its right. Measured
against rebuilding: the index is rebuilt in O(n) on every mutation, which for the sizes a client
holds is faster than patching intervals and much easier to reason about. Recorded here so nobody
optimises it without a number.

## Where expansion lives

Grid state was rejected: it is not a query facet, no server needs it, and putting it there would
mean a fetch on every toggle. A plugin's closure was chosen, with `invalidatePipeline()` added to
the engine so a toggle recomputes without asking the source again.

That method is the only engine change the whole feature needed, which is the strongest evidence
that the seams were already in the right places.

## Wrapping rather than extending

Two candidate designs for making the grid's rows into nodes:

1. **A parallel metadata channel**: stages return rows plus per-row metadata, and the engine
   attaches it. **Rejected**: pagination slices the rows, and the parallel array desynchronises
   unless every stage knows to slice it too.
2. **Wrapping at the two existing seams**: a data source wrapper produces nodes, a stage flattens
   them. **Chosen**: no engine change, and both seams are ones the extensibility document already
   documents as the supported way to do this.

The consumer never sees the wrapper, because `useTreeGridwright` rewrites the columns so accessors
and renderers keep receiving the row.

## Measurements

Unminified ESM output.

| Bundle | 0.2.0 | 0.3.0 |
| :--- | ---: | ---: |
| core + shared chunk | 43.5 kB | 67.2 kB |
| `dist/react/index.js` | 20.7 kB | 41.8 kB |
| `dist/locales/index.js` | 4.3 kB | 5.7 kB |

The tree is roughly 24 kB in the core and 21 kB in the adapter, which is more than the feature
looks and worth stating plainly. It is tree-shakeable: a consumer who never imports
`TreeGridwright`, `createTreeController` or `buildTreeIndex` does not carry any of it, and the
package declares no side effects outside the stylesheet, so a bundler can prove that.

Whether the adapter should be a fourth entry point, the way the locales are, is an open question.
It would make the saving automatic rather than dependent on the bundler, at the cost of another
published path.

## Open questions

- Whether a `POST`-stage virtualizer can windows a flattened tree without the engine knowing.
  Probably yes, since flattening already produces a plain list.
- Whether cascading selection should ship with an opt-in flag. Deliberately deferred until someone
  asks for a specific one of the two defensible behaviours.
