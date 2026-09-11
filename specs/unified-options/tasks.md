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
- [x] **T-14a** Place a window's rows from the query when the source publishes no offset, and treat
      them as unplaceable until they settle. Virtualization works over any paginating source.
- [x] **T-14b** Keep the editing context for as long as a cell might still ask for it, and key both
      column-wrapping memos on `edit` and `icon` rather than on ids, so switching an option off on a
      live grid cannot take the grid down.
- [x] **T-14c** Render a column's icon inside its editable trigger, so clicking the icon starts
      editing.
- [x] **T-14d** Measure the row menu against its own anchor and centre it on the row.
- [x] **T-14e** Open the row menu beside the pointer, clamped inside the grid, falling back to the
      row's trailing edge when the row was reached by keyboard.

- [x] **T-14f** Move the window arithmetic into the core as `computeVirtualWindow` and
      `scrollOffsetForIndex`, leaving `useVirtualRows` as the binding that reads two DOM numbers.
      It is what lets a page with no framework virtualize at all.
- [x] **T-14g** Apply `defaultExpandedDepth` on the first build that produced a tree, so rows that
      arrive from a server are expanded rather than rendered as a list of roots.

## Tests

- [x] **T-15** `tests/unit/windowed.test.ts`: the window, cache hits, the aborted-overlap case, the
      invalidate-in-flight case, dropping on sort, and memory bounded by the cache.
- [x] **T-16** `tests/react/virtual.test.tsx`: direct mapping below the cap, scaled above it,
      reaching row ten million, `scrollToIndex`, and rendering a window.
- [x] **T-17** `tests/react/composition.test.tsx`: each option alone, all four together, a column
      without `edit` staying read-only, virtualized tree, `controllerRef`, a caller-owned tree
      instance, and ten million rows with at most four blocks resident.
- [x] **T-18** Smoke suite still green against `dist/` through the export map.
- [x] **T-18b** `tests/react/bubble-menu.test.tsx`: placed beside the pointer, clamped at the edge,
      the row edge without a pointer, and moved to the row the pointer moves to.
- [x] **T-18a** Regressions for each bug the playground found: placement over a paginating source,
      switching editing off on a flat grid and on a tree, a column gaining an icon, and clicking the
      icon of an editable cell. Each was confirmed to fail without its fix.

## Documentation

- [x] **T-19** README: the option table, the tree section in option form, "Ten million rows",
      "Icons", the API tables, and the corrected "Not in this release".
- [x] **T-20** `docs/virtualization.md`, new.
- [x] **T-21** `docs/tree.md` rewritten around `tree={...}`, `controllerRef` and composition.
- [x] **T-22** `docs/data-sources.md` gains the windowed source; `docs/extensibility.md` gains the
      new seams; `docs/README.md` indexes the new page.
- [x] **T-23** All three playground pages: the features page rebuilt around the switches with the
      ten-million-row demo, the vanilla page given the windowed source with no framework involved,
      the React page given row actions, inline editing, windowing and a tree over its paginating API,
      and `examples/playground/README.md` updated. The mock API gained `/api/people/range`.
- [x] **T-23a** A tree on the vanilla page, drawn by the page itself over `createTreeDataSource`,
      `treePlugins` and `treeColumns`, with expansion, search that keeps the folders of a match, and
      a row menu of its own. It is the demonstration that the tree is core rather than React.
- [x] **T-24** CHANGELOG entry, version to 0.4.0 in `package.json` and `src/index.ts`.
- [x] **T-25** `specs/DEPENDENCY_MAP.md`, and the two agent rules that said this package has no
      virtualization.
- [x] **T-26** `docs/persistence.md`: the two write hooks, the four change shapes, the table behind
      them, and why the nested set is derived rather than stored. Both playground trees post to the
      mock API and survive a reload.

## Stage 7 — Verification

- [x] `npm run verify` green end to end, output recorded in review.md
- [x] The playground driven in a real browser: every switch, the ten-million-row demo scrolled to
      its last row, and an edit committed over the windowed source.
