# Plan: variable row heights

## Modules touched

| Module | Change |
| :--- | :--- |
| `src/core/virtual.ts` | `RowOffsets`, `createRowOffsets`; `computeVirtualWindow` and `scrollOffsetForIndex` take an optional `offsets` and, when present, use it instead of `index * rowHeight`. The uniform path is left untouched so AC-02 holds by construction. |
| `src/react/virtual/useVirtualRows.ts` | Accepts `offsets` and forwards it; adds the scroll compensation of AC-12. |
| `src/react/virtual/GridVirtualBody.tsx` | Records heights for the rows it holds (once per version), looks the height up per rendered row for the `style`, and uses the base height for skeletons. |
| `src/react/virtual/addon.tsx` | Takes `rowHeightOf`, owns the `RowOffsets`, puts the offsets in `VirtualScrollContext` so `useVirtualScroll().scrollToIndex` agrees with the body. |
| `docs/`, `README.md`, `CHANGELOG.md`, playground | As AC-17. |

Nothing under `src/core` gains DOM or React. The engine, plugins, data sources and the add-on contract are not
touched.

## The index

Rows with a custom height are the exception, so the structure stores exceptions only:

- a sorted array of recorded indexes with a parallel prefix sum of `(height - base)` deltas, or a Fenwick tree
  keyed by position among recorded rows. `offsetOf(i) = i * base + (sum of deltas of recorded rows before i)`.
- `indexAt(offset)` binary-searches the recorded rows, then divides the remainder by `base`.
- Both are O(log m) in `m` recorded rows. With `m = 0` they reduce to today's division.

Heights are keyed by absolute index and survive window moves; only a data-version change clears them. After each recorded batch, `trim(firstVisibleIndex, rememberedRows)` enforces the cap, so the structure is bounded.

Recording is batched: a window of rows arrives, the body records the whole batch, and the index is built once.
Incremental insertion into a sorted array is O(m) per row and is rejected for a batch (see research.md).

## Seams and the headless boundary

- The arithmetic is a pure function over numbers in `src/core`, tested without a renderer.
- The adapter owns the only DOM read it already has (scroll offset and viewport height) and one new thing:
  adjusting `scrollTop` when rows above the viewport change height. The repository's rule is that a position is
  moved only on a reader's request, so this is the single exception and is scoped: it runs only when a height
  change happens above the first visible row, and it moves by exactly that difference.

## Open points to settle before stage 6

1. **Row detail.** Check how `rowDetail()` places its panel under a windowed body (inside the parent row's slot,
   or as a second row). If it is a second row, its height must be accounted for in the arithmetic or the
   scrollbar drifts. Record the answer in C-4.
2. **Group and tree rows.** Confirm `GridRowOrCustom` receives the same `style` for custom rows so they honour
   the base height.
3. **`MAX_SCROLL_HEIGHT` scaling with offsets.** Confirm the scaled branch maps scroll ratio to an index through
   `indexAt` on the scaled total, and that a jump to row `i` and a read-back agree to within the documented
   approximation.

## Trade-offs

- **Function option vs. measurement.** The function costs the developer a number; measurement costs the grid a
  `ResizeObserver` per row and a layout feedback loop. The function is the smaller, testable step and does not
  close the door on measurement (research.md).
- **Scroll compensation vs. letting the view jump.** A scrollbar that corrects itself under the person's eye is
  worse than a few lines of adjustment code. Accepting the exception to "do not move scroll" is deliberate and
  limited.
