# Tasks: column layout (resizing, pinning and visibility)

Ordered by dependency. Core first, adapter second, documentation last. Each task independently
checkable.

## Core

The engine changes in no way. `ColumnDef` already carries `width`, `minWidth` and `hidden`, and the
search and export stages already read `hidden`.

- [x] **T-01** Nothing to do under `src/core`, `src/plugins` or `src/data`. Confirmed rather than
      assumed: the only engine-visible effect of this feature is `hidden`, written through the
      add-on's `configure`.

## Data sources

- [x] **T-02** Nothing to do. The layout never enters `GridQuery`, so no source sees it and no
      capability facet is involved. Verified by the review's dimension 2.

## Adapter

- [x] **T-03** `src/react/layout/types.ts` — `ColumnPin`, `ColumnLayoutState`, `ColumnLayoutOptions`,
      `ColumnLayoutController`, `ColumnLayoutColumnOptions`, `LayoutColumn`, `StickyOffsets`, and the
      `GridwrightColumn` augmentation for `layout`.
- [x] **T-04** `src/react/layout/layout.ts` — the pure arithmetic, no DOM: `columnWidthProperty`
      (the encoded custom property name), `clampWidth`, `resolvedWidth`, `stickyOffsets`,
      `layoutColumnsOf`, `autoFitWidth`. Every one of these is testable without rendering.
- [x] **T-05** `src/react/layout/messages.ts` — `COLUMN_LAYOUT_ADDON`, `columnLayoutMessages` in
      English.
- [x] **T-06** `src/react/layout/context.tsx` — the layout state, the controller, the provider and
      `useColumnLayout` / `useOptionalColumnLayout`.
- [x] **T-07** `src/react/layout/GridResizeHandle.tsx` — the focusable `role="separator"`, pointer
      capture, the keyboard model (arrows, `Shift`, `Home`, `Enter`) and auto-fit measurement.
- [x] **T-08** `src/react/layout/GridColumnPicker.tsx` — the `role="menu"` of `menuitemcheckbox`
      items, grouped by pin side, with "show all" and "reset layout".
- [x] **T-09** `src/react/layout/addon.tsx` — `columnLayout()`: `setup`, `configure`, `provide`,
      `tableAttributes`, `headerAfter`, `headerAttributes`, `cellAttributes`,
      `extraHeaderAttributes`, `extraCellAttributes`, `toolbar`, `messages`.
- [x] **T-10** `src/react/layout/index.ts` and `src/react/index.ts` — the exports listed in
      `api-surface.md`, and nothing else.
- [x] **T-11** `src/styles/styles.css` — `.gw-table--fixed`, the resize handle, the sticky cells and
      their elevation shadow, the picker. New custom properties documented in `docs/api.md`.
- [x] **T-12** `src/locales/{de,es,fr,pl}.ts` — `addons['gridwright:column-layout']`.

## Tests

- [x] **T-13** `tests/unit/column-layout.test.ts` — the pure arithmetic: the custom property name
      for a hostile column id, clamping against `minWidth`/`maxWidth`, left and right offsets with
      hidden and extra columns in the mix, auto-fit clamping.
- [x] **T-14** `tests/react/column-layout.test.tsx` — the resize handle by role, the keyboard model,
      the picker by role, a column hidden reaching the engine (search and export stop seeing it),
      pinning producing sticky offsets on both the data columns and the selection column, the
      announcements, and `onChange` not firing on mount.
- [x] **T-15** `tests/unit/i18n.test.ts` — the add-on joins `BUILT_IN_ADDONS`, so every shipped
      locale is audited against its English keys.
- [x] **T-16** `tests/smoke/tree-shaking.test.ts` — a marker for the feature, so a grid that does
      not import it does not ship it.
- [x] **T-17** The `layout` column option type-checks alongside `edit` and `filter`. Covered where
      it is actually used rather than in `column-augmentation.test.tsx`, which already proves a
      third-party augmentation works: the column sets in `tests/react/column-layout.test.tsx` and in
      `examples/playground/js/employees/columns.js` declare `layout` beside `edit` and `filter`, and
      both are in `tsc --noEmit`'s include list.

## Documentation

- [x] **T-18** `docs/column-layout.md` — the feature's own page, and links from `docs/README.md`.
- [x] **T-19** `docs/api.md`, `docs/addons.md`, `docs/accessibility.md`, `docs/persistence.md` —
      the props, the add-on row, the keyboard model, the saved layout.
- [x] **T-20** `README.md` — the feature list and the add-on table.
- [x] **T-21** `CHANGELOG.md` entry under Unreleased, classified minor.
- [x] **T-22** `specs/DEPENDENCY_MAP.md` — the new module and what it depends on.
- [x] **T-23** `examples/playground` — a switch that turns the add-on on, pin and reset controls
      built on the exported controller, and a column that declares `layout`.

## Stage 7 — Verification

- [x] `npm run verify` green end to end, output recorded in review.md
- [x] The keyboard walk-through in `.agents/workflows/verification.md`
- [x] The playground driven in a real browser: every switch on, then off again
