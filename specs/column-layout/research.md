# Research: column layout (resizing, pinning and visibility)

## Options considered

### Option A — A width per cell, in React state

**How it works.** The add-on keeps `widths` in React state and contributes
`cellAttributes: (row, column) => ({ style: { width: widths[column.id] } })`. A drag calls
`setWidth` on every pointer move.

**Rejected because.** Every pointer move re-renders every mounted cell. At 25 rows and 8 columns
that is 200 elements per frame, and under `virtualRows()` with 40 rows on screen it is 320. The
drag is the one interaction in this feature that runs at frame rate, and it is the one that must
not go through React.

### Option B — CSS custom properties on the table, committed on release

**How it works.** The table carries one custom property per column,
`--gw-col-w-<token>: 180px`, contributed through `tableAttributes.style`. Header and body cells
read it: `style={{ width: 'var(--gw-col-w-<token>)' }}`. A drag writes the property directly on the
table element with `style.setProperty`, so the browser repaints the column and React renders
nothing. The final width is committed to state on `pointerup`, which is also when sticky offsets,
`onChange` and the announcement happen.

**Chosen because.** One style mutation per frame instead of hundreds of renders, and the committed
state stays the single source of truth: the property written during the drag is overwritten by the
same property computed from state on the next render, so the two cannot disagree.

### Option C — Frozen panes: a second table for the pinned columns

**How it works.** What several grids do: render pinned columns in their own table, absolutely
positioned over the scrolling one, and keep row heights in sync.

**Rejected because.** It duplicates the DOM, splits one ARIA grid into two, and makes row height a
thing that has to be synchronised by measurement. `position: sticky` does the same job in the
browser's own layout, keeps `role="grid"` on one table, and needs no measurement at all. The price
is the offset arithmetic, which is a pure function over the committed widths.

### Option D — Visibility by filtering columns out of the rendered list

**How it works.** The add-on contributes nothing to `configure` and instead renders only the
columns it considers visible.

**Rejected because.** Search and export read `ColumnDef.hidden` from the engine. A column hidden in
the view but not in the engine is still searched and still exported, so a reader who hides a column
and exports "what I can see" gets a file with a column they cannot see. Writing `hidden` through
`configure` keeps one answer to "which columns count".

## Prior art

| Grid | Widths during a drag | Pinning | Applies here |
| :--- | :--- | :--- | :--- |
| AG Grid | Inline styles written imperatively on cells | Separate pinned containers | The imperative write is the same idea as Option B; the containers are Option C, rejected above |
| TanStack Table | Headless: exposes a `columnSizing` state and a `getSize()`, rendering is the consumer's | Headless `columnPinning` state, offsets computed by the consumer | Closest to this package's split; the difference is that here the adapter also ships the rendering, so the offsets are computed once rather than in every consumer |
| MUI DataGrid | React state per resize, throttled | Sticky positioning | Confirms sticky is sufficient; the throttled state is Option A with the symptom managed rather than removed |

Where this package deliberately differs: the width is a CSS custom property rather than an inline
style per cell, because a custom property is one write for the whole column, and because it gives a
consumer's stylesheet somewhere to read the width from.

## Measurements

No performance claim is made from a benchmark here; the change is justified by the number of
renders it avoids, which is counted rather than measured:

| Scenario | Mounted cells | Renders per pointer move, Option A | Renders per pointer move, Option B |
| :--- | ---: | ---: | ---: |
| Paged grid, 25 rows x 8 columns | 200 | 200 | 0 |
| Windowed grid, 40 rows x 8 columns | 320 | 320 | 0 |

The committed release renders once, as any state change does.

## Open questions

None. The one that was open at the start of stage 3 — how an add-on reaches another add-on's extra
column, for the selection checkbox that sits to the left of every left-pinned column — was already
answered by `extraCellAttributes` and `extraHeaderAttributes` on the add-on contract
(`spec.md` C-1), which `tests/react/third-party-addon.test.tsx` exercises.
