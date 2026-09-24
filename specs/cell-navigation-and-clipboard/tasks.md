# Tasks: 2D cell navigation and clipboard copy

Ordered by dependency. Core first, adapter second, documentation last. Each task independently
checkable.

## Core

- [x] **T-01** None. The cursor is view state and the engine is not touched; recorded in
      `data-model.md` rather than left implicit.

## Data sources

- [x] **T-02** None. Nothing here reads or writes `GridQuery`, makes a request, or asks where a row
      came from.

## Adapter — navigation (change 1)

- [x] **T-03** `useCellNavigation.ts`: cursor state keyed by ids, the visitable column list (extra
      columns included per C-1), and movement — arrows, `Home`/`End`, `PageUp`/`PageDown`,
      `Ctrl+Home`/`Ctrl+End` — all clamped to loaded rows per C-2.
- [x] **T-04** `addon.tsx`: `cellAttributes` and `extraCellAttributes` for `tabIndex`,
      `gw-cell--focused` and `onFocus`; `tableKeyDown` returning true only for keys it handled;
      `provide` for the controller context.
- [x] **T-05** Focus after render, including the windowed case: `useVirtualScroll().scrollToIndex`
      then focus once the row is mounted, with the frame handle released on unmount.
- [x] **T-06** Tree keys through `useOptionalTreeContext()`: `ArrowRight` expands a collapsed node,
      `ArrowLeft` collapses an expanded one, otherwise they move.
- [x] **T-07** Interactive-child guard (AC-08) and the `Escape` return to the cell.
- [x] **T-08** `messages.ts` and the focus-ring rule in `src/styles/styles.css`.
- [x] **T-09** Exports from `src/react/navigation/index.ts` and `src/react/index.ts`.

## Adapter — clipboard (change 2)

- [x] **T-10** `clipboard.ts`: TSV via `buildExportTable` + `formatCsv`, an escaped HTML table, and
      the OS-independent shortcut test. Written in the `copy` event rather than
      `navigator.clipboard.write()`, so there is no failure path to announce (spec C-4).
- [x] **T-11** The copy shortcut in `tableKeyDown` (selects the cell so `copy` fires), `onCopy`
      through `tableAttributes`, the two messages, and the four locale packs.

## Tests

- [x] **T-12** React coverage queried by role: one Tab stop, arrows in both directions, RTL,
      `Home`/`End`, paging keys clamped, `Ctrl+End` on an inexact total, extra columns reachable,
      the interactive-child guard, and a grid without the add-on unchanged.
- [x] **T-13** Windowed and tree coverage.
- [x] **T-14** Smoke coverage: the new names resolve through the export map.

## Documentation

- [x] **T-15** `docs/api.md`, and a section in `docs/accessibility.md`
- [x] **T-16** README, both playbooks, and the playground with a toggle
- [x] **T-17** CHANGELOG entry under Unreleased with the minor classification
- [x] **T-18** `specs/DEPENDENCY_MAP.md`

## Stage 7 — Verification

- [ ] `npm run verify` green end to end, output recorded in review.md
- [ ] Keyboard walk-through in Chrome, including with `virtualRows()` and `treeData()` listed
