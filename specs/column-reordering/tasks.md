# Tasks: column reordering

Ordered by dependency. Core first, adapter second, documentation last. Each task independently
checkable.

## Core

- [x] **T-01** Nothing under `src/core`, `src/plugins`, `src/data` or `src/tree`. Confirmed rather
      than assumed: the declared array is the order, and reordering it is something an add-on
      already may do. A throwaway probe against the public `GridAddon` contract proved a `configure`
      that reorders `options.columns` changes the rendered header order, before this spec was
      written.

## Data sources

- [x] **T-02** Nothing to do. `order` never enters `GridQuery`. The one observable effect is that a
      source reading `DataSourceRequest.columns` receives them in the reader's order, which is
      documented rather than prevented.

## Adapter

- [x] **T-03** `src/react/layout/layout.ts` — `orderedColumns` and `moveInOrder`, pure; extend
      `normalizeLayout` to validate `order` as an array of strings.
- [x] **T-04** `src/react/layout/types.ts` — `order` on the state, `reorderable` on the options,
      `movable` on the column options, and the four new controller members.
- [x] **T-05** `src/react/layout/context.tsx` — `order`, `indexOf`, `canMove` and `moveColumn` on the
      controller, with the pin adjustment in `moveColumn` and nowhere else.
- [x] **T-06** `src/react/layout/addon.tsx` — `configure` reorders; `headerAttributes` contributes
      `draggable`, `onDragStart`, `onDragOver`, `onDrop`, `onDragEnd`, `onKeyDown`,
      `aria-keyshortcuts` and `data-movable`; the in-flight drag lives in `setup` state.
      (`aria-roledescription` in the first draft of this list: corrected at stage 5, spec C-8.)
- [x] **T-07** `src/react/layout/addon.tsx` — the announcement contributor gains the order, so a move
      is described by name and position.
- [x] **T-08** `src/react/layout/GridResizeHandle.tsx` — `draggable={false}`, so a drag begun on the
      handle resizes and never reorders.
- [x] **T-09** `src/react/layout/messages.ts` — `moved`. (`move` in the first draft of this list:
      dropped at stage 6 once `aria-roledescription` went, spec C-10.)
- [x] **T-10** `src/react/index.ts` — export `orderedColumns` and `moveInOrder`.
- [x] **T-11** `src/styles/styles.css` — the drag source and drop target states.
- [x] **T-12** `src/locales/{de,es,fr,pl}.ts` — the two new keys.

## Tests

- [x] **T-13** `tests/unit/column-layout.test.ts` — `orderedColumns` with unknown ids, unnamed
      columns and an empty order; `moveInOrder` including clamping and a no-op move;
      `normalizeLayout` against a hostile `order`.
- [x] **T-14** `tests/react/column-layout.test.tsx` — a drop reorders; `Ctrl`+arrow reorders and
      keeps focus; a locked column refuses both and nothing moves across it; a drag from the resize
      handle resizes and does not reorder; **sorting still works on a header that reorders**, which
      is the composition the plan's §5 puts first; a move into a pinned run pins the column; the
      announcement; `onChange` reports the order; the picker follows.
- [x] **T-15** `tests/react/column-layout.test.tsx` — an export writes its columns in the reader's
      order, extending the existing capture-format test.
- [x] **T-16** `tests/unit/i18n.test.ts` — no edit was needed: the add-on is already in
      `BUILT_IN_ADDONS`, so the audit picked the new key up on its own and would have failed on a
      pack that missed it.

## Documentation

- [x] **T-17** `docs/column-layout.md` — a reordering section: the two gestures, the pin rule, the
      saved-order drift rule, and the touch caveat.
- [x] **T-18** `docs/api.md` — `reorderable`, `movable`, the controller's new members, `order` on the
      state.
- [x] **T-19** `docs/accessibility.md` — the `Ctrl`+arrow model and the move announcement, in the
      priority table.
- [x] **T-20** `docs/persistence.md` — `order` in the saved layout example.
- [x] **T-21** `README.md` — the column layout section gains reordering.
- [x] **T-22** `CHANGELOG.md` — under Unreleased, with the `ColumnLayoutState` type-level break
      called out.
- [x] **T-23** `specs/column-layout/spec.md` — its non-goal "Column reordering" now points here, and
      `docs/column-layout.md`'s "What this add-on is not" with it.
- [x] **T-24** `specs/DEPENDENCY_MAP.md` — `react/layout/*` gains the order.
- [x] **T-25** `examples/playground` — reorder the columns by drag and by keyboard, and the saved
      order surviving a reload.

## Stage 7 — Verification

- [x] `npm run verify` green end to end, output recorded in review.md
- [x] The drag driven in a real browser, which jsdom cannot do
- [x] The keyboard walk-through, including sorting a header that also reorders
- [x] The playground: every switch on, then off again
