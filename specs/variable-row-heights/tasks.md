# Tasks: variable row heights

Core first, adapter second, tests alongside each, documentation last. Each task is independently checkable.

## Plan follow-ups (before any code)

- [ ] T-00a Settle the row-detail question in plan.md and record it in spec.md C-4
- [ ] T-00b Confirm custom and group rows take the body's `style` (plan.md point 2)

## Core

- [ ] T-01 `createRowOffsets` with `set`, `clear`, `heightOf`, `offsetOf`, `indexAt`, `totalHeight`
- [ ] T-02 Unit tests: empty index equals the uniform arithmetic exactly; mixed heights; a height equal to base removes the record; out-of-range indexes clamp
- [ ] T-03 `computeVirtualWindow` and `scrollOffsetForIndex` accept `offsets`; the uniform path is untouched
- [ ] T-04 Unit tests: paddings plus rendered rows equal `scrollHeight` (AC-06); `scrollToIndex` then first visible row agree (AC-08); scaled past `MAX_SCROLL_HEIGHT` (AC-09)
- [ ] T-05a `trim(anchor, max)` evicts the farthest entries first; tests for the cap (AC-10b)
- [ ] T-05 Property-style test: random heights, `indexAt(offsetOf(i)) === i` for every `i`

## Adapter

- [ ] T-06 `rowHeightOf` on `GridVirtualOptions<TRow>`; `virtualRows<TRow>` owns the `RowOffsets` and provides it in `VirtualScrollContext`
- [ ] T-07 `GridVirtualBody` records heights per data version (AC-04, AC-10), applies per-row `style`, uses base height for skeletons (AC-11, AC-14)
- [ ] T-08 A throwing `rowHeightOf` falls back to base and reports through the add-on error path (AC-05)
- [ ] T-09 Scroll compensation when rows above the viewport change height (AC-12)
- [ ] T-10 React tests: mixed heights keep the `aria-rowindex` sequence (AC-15); `density()` listed before and after (AC-03); a sort resets heights (AC-10); a window arriving above the viewport (AC-12); a remote round trip down 5,000 rows and back up (AC-10a); window moves keep heights, version changes clear them (AC-10)
- [ ] T-11 A baseline test that the windowed body without `rowHeightOf` renders the markup it did before (AC-02)

## Packaging and proof

- [ ] T-12 `npm run test:smoke` imports `createRowOffsets` through the specifier; `npm run check:exports`
- [ ] T-13 Benchmarks recorded in research.md (AC-18)
- [ ] T-14 Playground: a windowed grid with mixed heights, operated in Chrome with density levels, sort, filter and jump-to-row, each toggled back off

## Documentation last

- [ ] T-15 `docs/virtualization.md`, `docs/api.md`, `docs/addons.md` if the seam changed, `README.md`, `CHANGELOG.md`, `specs/DEPENDENCY_MAP.md`
- [ ] T-16 `review.md` answered with real `npm run verify` output
