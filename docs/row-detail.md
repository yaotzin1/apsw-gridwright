# Expandable rows

A panel under a row, holding whatever that row needs: a second grid, a form, the fields that did not
earn a column, a chart, a label.

```tsx
import { Gridwright, rowDetail } from 'apsw-gridwright/react';

<Gridwright
    columns={columns}
    dataSource={source}
    aria-label="Orders"
    addons={[
        rowDetail({
            render: ({ data }) => <Gridwright columns={lineColumns} data={data.lines} aria-label="Line items" />,
        }),
    ]}
/>;
```

That is the whole integration. A toggle column appears at the start of each row, and pressing a
toggle renders your node in a full-width row directly under its own row.

## Options

| Option | Type | Default | What it does |
| :--- | :--- | :--- | :--- |
| `render` | `(context) => ReactNode` | required | The panel's content. See [What `render` receives](#what-render-receives). |
| `hasDetail` | `(row, grid) => boolean` | every row | `false` draws no toggle for that row at all. |
| `rowLabel` | `(data, grid) => string` | the first visible column's text | Names the row in the toggle and the panel. |
| `initialExpanded` | `readonly RowId[]` | `[]` | Open on the first render. Never reported to `onExpandedChange`. |
| `onExpandedChange` | `(expanded: RowId[]) => void` | — | After a change is committed and rendered. |
| `single` | `boolean` | `false` | Opening one panel closes the other. |
| `toggle` | `'start' \| 'end' \| 'none'` | `'start'` | Which side the toggle column goes, or none at all. |
| `persistAcrossPages` | `boolean` | `true` | Keep an expansion when the query moves the row away. |
| `canToggle` | `(rowId, expanded) => boolean` | — | Refuse a change. It narrows and never widens. |
| `className` | `string` | — | Added to the panel's region. |
| `controllerRef` | `(controller \| null) => void` | — | Receives the controller once, and `null` on unmount. |

## What `render` receives

```tsx
rowDetail({
    render: ({ row, data, grid, close }) => (
        <div>
            <button type="button" onClick={close}>close</button>
            <p>{data.email}</p>
        </div>
    ),
});
```

- **`data`** — your row. Under `treeData()` the engine's rows are `TreeNode`s; this is already
  unwrapped, and so is `row.data`, so a renderer written against your own type never has to know.
- **`row`** — the `GridRow`: `id`, `index`, `selected`.
- **`grid`** — the *outer* grid. Capture it here if you need it: see the traps below.
- **`close`** — collapses this panel, for a close button inside it.

`render` is called only while the panel is open, and a collapsed panel is **unmounted**. That is the
lazy load: a component that fetches its own data fetches when it opens and cleans up when it closes.
There is no `loadDetail`, because nothing but React needs the result.

Returning `null` or `undefined` renders no panel row at all. Prefer `hasDetail` when you know the
answer without rendering — it is asked before the toggle is drawn, so the row does not get a control
that opens nothing.

## Driving it yourself

`useRowDetail()` returns the same controller the built-in toggle uses, from anywhere inside the grid:

```tsx
function ExpandAll() {
    const detail = useRowDetail();
    return <button type="button" onClick={() => detail.expandAll()}>expand all</button>;
}

<Gridwright ... toolbar={<ExpandAll />} addons={[rowDetail({ render })]} />;
```

| Member | What it does |
| :--- | :--- |
| `expanded` | Every expanded id, including rows this page does not hold. |
| `isExpanded(rowId)` | — |
| `allows(rowId, expanded)` | Whether that change would be allowed, without making it. |
| `expand` / `collapse` / `toggle` | One row. |
| `expandAll()` | Every row **the grid is currently holding** that has detail. |
| `collapseAll()` | Everything. |

`expandAll()` does not touch pages that have not been fetched, and nothing reports a count of
expanded rows across the result set — that would be a number computed from one page.

Ask `allows` from any control of your own, so your control and the built-in one cannot disagree
about what `canToggle` permits. The built-in toggle disables itself when the answer is no.

With `toggle: 'none'` no column is contributed and you place `<GridDetailToggle rowId={row.id} />`
yourself — in a cell renderer, say. It is named and wired exactly the same way.

## Persisting what a reader opened

```tsx
rowDetail({
    initialExpanded: JSON.parse(localStorage.getItem('open') ?? '[]'),
    onExpandedChange: (ids) => localStorage.setItem('open', JSON.stringify(ids)),
    render,
});
```

`onExpandedChange` does not fire for `initialExpanded`, so a handler that writes to storage cannot
overwrite a saved set on the first paint.

Expansion is keyed on `GridRow.id`, so it survives sorting, filtering and paging: a reader who opens
a panel, pages forward and pages back finds it open. Set `persistAcrossPages: false` for a source
whose ids are not stable across pages, where a remembered expansion would open a panel on a
different record.

## A grid inside a grid

This is the case the add-on exists for, and there are three things to know.

**`useGridwrightContext()` inside the panel resolves to the inner grid.** Ordinary React context,
surprising the first time. The outer grid is the `grid` argument `render` is handed — capture it
there.

**Each grid has its own live region.** Six open panels mean six of them on the page. Nothing is
broken; it is worth knowing before you open thirty.

**Nothing leaks between them.** The inner grid's keyboard is its own: `GridTable` ignores a keydown
whose closest `<table>` is not its own, so a `cellNavigation()` add-on on the outer grid does not
act on arrow keys pressed inside the inner one.

A bare nested table, with no sort buttons or page controls, is `coreAddons={false}`:

```tsx
render: ({ data }) => (
    <Gridwright columns={fieldColumns} data={fieldsOf(data)} coreAddons={false} aria-label={`Fields of ${data.name}`} />
),
```

## Accessibility

The toggle is a real `<button>` with `aria-expanded`, so Enter and Space come from the platform. It
is named after its row — *Show details for ACME Ltd* — because a column of forty identically named
buttons tells a screen reader nothing about which row each one belongs to. While the panel is open
the toggle's `aria-controls` names it; while it is closed the panel is not in the document and the
attribute is left off rather than dangling.

Focus stays on the toggle across both transitions. The panel is content in a table, not a dialog:
nothing is focused for the reader and nothing is trapped. Its own controls follow the toggle in the
tab order because they follow it in the DOM.

**The panel is not a row of the grid**, and that is deliberate. `aria-rowcount` and every
`aria-rowindex` this package emits describe the whole result set rather than what is mounted, so a
panel given `role="row"` would claim a position in that set — and the count would have to include
panels on pages that have never been fetched. So the `<tr>` and its `<td>` are `role="presentation"`
and the numbering is untouched, while the content inside is a `role="region"` named after its row,
which is what a reader moves into. The trade-off is written up in
[`specs/row-detail/spec.md`](../specs/row-detail/spec.md) §6.

Every string is in the add-on's `gridwright:row-detail` messages, translated in all five packs.

## What it does not do

- **Windowing.** Listing `rowDetail()` with `virtualRows()` throws, naming both. `useVirtualRows`
  places rows by a fixed row height; a panel is as tall as its content, and every row below it would
  drift from the scrollbar with nothing failing. A measured virtualizer is a different piece of work.
- **Exports.** A CSV, an Excel sheet and a Markdown report contain the columns.
  `buildExportTable` works from columns and rows, and a panel is a ReactNode with no cells.
- **Animate.** No transition ships. Height animation needs a measured height.
- **Expand on row click.** `onRowClick` stays yours. A row that expands when clicked anywhere cannot
  also hold a clickable cell.

## With the other add-ons

| Add-on | Together |
| :--- | :--- |
| `treeData()` | Both. The tree's chevron opens children, the detail toggle opens a panel, and the two `aria-expanded` values sit on two different elements. `render` receives your row. |
| `selection()` | Two start-placed columns; neither click reaches the other. |
| `columnLayout()` | The panel's cell is not a data cell, so it gets no width or sticky offset. Its content is `position: sticky; left: 0` so it stays at the reader's edge while the table scrolls sideways; a column pinned to the start still paints over it. |
| `rowActions()` | Both. The menu attaches to data rows, and the panel row is not one. |
| `virtualRows()` | Refused, by name. |

## Writing your own

`rowAfter` on the add-on contract is what `rowDetail()` is built from, and it is public: an add-on of
your own can put a row after a row on exactly the same terms. See
[add-ons](addons.md#the-body).
