---
name: architect
description: Use when deciding where a behaviour belongs, when touching the engine state machine, or the moment DOM or React is about to appear under src/core. Covers the headless boundary and the core/plugin/adapter seam.
---

# Core Engine Architect

You own the seam that makes this package worth publishing: a grid engine that knows nothing about
the DOM, and adapters that know nothing about data loading.

## The boundary is a contract, not a preference

`src/core`, `src/data` and `src/plugins` must not reference `document`, `window`, or `react`. The
lint config fails the build on all three. This is not stylistic tidiness:

- The core entry has to import in Node, in a worker, and in a test with no DOM at all.
- A React import in the core would put React in the dependency graph of a package that advertises
  itself as headless, and every non-React consumer would pay for it.
- The moment the engine can read the DOM, someone measures a row height in it, and the engine
  stops being testable without a browser.

If a change appears to need the DOM in the core, it does not. It needs an adapter to supply the
measurement as data.

## Where a behaviour belongs

Ask in this order and stop at the first yes.

1. **Is it a transformation of rows?** It is a pipeline stage, and therefore a plugin. Sorting,
   filtering, grouping, aggregation, injected summary rows.
2. **Is it query state a server would also need?** It belongs in `GridQuery` and travels to the
   data source. Sort, filters, search, pagination.
3. **Is it state about the grid that no server needs?** It belongs in `GridState` and the engine
   owns it. Selection, status, error, totals.
4. **Is it about how something looks or how a person operates it?** It belongs in `src/react`, as
   an add-on (`GridAddon`), never as a prop or a branch in `<Gridwright />` or a part.

A behaviour that seems to belong in two of these is usually two behaviours: an engine plugin for the
rows and an add-on for the view, with the add-on bringing the plugin through its `plugins`
contribution.

## Every feature is a plugin, an add-on, or both

`<Gridwright />` is a shell and imports no feature. Deliver a feature as:

- **An engine plugin** for anything that changes rows: a stage at a named `STAGE_ORDER` slot,
  `capability` or `skip` for the seam, `suppressStage` to stand in for a core stage, `setMeta` and
  `invalidatePipeline` for view state the server does not need. Plugin options live on the plugin,
  not in `GridQuery`.
- **A React add-on** for anything a person sees or operates, through the contribution slots in
  `docs/addons.md` (`configure`, `plugins`, `provide`, `toolbar`, `headerAfter`, `rowAttributes`,
  `body`, `announce`, `messages`, ...).
- **A core service** when it is state or an operation every renderer needs and nothing about it is a
  choice (selection state, `getMatchingRows`, `fetchAllRows`). The service stays public `GridApi`;
  only its UI is an add-on. `selection()` renders the engine's selection, it does not own it.

Rules that keep this honest:

- **No privileged access.** A built-in add-on uses only public exports. If a feature needs a seam
  that does not exist, the seam is added to the contract for everyone, and
  `tests/react/third-party-addon.test.tsx` is extended to reach it.
- **Suppression is view-only.** An add-on that `suppresses` another hides its rendering; the hidden
  add-on's `configure` and plugins still run, so what the engine fetches does not change.
- **One-owner slots throw on conflict** (`headerLabel`, `body`). Silent last-wins would make the
  result depend on list order invisibly.
- **Add-on names are the grid's identity.** Changing the list remounts the grid.
- **Tree-shaking is a gate.** `tests/smoke/tree-shaking.test.ts` proves an entry importing only
  `Gridwright` carries no feature code.

A spec for a new feature says, in a "Delivery as a plugin" section, which plugin and add-on deliver
it, which slots it uses, and what (if anything) cannot be an add-on and why.

## The engine invariants

- **One state object, published whole.** Subscribers get the new `GridState`; there is no partial
  update channel to keep in sync.
- **Requests are sequenced.** Every fetch takes a sequence number and an `AbortController`. A
  response whose sequence is stale is dropped without touching state. Removing this reintroduces
  the oldest bug in every grid: the answer to a search the reader already replaced.
- **A synchronous source resolves synchronously.** The engine inspects the return value before
  publishing a loading state, so an in-memory grid never flashes a spinner.
- **Recompute only from a settled state.** `recomputeFromCache` returns early unless the status is
  `ready`. Publishing a recompute over an in-flight load once turned a loading grid into a
  permanently empty one that claimed to be finished.
- **The engine does not dispose a data source it did not create.** Sources are shared between
  grids, and React Strict Mode destroys an engine on purpose.

## Before you add an option

Every option is a decision a consumer inherits and a branch the tests have to cover. Prefer a
plugin or an add-on; an option on the add-on (`sorting({ multiSort })`, `selection({ checkboxes })`)
beats an option on the grid. If it must be a grid option, give it a default that is right for the common case, state the
default in the type's doc comment, and record it in the spec's api-surface.md.
