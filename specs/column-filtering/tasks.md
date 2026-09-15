# Tasks: column filtering

Ordered by dependency. The core needs nothing, so the adapter comes first, documentation last.

## Core

- [x] **T-01** Prove, with unit tests, what the feature relies on and does not change: every operator
      the dialog emits matches as the table in `data-model.md` says, `between` and `in` over the
      wire forms, and a filter change resets the page.

## Data sources

- [x] **T-02** None in `src/data`. The playground's mock endpoint implements every operator, and the
      paging fetcher sends `filters`.

## Adapter

- [x] **T-03** `src/react/filters/operators.ts`: `COLUMN_FILTER_OPERATORS`, the conditions a column
      offers, draft completeness, draft to `FilterSpec` and back.
- [x] **T-04** 30 message keys in five locales; 11 labels; two class name slots.
- [x] **T-05** `ColumnFilterProvider` with the dialog: draft, Apply, Clear, Escape, outside click,
      focus in, Tab wrap, focus return, fixed positioning.
- [x] **T-06** `ColumnFilterTrigger` and the header: `data-filtered`, accessible name, registration.
- [x] **T-07** `GridFilterClear`, and the toolbar showing it while a filter is active.
- [x] **T-08** `columnFilters` on `<Gridwright />`, flat and tree; `GridwrightColumn.filter`.
- [x] **T-09** The filter change in the live region.
- [x] **T-10** Exports, attached parts, `scripts/check-exports.mjs`.
- [x] **T-11** Styles: trigger, active state, dialog, dark theme through the existing tokens,
      reduced motion.

## Tests

- [x] **T-12** Unit coverage for the operator table and the draft conversion.
- [x] **T-13** React coverage queried by role: every type, Apply, Enter, Escape, outside click, clear
      one, clear all, focus return, Tab wrap, announcement, page reset, a server-side source
      receiving the spec, a tree, Polish.
- [x] **T-14** Smoke coverage: the parts import through the export map and render.

## Documentation

- [x] **T-15** `docs/filtering.md`, README (the overclaim at "already there", a section, the API
      list), `docs/README.md` index.
- [x] **T-16** CHANGELOG under Unreleased.
- [x] **T-17** `specs/DEPENDENCY_MAP.md`.
- [x] **T-18** Playground: React page switch and typed columns, features page switch, README.

## Stage 7 — Verification

- [x] `npm run verify` green end to end, output recorded in review.md
- [x] Every switch clicked on and off again in Chrome, both playground pages
