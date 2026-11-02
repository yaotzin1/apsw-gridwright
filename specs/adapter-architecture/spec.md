# Specification: framework-neutral adapter architecture

> **Status**: Stages 1 to 5 written 2026-10-31 (analysis in plan.md). Approved by the maintainer 2026-11-02 ("start to work on it, with full tests"); OPEN items resolved below. Implementation in progress.
> **Stage entry**: 1
> **Track**: feature
> **Semver impact**: `apsw-gridwright` minor (a new headless entry, new exports; nothing existing changes
> shape or default). Provisional; confirmed in api-surface.md.
> **Replaces**: an earlier draft of this day, `angular-adapter`, which built one Angular component. The
> maintainer's goal is the architecture that makes Angular, Vue, Svelte, Solid or a web component
> possible, not any one of them, so that draft was deleted and no adapter is built here.
> **Stop-and-report on C-4 (2026-11-02, found while implementing T-04/T-05)**: `GridAddon<TRow>` cannot become an alias of
> `ViewAddon<TRow, ReactNode>` without a breaking type change. Beyond the slot return type, today's contract is typed in
> React terms: `tableKeyDown` takes React's `KeyboardEvent<HTMLTableElement>` and `ContributedAttributes<E, A>` carries
> React-typed handlers (`onClick: MouseEventHandler`). An existing add-on that reads `e.currentTarget` would stop
> compiling if those became structural, which breaks US-04 and AC-08. Proposed instead: `GridAddon` stays exactly as it
> is, `ViewAddon` is a separate neutral contract, and the React renderer **adapts** a `ViewAddon` into a `GridAddon`
> (C-7 already requires accepting both). Work that does not depend on this (T-05 to T-08) proceeds; T-09 onward waits for
> the maintainer.
> **Workflow change**: the architecture text in `workflow.ai.yml` changed in the first commit of this
> branch (C-8, T-01).

---

## 1. The consumer problem

The engine is headless. The grid is not. Everything between the engine and the pixels (what a header
cell is, which attributes it carries, what a sort control does on a key press, what the live region
says, how add-ons are ordered and suppressed) lives in `src/react/` and is typed in React's terms.
A second framework would have to rewrite all of it, and two rewrites drift.

Measured on 2026-10-31 in `src/react`:

- **The accessible behaviour is mostly pure logic with a React coat.** `sorting-logic.ts`,
  `pagination-logic.ts`, `announcement.ts`, `addons/resolve.ts` import no React runtime. But they sit
  under `src/react/` and are exported from `apsw-gridwright/react`, which imports React when it loads,
  so a non-React application cannot reach them.
- **The add-on contract is React-shaped.** `AddonContribution` slots return `ReactNode`; attribute
  hooks are typed over `HTMLAttributes`, `ThHTMLAttributes` and React's `KeyboardEvent`; `setup` calls
  hooks. `sorting()` is neutral logic plus a `SortButton` that is JSX.
- **Add-on state is held in React hooks.** 36 files under `src/react` call `useState`, `useRef`,
  `useMemo`, `useEffect` or `useSyncExternalStore`. That state (which rows are open, the selection, a
  panel) belongs to the feature, not to React.
- **The shell decides the table's structure** (header cells, rows, extra columns, status rows, windowed
  gaps, `aria-rowindex`) inside JSX, so the structure itself cannot be tested without a renderer or
  reused by another one.

What is wanted: a **headless view layer** between the engine and any renderer, so that a new framework
needs a thin renderer and nothing else, and a **conformance kit** that proves a renderer behaves like
the others. React becomes the first renderer of that layer instead of the owner of it.

## 2. User stories

- **US-01.** As the maintainer, I add a Vue (or Angular, Svelte, Solid, custom-element) adapter by
  writing a renderer for one small node description and a binding for one store type, without touching
  an add-on.
- **US-02.** As the maintainer, I fix a sort announcement or a focus rule once, and every adapter has
  it.
- **US-03.** As a third-party author, I write an add-on once, in neutral terms, and it works in every
  adapter that renders the node kinds it uses.
- **US-04.** As a React consumer, nothing changes: same exports, same markup, same behaviour, same
  bundle shape.
- **US-05.** As a maintainer, I run one conformance suite against any adapter and see which behaviours
  it does not yet satisfy.
- **US-06.** As a security reviewer, there is one place where element tags and attributes are
  allowlisted, instead of one per framework.

## 3. Acceptance criteria

- [ ] **AC-01** A new headless entry, `apsw-gridwright/view` (C-1), imports with no React, no DOM and no
      framework installed, and is covered by the existing lint ban on `document`, `window` and `react`.
- [ ] **AC-02** The **node description** (C-2): a plain-data tree of `element`, `text`, `fragment`,
      `slot` and `component` nodes. Tags and attributes are an allowlist. There is no HTML string kind,
      no raw-markup kind and no function-as-child. Handlers are named events with a structural event
      type (C-3).
- [ ] **AC-03** The **neutral add-on contract** `ViewAddon<TRow, TNode>` (C-4) is the React contract with
      three changes: slots return `TNode`, DOM types become structural types, and state comes from
      stores (C-5) instead of hooks. Ordering, `requires`, `suppresses`, `after`/`before`, narrow
      variants and ownership rules are unchanged and implemented once.
- [ ] **AC-04** **Stores** (C-5): `createStore(initial)` with `get`, `set`, `subscribe` and `update`,
      about 30 lines, no dependencies. An add-on that has state creates it in a `setup` that runs once
      per grid. Each adapter binds a store to its reactivity in one function (`useStore`, `toSignal`,
      `toRef`, a rune).
- [ ] **AC-05** The **table model** (C-6): `buildTableModel(grid, contributions)` returns the header
      cells, body rows, extra columns, status rows, windowed gaps and the attribute maps merged by the
      existing `mergeAttributes` allowlist, including `aria-rowcount`, `aria-rowindex`, `aria-sort`
      and `aria-selected`. A renderer walks it and creates elements; it decides nothing.
- [ ] **AC-06** **Behaviour moves with the model**: sort activation, selection key handling, page-change
      focus, the live-region sentence, cell-cursor movement and clipboard text are functions of
      `(state, event) -> action` in the view layer. A renderer forwards DOM events as structural events
      and applies the returned action.
- [ ] **AC-07** `apsw-gridwright/react` is rebuilt as a renderer of the view layer. The three core
      add-ons (`sorting`, `selection`, `pagination`) are the proof: written once in neutral terms, run by
      React through the renderer, and their existing React tests pass **unchanged**.
- [ ] **AC-08** Every other React add-on keeps working as it does today, through a compatibility path
      (C-7): a React add-on is a `ViewAddon<TRow, ReactNode>`, so it needs no edit until it is migrated.
      Migration is per add-on and not part of this spec's acceptance.
- [ ] **AC-09** **Conformance kit** `apsw-gridwright/conformance` (C-9): a driver interface
      (`mount`, `query`, `press`, `click`, `text`, `focused`) and a suite of scenarios written against it.
      React runs it in this repository. A future adapter implements the driver and runs the same suite.
- [ ] **AC-10** `npm run check:exports` fails if a view-layer bundle references `react`, `react-dom`, or
      any `@<framework>/`; and fails if the React and view entries stop sharing one module instance
      (`splitting: true` stays, and the packaging audit covers the new entry).
- [ ] **AC-11** No per-row cost regression: the table model is built with the allocation discipline of
      `.agents/rules/performance.md` section 8, and a benchmark on the 10 000-row and 500-column fixtures
      shows the React render no slower than before by more than measurement noise.
- [ ] **AC-12** `docs/adapters.md` documents how to write an adapter: the renderer, the store binding,
      the driver, the order to get the conformance suite green.

## 4. Non-goals

- **No Angular, Vue, Svelte or Solid adapter is built here.** Not even a skeleton. The criterion for the
  architecture is that the conformance kit and a second, throwaway renderer in a test (a string renderer
  producing text, C-10) can run it, not that a framework package exists.
- **No migration of the feature add-ons** (filters, export, tree, grouping, virtualization, column layout,
  density, row detail, row actions, editing, view-state sync, responsive, loading, `wcag()`). Each gets
  its own spec after the contract is proven by the three core add-ons.
- **No Web Components as the strategy.** One custom element wrapping a React grid is a different product
  (shadow DOM breaks the shared stylesheet). A custom-element adapter would be another renderer.
- **No virtual DOM, no diffing, no reconciler.** The node description is a plain value a renderer maps
  to its framework's own nodes; each framework already reconciles.
- **No change to the engine, the pipeline or the data sources.**
- **No new runtime dependency.**
- **No change to React rendered markup or class names.** The markup is the contract the stylesheet and
  the MUI package rely on.
- **No attempt to make framework-native cell renderers neutral.** A consumer's cell is written in their
  framework (C-2, `component` nodes). The neutral layer only places it.

## 5. Behaviour across the capability seam

Unchanged. The view layer sits above the pipeline and reads `state.status`, `rows`, `total`,
`isTotalExact`. It computes no count; "of many" is produced exactly where it is now.

## 6. Accessibility and interface copy

This is where the architecture pays: the ARIA grid pattern, `aria-sort`, `aria-rowcount`/`aria-rowindex`,
the live region and focus-after-page-change are produced by the view layer, so they are identical in
every adapter by construction, and the conformance kit asserts them per adapter. Strings stay in
`labels` and add-on messages; the translator and locale packs are already framework-free.

## 7. Delivery as a plugin

No engine plugin. The view layer is a new headless entry; React is its first renderer. Add-ons remain
add-ons; the contract they are written against becomes renderer-independent.

## 8. Clarifications

Items were marked **OPEN** for the maintainer; all three were resolved on 2026-11-02.

- **C-1. Where it lives.** A new entry `apsw-gridwright/view` (source `src/view/`) with its own export
  map entry, `.d.cts` types and smoke coverage. Not in the root entry, so importing the engine stays as
  small as it is. **Resolved 2026-11-02**: `view`.
- **C-2. Node description.** Data, not a framework tree:

  ```ts
  type ViewNode =
    | { kind: 'element'; tag: AllowedTag; attrs?: Attrs; on?: Handlers; children?: ViewNode[]; key?: string }
    | { kind: 'text'; value: string }
    | { kind: 'fragment'; children: ViewNode[] }
    | { kind: 'slot'; name: string }                   // a place a consumer's content goes
    | { kind: 'component'; id: string; props?: unknown } // adapter-resolved, for rich native content
  ```

  `component` is the escape hatch: a consumer cell or an add-on view that needs framework features is
  registered per adapter by id. An add-on that uses one declares it, and the conformance kit reports it
  as "needs a registration" rather than failing. **Resolved 2026-11-02**: the type includes `component`, but the three core add-ons must not use it. The
  T-12 checkpoint is only a test of the node description if they manage without.
- **C-3. Events.** A handler receives a structural event (`{ key, shiftKey, ctrlKey, metaKey, altKey,
  button, targetId?, preventDefault() }`) and returns an action or void. The renderer builds the event
  from the native one. No DOM type is imported into the view layer.
- **C-4. Contract generics.** `ViewAddon<TRow, TNode = ViewNode>`. React exports
  `type GridAddon<TRow> = ViewAddon<TRow, ReactNode>`, so no React signature gains a type parameter
  (an earlier draft rejected genericity because it would add one; an alias avoids that).
- **C-5. State.** Stores replace hooks in neutral add-ons. `setup` runs once per grid instance, not per
  render, so a store is created once. The React compat path keeps calling hook-using `setup` per render
  (C-7). Strict Mode's engine rebuild is a React binding concern and stays in the React binding.
- **C-6. Table model.** Built per state change, memoised on `(state, contributions, window)`. Row
  models are produced lazily for the rows the renderer asks for, so virtualization keeps its cost.
- **C-7. Compatibility.** The React renderer accepts both a neutral add-on and a legacy React add-on,
  detected by a brand on the neutral ones. No existing add-on or third-party add-on needs a change.
- **C-8. Rules that change.** `workflow.ai.yml` "one adapter (src/react)" and "Rendering belongs to the
  adapter" become: the headless view layer renders nothing; each adapter owns its renderer. Landed as
  its own commit with `Workflow-Change:` after approval. Packaging of a future adapter (workspace or
  separate repo) is **not** decided here and is not needed to proceed.
- **C-9. Conformance kit.** Ships as `apsw-gridwright/conformance`, a dev-time entry. **Resolved 2026-11-02**: a published entry,
  because an adapter author outside this repository has nowhere else to get it.
- **C-10. Second renderer in tests.** A string renderer (`ViewNode` to indented text) runs the
  conformance scenarios without a DOM. It proves the layer is renderer-independent and doubles as a
  cheap regression test of the table model.
- **C-11. Order.** Thin vertical slice first: stores, node description, sorting add-on through the
  renderer, conformance harness with one scenario. Only then the table model, selection, pagination.

## Artifacts not written

- `events.md`: no engine event is added and no pipeline stage; the structural UI event is in api-surface.md.
- `data-model.md`: engine state is unchanged; the node and model shapes are in api-surface.md.
