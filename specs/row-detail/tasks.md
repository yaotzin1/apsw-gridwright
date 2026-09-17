# Tasks: expandable rows (row detail panels)

Ordered by dependency. The contract seam first, because the add-on is written against it and a
third-party add-on must be able to use it on the same terms. Adapter second, documentation last.
Each task independently checkable.

> **Done.** The contract seam shipped first (T-01 to T-05), then the add-on on top of it, entirely
> from the public exports. Every task below is complete.

## The contract seam

- [x] **T-01** Add `rowAfter` to `AddonContribution` in `src/react/addons/types.ts`, with JSDoc
      saying it returns `<tr>` elements, that every contributor renders in add-on order, and that an
      extra row given `role="row"` changes what `aria-rowcount` means for the whole result set.
- [x] **T-02** Add `rowsAfterOf(grid, row)` to `src/react/parts/slots.tsx`, mirroring `renderSlot`:
      `callSlot` per add-on, `rendersSomething` to skip empties, `Fragment` keyed by add-on name.
- [x] **T-03** `GridRowOrCustom` renders the row (default or custom) followed by `rowsAfterOf`.
      `GridRowView` is not touched.
- [x] **T-04** Export `columnCountOf` from `src/react/index.ts`.
- [x] **T-05** Fix `GridTable`'s `onKeyDown` to ignore an event whose closest `<table>` is not
      `event.currentTarget`, so a nested grid does not drive the outer grid's `tableKeyDown`
      contributors.

## Core

Nothing, and it stayed that way. No engine change, no plugin, no pipeline stage, no new `GridQuery`
facet, no `GridState` field. If this section had acquired a task, the plan was wrong — stop and
return to stage 3.

## Data sources

Nothing, and it stayed that way. The add-on never reads `capabilities` and never asks a source for
anything.

## Adapter

- [x] **T-06** `src/react/detail/types.ts`: `RowDetailOptions`, `RowDetailController`,
      `RowDetailContext`, `RowDetailProviderProps`, `GridDetailToggleProps`, `GridRowDetailProps`.
- [x] **T-07** `src/react/detail/messages.ts`: `ROW_DETAIL_ADDON` and the six English strings.
- [x] **T-08** `src/react/detail/context.tsx`: `RowDetailProvider`, `useRowDetail` (throws a
      `GridwrightError` naming the add-on when it is absent), `useOptionalRowDetail`.
- [x] **T-09** `src/react/detail/GridRowDetail.tsx`: the presentational `<tr>` / `<td colSpan>` and
      the named `role="region"`, its `id` built from a per-grid `useId()` and the row id.
- [x] **T-10** `src/react/detail/GridDetailToggle.tsx`: the button, its `aria-expanded`, its
      `aria-controls` while expanded only, and its row-naming accessible name.
- [x] **T-11** `src/react/detail/addon.tsx`: the expanded set, the controller (`allows`, `expand`,
      `collapse`, `toggle`, `expandAll`, `collapseAll`), `single`, `persistAcrossPages`,
      `canToggle`, `onExpandedChange` (not on the initial set), `controllerRef`, and the four
      contributions — `rowAfter`, `columns`, `provide`, `messages` — ordered `after: [TREE_ADDON]`.
- [x] **T-12** Throw a `GridwrightError` naming both add-ons and the reason when
      `AddonSetupContext.addons` holds `VIRTUAL_ADDON`.
- [x] **T-13** Unwrap the row with `rowDataOf` before handing it to `render`, `hasDetail` and
      `rowLabel`.
- [x] **T-14** `src/react/detail/index.ts` and the re-exports in `src/react/index.ts`.
- [x] **T-15** The six strings in all five packs under `src/locales/`.
- [x] **T-16** `src/styles/styles.css`: `.gw-detail-row`, `.gw-detail-cell`, `.gw-detail-panel`
      (sticky at `left: 0`), `.gw-detail-toggle`, and the custom properties. No colour literal, no
      transition.

## Tests

- [x] **T-17** `tests/react/` — the seam: two add-ons both contributing `rowAfter` for one row both
      render, in add-on order; a `rowAfter` after a `renderRow` row renders; a throwing `rowAfter`
      renders nothing and leaves the grid standing.
- [x] **T-18** `tests/react/third-party-addon.test.tsx` — an add-on built from public exports only
      contributes `rowAfter` and `columnCountOf`, proving the seam is not privileged.
- [x] **T-19** `tests/react/` — the add-on: toggle expands and collapses, panel content appears
      under its row, `hasDetail: false` draws no toggle, `render` returning null renders no row,
      `single` closes the other, `initialExpanded` opens without firing `onExpandedChange`,
      `canToggle` refuses and the toggle disables itself.
- [x] **T-20** `tests/react/` — accessibility: the toggle is queried by role with its row-naming
      name, `aria-expanded` flips, `aria-controls` appears only while expanded, the panel is a named
      region, focus stays on the toggle across both transitions, and — the regression that matters —
      `aria-rowcount` and every `aria-rowindex` are identical with a panel open and closed.
- [x] **T-21** `tests/react/` — expansion survives a page change and returns, and does not with
      `persistAcrossPages: false`.
- [x] **T-22** `tests/react/` — composition: with `treeData()`, both toggles work and the row's
      `aria-expanded` and the button's are independent; with `selection()`, neither click swallows
      the other; listing `virtualRows()` throws an error naming both add-ons.
- [x] **T-23** `tests/react/row-after.test.tsx` — a nested `<Gridwright />` in a contributed row:
      arrow keys pressed inside it do not reach a `tableKeyDown` contributor on the outer grid.
      Confirmed to fail before the `GridTable` guard and pass after it.
- [x] **T-24** `tests/unit/` — `auditAddonMessages` covers `gridwright:row-detail` across all five
      locales.
- [x] **T-25** `tests/smoke/` — `columnCountOf` and a `rowAfter` contribution run through
      `apsw-gridwright/react` from `dist/`, and `check-exports.mjs` guards `columnCountOf` and
      `GridRowOrCustom` in the export map. Extend to `rowDetail` when the add-on exists.
- [x] **T-26** `tests/smoke/tree-shaking.test.ts` — a grid that does not list `rowDetail()` does not
      pull the detail module into the bundle.

## Documentation

- [x] **T-27** `docs/addons.md`: `rowAfter` in the body table, and the paragraph about what an extra
      row may claim to be.
- [x] **T-28** `docs/row-detail.md`: the feature, the options, the controller, the nested-grid
      example, and its three traps — the context inside the panel, the second live region, and the
      exports that do not contain panels.
- [x] **T-29** `docs/accessibility.md`: the disclosure pattern and the presentational-row decision
      with its cost.
- [x] **T-30** `docs/api.md`, in the same change as the surface, per the repository rule.
- [x] **T-31** `README.md`: one line in the add-on list.
- [x] **T-32** `CHANGELOG.md` under Unreleased — Added for the add-on and the `rowAfter` slot,
      classified minor; Fixed for the nested-table keyboard leak.
- [x] **T-33** `specs/DEPENDENCY_MAP.md`: `src/react/detail` in the feature add-on group.
- [x] **T-34** `examples/`: a detail panel in the playground with a nested grid inside it, and a
      toggle for `single`, so every option can be clicked.

## Stage 7 — Verification

- [x] `npm run verify` green end to end, output pasted into review.md
- [x] `npm run test:smoke` and `npm run check:exports` run and reported — a green unit suite proves
      nothing about the export map
- [x] The keyboard walk-through in `.agents/workflows/verification.md`, including Tab into a panel
      and out of it
- [x] The playground clicked: every option switched on **and off again** in Chrome. This is what
      found the tree-unwrapping defect -- every team row had a toggle `hasDetail` was meant to refuse

## Stage 8 — Review and ship

- [x] The 7-dimension self-review written into review.md, including the known gaps this spec already
      names: the presentational row inside `role="grid"`, pinned columns painting over the panel, and
      no windowing
