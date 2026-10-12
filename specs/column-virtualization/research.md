# Research: column virtualization

## Options considered

| Option | Verdict |
| :--- | :--- |
| **Gap cells in a real `<table>`** (chosen) | One empty cell per run of unmounted columns, as wide as the run, in every row. The table stays a table: column alignment, `scope="col"`, and sticky pinning all keep working. Needs fixed table layout so a declared width is the painted one. |
| Absolutely positioned cells over a div grid | What AG Grid does. Faster to lay out, but throws away table semantics, and every add-on that contributes cell or row attributes would need a second rendering path. Rejected for this package; worth revisiting for a separate spreadsheet renderer. |
| `<colgroup>` with hidden `<col>`s | Hidden columns still need their cells in every row, so nothing leaves the DOM. Rejected. |
| An option on `virtualRows()` | Couples the axes. Each is useful alone, and every feature is an add-on. Rejected (clarified with the maintainer). |

**State placement.** The window lives in the add-on's `setup` (state in a ref, a counter to ask for a
render), because the header, every row and the table element all read it. A render happens only when the
window's edges move, so the cost of re-rendering the grid is paid once per column crossed, not per pixel.

**Width source.** `columnLayout()` publishes its widths and pins (`columnGeometry`) rather than
`virtualColumns()` reading the layout's context, because `setup` runs before any provider exists. Same
pattern as `density()` publishing `rowHeight` for `virtualRows()`.

## Measurements

Chromium (Playwright's headless build), 1400 × 900 viewport, production React 19.2, 500 columns of 120,
160 and 200 px, 10,000 rows in memory, `cellNavigation()` listed. Each run scrolls programmatically for 240
animation frames: 90 px a frame horizontally (5,400 px/s, a fast fling), 45 px a frame vertically. Script
and layout are Chrome's `Performance.getMetrics` totals divided by frames. The harness lives outside the
repository (it needs a browser, which CI does not have); its numbers are reproducible with the playground's
wide demo and the browser's profiler.

| Setup | Scroll | DOM cells | Script ms/frame | Layout ms/frame | Mount ms |
| :--- | :--- | ---: | ---: | ---: | ---: |
| `virtualRows()` + `virtualColumns()` | vertical | 184 | 1.8 | 0.4 | 221 |
| `virtualRows()` + `virtualColumns()` | horizontal | 331 | 2.4 | 2.1 | 198 |
| `virtualRows()` + `virtualColumns()` | diagonal | 226 | 3.0 | 2.3 | 197 |
| `virtualRows()` only (before) | vertical | 7,515 | 58.2 | 11.6 | 621 |
| `virtualRows()` only (before) | horizontal | 11,001 | 0.1 | 0 | 608 |
| `virtualRows()` only (before) | diagonal | 7,515 | 60.7 | 13.0 | 654 |

Horizontal scrolling without column windowing is cheap because nothing re-renders; it is the vertical
scroll, re-rendering 500 cells per row, that misses the frame budget by an order of magnitude.

**Overscan.** Horizontal fling, total over 240 frames: overscan 2 → script 1,434 ms, layout 577 ms;
overscan 6 → 1,774 / 810; overscan 12 → 2,570 / 1,283. More overscan renders more per window move and does
not reduce how often the window moves at fling speed. Default 2.

**A pre-existing hot path in `cellNavigation()`.** Its cell slots rebuilt the list of every row id and
every column id once per cell, and searched the row ids again to resolve the cursor: under 10,000 rows and
500 columns that was millions of operations per render. Caching both per render (keyed on the engine's
rows, the resolved columns, the active add-ons and the stored cursor) took the horizontal fling from
1,388 ms of script to 593 ms over 240 frames. Without `cellNavigation()` the same run is 436 ms. The fix
also helps any `virtualRows()` grid that lists `cellNavigation()`.

**A layout bug found while measuring.** Chrome sizes a `width: max-content` fixed-layout table from what
its first row's cells could hold, so a header with a long sort label widened a 120 px column to about
130 px, and the table's width drifted by tens of pixels as the window moved. `contain: inline-size` on the
header cell's children removes the content from that calculation; the table then measured exactly 79,960
px (the sum of the declared widths) at every scroll position.
