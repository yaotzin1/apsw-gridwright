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

A grid rendering thousands of rows at once is answered by the `virtualRows()` add-on, or by a windowed source when
the rows will not fit in memory either, not by micro-optimising a loop that runs 25 times. The
pipeline runs over the rows the source returned; make the source return fewer.

## 8. Scale is a requirement, not an optimisation

This grid is built to stay fast on very large data: hundreds of columns and millions of rows. A
change that works at 25 rows and 10 columns but degrades with the size of the data is a defect,
reviewed as one. The targets below are the bar. Where a number is marked *starting threshold*, it
has not been measured yet; the first feature that measures it replaces it with the measured
number and links the `research.md` that produced it.

**Targets**

| What | Target |
| :--- | :--- |
| Scrolling either axis | 60 frames per second on a mid-range laptop: script work per frame well under 8 ms |
| Cells in the DOM | Bounded by the viewport, never by the data: roughly rows on screen × columns on screen, plus overscan and pinned columns |
| Rows held in the browser | Bounded by the window (`blockSize × maxBlocks`) once the data is behind a windowed source |
| Sort, filter, search over a local array | Under 100 ms up to 100,000 rows (*starting threshold*); beyond that the work moves to the server |

**How the grid reaches them**

1. **Render a window, on both axes.** `virtualRows()` mounts the rows in view and `virtualColumns()`
   the columns in view; listed together the grid mounts their product. Spacer rows and gap cells
   carry the size of everything else, so the table stays a real table.
2. **Hold a window, not the data.** `createWindowedDataSource` fetches ranges and evicts blocks, so
   memory does not grow with the result set.
3. **Do the work where the data is.** A source that declares `sort`, `filter` and `search` in its
   `capabilities` gets those facets resolved by the server; the pipeline applies only what is left.
   Sorting ten million rows in a browser is not a goal.

Which of these a grid needs (*starting thresholds*):

| Data | Columns | Use |
| :--- | :--- | :--- |
| Up to ~50,000 rows in memory | up to ~40 | a local array, `virtualRows()` past a few hundred rows |
| Up to ~50,000 rows in memory | more than ~40 | the same, plus `virtualColumns()` |
| ~50,000 to ~500,000 rows | any | a local array still renders fine; measure sort and filter, and move them to the server when they miss the target |
| More than ~500,000 rows, or a count the client cannot know | any | `createWindowedDataSource` with server-side sort, filter and search, plus both windows |

**Rules for the hot path** (binding, enforced in review):

- A scroll handler reads the scroll position and the viewport size, once per animation frame, and
  nothing else. No `getBoundingClientRect`, no `offsetWidth` of cells, no measuring while scrolling.
- A scroll renders only when the window's edges move. Scrolling inside a row or a column costs
  nothing; `virtualColumns()` compares the new edges before it asks for a render.
- Work per scroll frame is proportional to what is mounted, plus at most one pass over the column
  set. Never a pass over the rows.
- Anything computed for a whole render (layout, sticky offsets, the column window) is computed once,
  lazily, and read by the per-row and per-cell slots as a lookup.
- Fixed sizes are what make the arithmetic possible: fixed row height, declared column widths, fixed
  table layout. A feature that needs measured sizes needs a measuring virtualizer first, specified
  as its own feature.
- A performance claim in a spec, a changelog or a document carries a number from `research.md`.

**Open decision: live and server-side computing.** Not designed yet, and not to be built until a spec
chooses. Aggregates, computed columns and data that changes while it is on screen at this scale
cannot be computed over rows the browser does not hold. The options, for whoever writes that spec:

- **A. The server computes.** Aggregates and computed values arrive with each window, published in
  `state.meta` like `WINDOW_OFFSET_META`. Scales with the server and keeps the one pipeline; costs a
  round trip per change. The default to argue against.
- **B. A worker computes.** The engine is headless and DOM-free, so the pipeline can run in a Web
  Worker over an in-memory array, off the main thread. Only for data that fits in memory; costs the
  transfer of results to the main thread.
- **C. The server streams changes.** Row-level deltas pushed into the windowed cache, which needs
  invalidation by row id rather than `invalidate()` of every block, and stable row ids end to end.
  Needed for live data whatever is chosen for aggregates.

These are not exclusive: A with C is the likely shape for live dashboards over large data, B for
mid-size local analysis. Whichever is chosen states its numbers against the targets above.
