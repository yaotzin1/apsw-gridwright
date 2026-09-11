# Plan: unified options, virtualization and windowing

## Modules touched

| File | Change |
| :--- | :--- |
| `src/data/windowed.ts` | New. Block cache, LRU and distance eviction, generation guard, range fetching |
| `src/react/virtual/useVirtualRows.ts` | New. Scroll position to row range, including scaling above the browser's height limit |
| `src/react/virtual/GridVirtualBody.tsx` | New. Spacer rows, skeleton rows, moving the data window |
| `src/react/virtual/index.ts` | New. Entry for the two above |
| `src/react/Gridwright.tsx` | Rewritten as one component with `tree`, `virtual`, `rowActions`, `onCellEdit`; recognises a tree instance passed as `instance` |
| `src/react/types.ts` | `GridTreeOptions`, `GridVirtualOptions`, six new props, `icon` on a column |
| `src/react/tree/TreeGridwright.tsx` | Reduced to an alias over `<Gridwright tree={...} />` |
| `src/react/tree/useTreeGridwright.ts` | Options aligned with `GridTreeOptions` |
| `src/react/tree/TreeCell.tsx` | Renders the column's `icon` between the toggle and the label |
| `src/react/parts/GridBody.tsx` | Cell exported as `GridCell`; renders `icon` inside `.gw-cell-content` |
| `src/react/parts/GridTable.tsx` | `scrollRef` and `maxHeight` |
| `src/index.ts` | Exports the windowed source and its types |
| `src/styles/styles.css` | Bubble menu restyled; spacer, skeleton, cell-content and icon rules |

## Where the behaviour lives

The four questions from `.agents/rules/architecture.md`:

**Does it change which rows exist?** No, for all of it. Virtualization changes which rows are
*rendered*, and a windowed source changes which rows were *fetched*. Neither is a pipeline stage,
which is why nothing was added to `STAGE_ORDER`.

**Does it belong in `GridQuery`?** No. The window follows the scroll position, and the scroll
position is DOM state. It reaches the query only through the existing `setPage`, so persistence and
restoration keep working unchanged.

**Does it belong in `GridState`?** One key in `meta`, written by the source: where the held rows
start. Scroll position deliberately stays out, because publishing it would render every consumer of
the grid on every scroll frame.

**Is it an adapter concern?** Yes, for everything visual: the virtual body, the spacer rows, the
icons, the menu. The core gained one thing, `createWindowedDataSource`, which is a data source and
touches no DOM.

## Trade-offs taken

| Trade | Cost accepted | Reason |
| :--- | :--- | :--- |
| Fixed row height | A row taller than `rowHeight` overflows its slot | No per-row measurement, no observer per row, no DOM reads while scrolling. In a grid, fixed row height is normal |
| Spacer rows over absolute positioning | More arithmetic, and two extra `<tr>` elements | Keeps a real `<table role="grid">`, its column alignment and its semantics |
| Scaled scroll above 15,000,000 pixels | One pixel covers several rows; `scrollToIndex` lands close, not exact | The alternative is that rows past ~419,000 are unreachable, silently |
| `tree` remounts when toggled | Expansion and selection are lost on that switch | A tree and a flat list have different row identities. Pretending otherwise would carry stale ids |
| Options wrap columns, `instance` does not | A consumer owning the instance must call `editableColumns` | Only the code that built the instance knows whether the editor goes inside or outside the tree cell |

## Risks

| Risk | Mitigation |
| :--- | :--- |
| Row height drifts from the CSS and rows slide away from the scrollbar | Documented as a contract in three places, defaulted to the stylesheet's own 40px |
| The data window and the scroll position disagree while a fetch is in flight | The offset is published by the source with the rows, never recomputed by the reader |
| Setting the page from an effect causes a render loop | Guarded on the page actually changing, plus a ref holding the last requested page |
| Two overlapping fetches leave an empty grid | A load is only joined while its own request is alive, and the window is re-checked afterwards. Regression tests in `tests/unit/windowed.test.ts` |
| A fetch crossing `invalidate()` repopulates a cleared cache | Blocks carry the generation they were fetched for |
| The unified component silently drops an option | `tests/react/composition.test.tsx` renders each option alone and all of them together |

## Out of scope for this change

Variable row heights, horizontal virtualization, select-all over unfetched rows, client-side sorting
over a windowed source, and drag-and-drop reparenting. Each is named in `spec.md` with its reason.
