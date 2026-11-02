# Tasks: framework-neutral adapter architecture

Core first, renderer second, documentation last. Tests sit with each task. Nothing from T-02 starts
until the maintainer approves the spec and answers the OPEN items (C-1, C-2, C-9).

## Gate

- [ ] **T-01** Approval, then `workflow.ai.yml` architecture lines (C-8), `node scripts/sync-agent-docs.mjs`,
      commit `Track: chore` with `Workflow-Change: framework-neutral view layer`.

## Foundations (no behaviour change)

- [ ] **T-02** Baseline: record render time and allocations for the 10 000-row and 500-column fixtures, and
      snapshot the rendered markup of the React grid for the cases in tests/react. Commit the numbers
      into research.md. (AC-11, section 4 of api-surface)
- [ ] **T-03** Lint and audit: extend the headless ban and `security-audit.mjs` to `src/view` and
      `src/conformance` (empty directories with a placeholder test), and prove the rule fires with a fixture.
- [ ] **T-04** Structural types: `ViewEvent`, `ContributedAttributes` without React, `Attrs`. Move
      `mergeAttributes` and the allowlist to `src/view/attributes.ts`; React re-exports. Existing tests unchanged.
- [ ] **T-05** Move `resolve.ts` (ordering, suppression, narrow variants, ownership) to `src/view`, generic
      over `TNode`; React re-exports. A type test compiles an add-on written against today's `GridAddon`.
- [ ] **T-06** Move the sorting, selection, pagination and announcement functions to `src/view/behaviour`;
      `/react` re-exports the same names. `selectionKeyDown` takes `ViewEvent`.

## The vertical slice

- [ ] **T-07** `createStore`, with tests for `get`, `set`, `update`, unsubscribe and listener reentrancy.
- [ ] **T-08** `ViewNode`, `h`, and the string renderer; tests that an element, text, fragment and slot
      render, and that a tag or attribute outside the allowlist is dropped and reported.
- [ ] **T-09** `ViewAddon`, `defineAddon`, `VIEW_ADDON`, `GridAddon` as the alias (C-4, C-7).
- [ ] **T-10** React renderer: `renderNode`, the `component` registry (public), store binding in
      `useGridwright`. Tests: a neutral add-on and a legacy add-on in one grid.
- [ ] **T-11** Neutral `sorting()`. The existing React sorting, multi-sort, `aria-sort`, header-row
      navigation and live-region tests pass **unchanged**.
- [ ] **T-12** Compare the markup snapshot and the baseline. **Checkpoint**: stop and review with the
      maintainer; answer research question 1. Expand only if the node description held without `component`.

## Conformance

- [ ] **T-13** `ConformanceDriver`, the suite, the sorting scenarios; run by the React driver
      (Testing Library) and by a string-renderer driver. (AC-09, C-10)

## Table model and the other core features

- [ ] **T-14** `buildTableModel` with a lazy `row(index)`; React shell consumes it for the core features.
      `a11y-axe`, `accessible-state` and `gridwright.test.tsx` pass unchanged. (AC-05, AC-06)
- [ ] **T-15** Neutral `selection()` including the indeterminate select-all (research question 2).
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
