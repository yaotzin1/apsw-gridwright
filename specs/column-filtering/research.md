# Research: column filtering

## Options considered

### Option A — A popover inside each header cell

**How it works.** Each `<th>` holds its trigger and, when open, its own absolutely positioned
dialog.

**Rejected because.** Two properties of the existing markup defeat it. `.gw-table-wrapper` has
`overflow-x: auto`, and a scroll container clips both axes, so the dialog is cut off at the bottom
of the table; the shortest table is exactly the one a filter produces when it matches nothing. And
a dialog in a `<th>` is content of the column header, so its labels and buttons join the header's
accessible name, which a screen reader repeats on every cell in the column. `position: fixed` would
fix the clipping but not the name, and `.gw-header-cell` is `position: sticky` with a z-index, so a
later header cell would also paint over an earlier cell's dialog.

### Option B — A React portal to `document.body`

**How it works.** `createPortal` renders the dialog at the end of the body.

**Rejected because.** It imports `react-dom` into the React entry, which today imports only `react`
and `react/jsx-runtime`, for one component. It also moves the dialog out of `.gw-root`, where the
theme's custom properties are defined, so the dialog would lose the grid's colours, and out of the
`dir`/`lang` the root sets.

### Option C — One dialog rendered by a provider, beside the table

**How it works.** `ColumnFilterProvider` holds which column is open and renders a single dialog as
a sibling after its children, inside `.gw-root`, with `position: fixed` coordinates measured from
the trigger. Triggers register themselves with the provider so focus can be returned and
positions measured.

**Chosen because.** It escapes the wrapper's clipping, keeps the dialog out of every header's name,
inherits the root's theme, direction and language, needs no new import, and has a precedent:
`BubbleMenu` escapes the same wrapper the same way. One dialog also means one set of document
listeners rather than one per column.

### Option D — Apply on a debounce

**How it works.** Every keystroke updates the query after 250 ms of quiet.

**Rejected because.** It contradicts "Escape cancels", and it sends a request for every pause while
typing a number such as `100000`, each of which a remote source answers and the reader never
wanted. An Apply button, with Enter as its shortcut, is one request per decision.

## Prior art

- **AG Grid** filters from a header menu with Apply optional, and debounces by default. The debounce
  is the setting its own documentation tells server-side users to turn off.
- **MUI X Data Grid** opens one filter panel for the whole grid from the column menu, rendered in a
  portal. It is the closest shape to Option C, minus the portal.
- **TanStack Table** is headless and ships no filter UI, which is the gap this package's engine had
  until now.

This package differs from all three in refusing to infer a column type from its data.

## Measurements

Not a performance change. The pipeline is untouched; applying a filter costs what `setFilter` has
always cost. The one per-render cost added is a `getFilter` lookup per visible column in the header,
a linear scan of `query.filters`, which holds one entry per filtered column.

| Scenario | Rows | Before | After |
| :--- | ---: | ---: | ---: |
| — | — | — | — |

## Open questions

None blocking stage 6.
