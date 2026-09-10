# Tasks: unified options, virtualization and windowing

Ordered by dependency. Core first, adapter second, documentation last. Each task independently
checkable.

## Core

- [x] **T-01** `createWindowedDataSource`: block cache keyed by block index, LRU then distance
      eviction, `paginate: true` always, `WINDOW_OFFSET_META` in the result.
- [x] **T-02** Drop every block when the sort, filters or search change.
- [x] **T-03** Never join a block load whose own request has been aborted, and re-check the window
      afterwards.
- [x] **T-04** Generation guard, so a fetch crossing `invalidate()` cannot repopulate the cache.

## Adapter

- [x] **T-05** `useVirtualRows`: row range from scroll position, rAF-coalesced reads, resize
      observation, `scrollToIndex`.
- [x] **T-06** Scale scroll position into row space above the browser's element height limit, and
      report it as `scaled`.
- [x] **T-07** `GridVirtualBody`: spacer rows, skeleton rows for unloaded indices, `aria-rowindex`,
      moving the data window without a render loop.
- [x] **T-08** `<Gridwright>` gains `tree`, `virtual`, `rowActions`, `rowActionsTrigger`,
      `onCellEdit`, `renderSkeleton`, and wraps the columns when editing is on.
- [x] **T-09** `<Gridwright instance={...}>` recognises an instance from `useTreeGridwright` and
      supplies the tree context.
- [x] **T-10** `tree.controllerRef`, called once with the controller and once with `null`.
- [x] **T-11** `TreeGridwright` reduced to an alias, so there is one implementation.
- [x] **T-12** `icon` on a column, rendered by the flat cell and by the tree cell in the right
      place, hidden from assistive technology.
- [x] **T-13** `scrollRef` and `maxHeight` on `GridTable`; pagination hidden under `virtual`.
- [x] **T-14** Styles: bubble menu, spacer rows, skeleton sweep, cell content and icon, all
      respecting `prefers-reduced-motion`.

## Tests

- [x] **T-15** `tests/unit/windowed.test.ts`: the window, cache hits, the aborted-overlap case, the
      invalidate-in-flight case, dropping on sort, and memory bounded by the cache.
- [x] **T-16** `tests/react/virtual.test.tsx`: direct mapping below the cap, scaled above it,
      reaching row ten million, `scrollToIndex`, and rendering a window.
- [x] **T-17** `tests/react/composition.test.tsx`: each option alone, all four together, a column
      without `edit` staying read-only, virtualized tree, `controllerRef`, a caller-owned tree
      instance, and ten million rows with at most four blocks resident.
- [x] **T-18** Smoke suite still green against `dist/` through the export map.

## Documentation

- [x] **T-19** README: the option table, the tree section in option form, "Ten million rows",
      "Icons", the API tables, and the corrected "Not in this release".
- [x] **T-20** `docs/virtualization.md`, new.
- [x] **T-21** `docs/tree.md` rewritten around `tree={...}`, `controllerRef` and composition.
- [x] **T-22** `docs/data-sources.md` gains the windowed source; `docs/extensibility.md` gains the
      new seams; `docs/README.md` indexes the new page.
- [x] **T-23** The playground rebuilt around the switches, including the ten-million-row demo, and
      `examples/playground/README.md` updated.
- [x] **T-24** CHANGELOG entry, version to 0.4.0 in `package.json` and `src/index.ts`.
- [x] **T-25** `specs/DEPENDENCY_MAP.md`, and the two agent rules that said this package has no
      virtualization.

## Stage 7 — Verification

- [x] `npm run verify` green end to end, output recorded in review.md
- [x] The playground driven in a real browser: every switch, the ten-million-row demo scrolled to
      its last row, and an edit committed over the windowed source.
