# Research: Gridwright core

## Options considered

### Option A — One component with a `serverSide` boolean

**How it works.** The grid takes rows and a flag. When the flag is set, it calls a callback instead
of sorting locally.

**Rejected because** the flag multiplies through every feature. Each of sorting, filtering, search
and pagination has to ask it, the two paths diverge, and the server path gets less testing because
the demo uses an array. It also cannot express the common real case: an endpoint that pages but
does not sort.

### Option B — Separate `LocalGrid` and `RemoteGrid` components

**How it works.** Two components, two prop sets.

**Rejected because** it makes the migration from one to the other a rewrite, which is the exact
problem this package exists to remove. It also doubles the surface to document and test.

### Option C — Capability negotiation between a data source and a pipeline

**How it works.** A data source declares which query facets it resolved. The pipeline applies the
rest. Nothing above the pipeline knows the difference.

**Chosen because** it collapses the two paths into one, expresses partial capability naturally, and
makes the local case a data source that resolves nothing rather than a special case in the engine.
The cost is one indirection and the requirement that a source declare honestly, which understating
makes safe.

## Prior art

- **TanStack Table** established the headless split, and its `manual*` flags are Option A applied
  per feature. Capabilities are the same idea collected into one declaration, which lets a stage
  ask a single question rather than each feature reading its own flag.
- **AG Grid** row models are closer to Option B: a different model is a different product surface.
  Powerful, and a large migration cost between them.
- **MUI X DataGrid** couples the grid to a design system. Excellent inside that system; the reason
  this package ships tokens instead.

## Decisions worth recording

- **Column value typing.** `ColumnValue` is `any` in exactly one place. `unknown` cannot type a
  heterogeneous column array under `strictFunctionTypes`: a comparator declared for numbers is not
  assignable to one declared over `unknown`, so every typed column is rejected by the array holding
  it. Every published grid library reaches the same conclusion.
- **Code splitting.** `splitting: true` in tsup, so both entries import one shared chunk. Without
  it each entry carries its own copy of the engine and `instanceof GridwrightError` fails across
  the seam while every test still passes. The packaging audit checks the module identity directly.
- **Synchronous fast path.** The engine inspects the data source's return value before publishing a
  loading state. A local grid therefore renders its first page on the first paint. The cost is one
  `typeof value.then` check per fetch.

## Measurements

No performance claim is made in 0.1.0, so none is recorded. The pipeline's shape is chosen for
correctness of ordering: filter narrows before sort orders, and paginate slices last so the total
counts matches. Any future change justified by speed carries a number here.

## Open questions

- Should `matchesFilter` semantics be published as a document a server can implement against? The
  operators are already deliberately small and serialisable for that reason, but no reference
  implementation is offered yet.
- Whether a virtualization plugin can be written entirely as a `POST` stage plus adapter state, or
  whether it needs a row-height channel through the engine. Deciding it will settle whether the
  stage vocabulary is complete.
