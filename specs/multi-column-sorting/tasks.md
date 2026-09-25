# Tasks: multi-column sorting

Ordered by dependency. `sortingPlugin` already chains comparators; the one core task was found at
stage 6 (api-surface.md, Behaviour fixed).

## Core

- [x] **T-00** `toggleSort` reverses an additive column in place instead of appending it

## Adapter

- [x] **T-01** `sortingMessages`: `sortedAscendingPriority`, `sortedDescendingPriority`, `actionWithShift`
- [x] **T-02** The same keys in `src/locales/{de,es,fr,pl}.ts`
- [x] **T-03** `SortButton` renders `.gw-sort-priority` while more than one column is sorted, and the
      Shift hint in `title` while `multiSort` is on
- [x] **T-04** `describeSort` names the priority while more than one column is sorted
- [x] **T-05** `.gw-sort-priority` in `src/styles/styles.css`, on existing tokens

## Tests

- [x] **T-06** React: badges appear on Shift-activation, renumber when a column leaves, disappear at one
      column; the button's accessible name is unchanged
- [x] **T-07** React: the priority announcement, and the single-column sentence unchanged
- [x] **T-08** React: `multiSort: false` renders no hint and replaces the sort on Shift
- [x] **T-09** Locale completeness passes (existing test, over the new keys)

## Documentation

- [x] **T-10** docs/api.md (`sorting()` messages and markup), docs/accessibility.md (announcement table)
- [x] **T-11** CHANGELOG entry under Unreleased, minor
- [x] **T-12** The playground shows a multi-column sort that can be clicked

## Stage 7 — Verification

- [x] `npm run verify` green end to end, output recorded in review.md
- [x] Shift-click through the playground in Chrome: add, flip, remove, and back to one column
