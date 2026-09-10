---
name: performance
description: Use when touching the pipeline, the row build, or anything that runs per row or per render. Covers allocation discipline, large data sets, and measuring before changing.
---

# Performance & Allocation

A grid is a hot path by definition: everything here runs per row, per page, per keystroke.

## Measure first

Do not restructure code on a hunch. Write a benchmark or a timing test with a realistic row count,
record the number in the spec's research.md, and leave it there so the next person can see whether
the change was worth its complexity. A "faster" refactor with no number attached is a refactor.

## Where the work actually is

- **Column resolution happens once**, in `resolveColumns`, not per row. `getValue` closes over the
  accessor so the hot path is a call rather than a branch on the accessor's shape. Do not move that
  decision inside the loop.
- **Stages copy, they do not mutate.** `sortRows` copies before sorting because the array may be a
  local source's own storage. That copy is deliberate; removing it corrupts the source.
- **Stages run in order and each one narrows.** Filtering before sorting is not a style choice: it
  is the difference between sorting 50 rows and sorting 50,000.
- **Pagination runs last** so the total counts the matches. Moving it earlier is a correctness bug
  before it is a performance one.

## Render discipline in the adapter

- The engine publishes one state object, and a render follows each publish, so avoid publishing
  state that did not change. `commitSelection` and `commitQuery` both compare before writing.
- Do not allocate a closure per row in a component body when it can be hoisted.
- `useSyncExternalStore` returns the same state object between publishes, so referential equality
  is the memoization key that actually works here.

## What this package does not do yet

There is no virtualization. A grid rendering thousands of rows at once will be slow no matter how
tight the pipeline is, and the honest answer is server-side pagination or a virtualization plugin,
not micro-optimising the row loop. Say so in review rather than accepting a change that trades
readability for a few milliseconds on a page of 25.
