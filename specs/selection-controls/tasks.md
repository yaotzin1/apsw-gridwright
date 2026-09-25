# Tasks: selection controls

Ordered by dependency. No core work: selection is engine state with public operations already.

## Adapter

- [x] **T-01** `SelectionOptions.selectAll`: the checkbox column's header renders the visually hidden
      `selectColumn` name instead of the select-page checkbox
- [x] **T-02** `SelectionOptions.selectOnRowClick`: `rowAttributes` contributes `onClick` with the
      interactive-element and text-selection guards, and `.gw-row--selectable`
- [x] **T-03** `tableKeyDown`: `Space` on a focused body cell with no control toggles its row
- [x] **T-04** `selectColumn` message in `en`, `de`, `es`, `fr`, `pl`
- [x] **T-05** `.gw-row--selectable { cursor: pointer }` in `src/styles/styles.css`

## Tests

- [x] **T-06** React: `selectAll: false` keeps row checkboxes and names the column
- [x] **T-07** React: row click toggles; a click on a button, link or input in a cell does not; the
      grid's `onRowClick` still runs; `single` mode replaces
- [x] **T-08** React: `Space` with `cellNavigation()` toggles a plain cell's row and still operates a
      cell's checkbox; `Space` does nothing without `selectOnRowClick`
- [x] **T-09** React: the same row click under `virtualRows()`
- [x] **T-10** Locale completeness (existing test, over the new key)

## Documentation

- [x] **T-11** docs/api.md `selection(options)`; docs/accessibility.md keyboard route
- [x] **T-12** CHANGELOG under Unreleased, minor
- [x] **T-13** Playground: select-all and row-click switches with a hint

## Stage 7 — Verification

- [x] `npm run verify` green end to end, output recorded in review.md
- [x] Every new switch on and off in the playground in Chrome
