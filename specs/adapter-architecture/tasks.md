# Tasks: framework-neutral adapter architecture

Core first, renderer second, documentation last. Tests sit with each task. Nothing from T-02 starts
until the maintainer approves the spec and answers the OPEN items (C-1, C-2, C-9).

## Gate

- [x] **T-01** Approval, then `workflow.ai.yml` architecture lines (C-8), `node scripts/sync-agent-docs.mjs`,
      commit `Track: chore` with `Workflow-Change: framework-neutral view layer`.

## Foundations (no behaviour change)

- [x] **T-02** Baseline: record render time and allocations for the 10 000-row and 500-column fixtures, and
      snapshot the rendered markup of the React grid for the cases in tests/react. Commit the numbers
      into research.md. (AC-11, section 4 of api-surface)
- [x] **T-03** Lint and audit: extend the headless ban and `security-audit.mjs` to `src/view` and
      `src/conformance` (empty directories with a placeholder test), and prove the rule fires with a fixture.
- [~] **T-04** Structural types: `ViewEvent`, `ContributedAttributes` without React, `Attrs`. Move
      `mergeAttributes` and the allowlist to `src/view/attributes.ts`; React re-exports. Existing tests unchanged.
      **Done 2026-11-02**: `ViewEvent`, `viewEvent`, `mergeAttributes` and the allowlist moved, React re-exports the same
      function objects (identity test). **Not done**: a neutral `ContributedAttributes` type, which waits on the C-4 decision (see
      the stop-and-report in the status line of spec.md).
- [x] **T-05** Move `resolve.ts` (ordering, suppression, narrow variants, ownership) to `src/view`, generic
      over `TNode`; React re-exports. A type test compiles an add-on written against today's `GridAddon`.
- [~] **T-06** Move the sorting, selection, pagination and announcement functions to `src/view/behaviour`;
      `/react` re-exports the same names. `selectionKeyDown` takes `ViewEvent`.
      **Done 2026-11-02**: sorting, pagination, `announcementFor` and `pageSelectionOf`. **Not done**: the DOM-reading parts of
      selection (`selectionKeyDown`, the row-click guard), which call `closest`, `getSelection` and `cellControlOf`; they
      need a structural description of the event target, designed in T-15. The spec's 2026-10-31 measurement missed this
      because the file imports React types only.

## The vertical slice

- [x] **T-07** `createStore`, with tests for `get`, `set`, `update`, unsubscribe and listener reentrancy.
- [x] **T-08** `ViewNode`, `h`, and the string renderer; tests that an element, text, fragment and slot
      render, and that a tag or attribute outside the allowlist is dropped and reported.
- [x] **T-09** `ViewAddon`, `defineAddon`, `VIEW_ADDON`, `isViewAddon` (`src/view/addon.ts`). **Changed 2026-11-02, approved
      by the maintainer**: `GridAddon` is *not* an alias (C-4); it stays as it was, and `ViewAddon` is a separate neutral
      contract. The contribution holds six fields so far (`headerLabel`, `headerAttributes`, `announce`, `messages`,
      `suppresses`, `navigation`) and grows, additively, with each add-on that migrates.
- [x] **T-10** React renderer: `renderNode` with a public `component` registry (`src/react/view/render-node.tsx`) and
      `adaptViewAddon` (`src/react/view/adapt.tsx`), which `orderAddons` applies so one list holds both kinds. Tests: a neutral
      add-on and a legacy add-on in one grid; React and the text renderer draw one description identically.
      **Not done**: store binding in `useGridwright` (no neutral add-on has per-grid state yet; see the checkpoint note).
- [x] **T-11** Neutral `sorting()` (`src/view/addons/sorting.ts`); the React `sorting()` is now that add-on, adapted. The
      existing sorting, multi-sort, `aria-sort`, header-row navigation and live-region tests pass **unchanged**, and the
      five markup snapshots are identical.
- [x] **T-12** Compare the markup snapshot and the baseline. **Checkpoint**: stop and review with the
      maintainer; answer research question 1. Expand only if the node description held without `component`.
      **Reached 2026-11-02; findings for the review, in `review.md` section "T-12 checkpoint".**
      **Closed 2026-11-03, maintainer said go.** Question 1 answered: the description holds for what built-ins author;
      `component` is for consumer content in the adapter's framework. Per-grid state (`state(key, initial)`) stands.
      Open item 3 (the neutral contract mirroring the React one slot for slot) is accepted on the condition that each
      slot is added only when a migrating add-on needs it, and that an add-on needing React state or context may
      stay React-only (decided per add-on, recorded under Known gaps).

## Conformance

- [x] **T-13** `ConformanceDriver`, the suite (`conformanceSuite(driver, { describe, it }, { skip })`, runner-agnostic so the
      published kit needs no test library), and six sorting scenarios; run by the React driver (Testing Library,
      `tests/helpers/react-conformance-driver.tsx`). **Moved to T-14**: the string-renderer driver, which needs a table model
      to draw a grid at all. Also done 2026-11-02: per-grid state (`context.state(key, initial)`, `createStateScope`), the
      maintainer's choice at the T-12 checkpoint.

## Table model and the other core features

- [~] **T-14** `buildTableModel` with a lazy `row(index)`, `tableNode(model)`, and `createGridHost` (the headless
      counterpart of `useGridwright`). **Done 2026-11-02**: the model covers the root, live region, table, header and
      body (rows, loading, empty, error); rows are built on request (a test counts reads); the string-renderer driver
      (`tests/helpers/node-conformance-driver.ts`, a Node environment with no DOM) passes all six sorting scenarios, and a
      parity test compares the React shell's DOM with the model's drawing line by line in five states. The logic the
      shell and the model share moved to `src/view` (`rowNumbering`, `bodyStatusOf`, `labelsFrom`, `createLiveRegion`),
      and the React hook and parts use it; `a11y-axe`, `accessible-state` and `gridwright.test.tsx` pass unchanged.
      **Not done, deliberately**: the React shell does not draw *from* the model. It supports column windows, extra
      columns, custom rows, `rowAfter`, a footer and wrapper refs, none of which the neutral contract can express yet, so
      switching it over would drop features. It shares the logic instead. **Go/no-go: go** for the core path, see review.md.
- [ ] **T-15** Neutral `selection()` including the indeterminate select-all (research question 2).
      Contract written 2026-11-03: api-surface.md section 1b. Order of work, each step green before the next:
      (a) `ViewEventOrigin` + the React adapter that builds it, and `rowClickSelects`/`spaceSelectsRow` in
      `src/view/behaviour/selection.ts`, with the React wrappers delegating (existing selection tests unchanged);
      **(a), (b), (c) and (e) done 2026-11-03; (d) is open.** (e) runs seven selection scenarios on the React driver; the
      Node driver skips them by name, with the reason in the test title, until (d) gives it a neutral `selection()` and an `origin` for its events. (b) the six slots in `ViewAddonContribution`, `adaptViewAddon` mapping them, `renderNode` setting `indeterminate`
      as a property, `cellControlTabIndex` on the render grid; (c) the model draws extra columns, attributes, handlers and
      toolbar; (d) neutral `selection()` and the React `selection()` becoming it; (e) conformance scenarios (select-all
      indeterminate, row click, Space on a cell, click on a control does not select) run by both drivers.
- [ ] **T-16** Neutral `pagination()`, including page size and focus-after-change (question 3).
- [ ] **T-17** Benchmarks against T-02. Over noise returns the plan to stage 3.

## Ship

- [ ] **T-18** Build, export map, `.d.cts`, `check-exports.mjs` (no `react` or `@*/` framework in view
      bundles, one module instance), smoke tests for both new entries. (AC-10)
- [ ] **T-19** `docs/adapters.md`; README, CHANGELOG, `docs/api.md`, `specs/DEPENDENCY_MAP.md`, AGENTS.md map. (AC-12)
- [ ] **T-20** Playground: the React example still runs every option; click each toggle on and off.
- [ ] **T-21** `npm run verify`, `test:smoke`, `check:exports`; write `review.md`; list the add-ons not yet
      migrated under Known gaps with the condition for each.
- [ ] **T-22** Release is the maintainer's call: a grid minor.
