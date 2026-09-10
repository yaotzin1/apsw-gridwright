# Performance Rules

Binding.

## 1. Measure before restructuring

A performance change carries a number, recorded in the feature's `research.md`, produced with a
realistic row count. A change with no number is a refactor and is classified as one.

## 2. Resolve once, not per row

Column accessors are resolved in `resolveColumns` and closed over. Nothing that can be decided once
per column set may be decided inside the row loop.

## 3. Narrow before you order

Pipeline stage order is filter, search, sort, transform, paginate. Sorting before filtering sorts
rows that are about to be discarded.

## 4. Pagination runs last

The reported total must count the matches, not the rows the source returned. Moving pagination
earlier is a correctness bug before it is a performance one.

## 5. Stages copy, they never mutate

The array handed to a stage may be a local source's own storage.

## 6. Do not publish state that did not change

Every publish is a render. `commitQuery` and `commitSelection` compare before writing, and any new
command must do the same.

## 7. Say no to the wrong fix

There is no virtualization in this package. A grid rendering thousands of rows at once is answered
by server-side pagination or a virtualization plugin, not by micro-optimising a loop that runs 25
times.
