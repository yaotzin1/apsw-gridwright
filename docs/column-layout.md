# Column layout: resizing, pinning and visibility

```tsx
import { Gridwright, columnLayout } from 'apsw-gridwright/react';

<Gridwright columns={columns} dataSource={source} addons={[columnLayout()]} />;
```

That is the whole feature: drag handles on every header, a "Columns" picker in the toolbar, and
`layout` on any column that wants to say something about itself.

The three arrive together because they are one problem. A pinned column sits at an offset that is
the sum of the widths of the pinned columns before it, so resizing one moves the rest and hiding one
collapses the gap it left. Three separate add-ons would be three copies of that arithmetic,
disagreeing at the edges.

## What a column can say

```tsx
const columns: GridwrightColumn<Person>[] = [
    {
        id: 'name',
        header: 'Name',
        width: 240,
        layout: { pinned: 'left', hideable: false },
    },
    { id: 'department', header: 'Department', width: 200 },
    { id: 'salary', header: 'Salary', width: 170, layout: { maxWidth: 260 } },
    { id: 'active', header: 'Status', width: 150, layout: { pinned: 'right', resizable: false } },
];
```

| Field | Type | Default | What it does |
| :--- | :--- | :--- | :--- |
| `width` | `number \| string` | the add-on's `defaultWidth` | The column's starting width. A `ColumnDef` field, not a `layout` one |
| `minWidth` | `number` | the add-on's `minWidth` | The narrowest it may be dragged. Also a `ColumnDef` field |
| `layout.resizable` | `boolean` | `true` | `false` removes the handle from this header |
| `layout.pinned` | `'left' \| 'right'` | unpinned | Which edge it starts frozen against |
| `layout.hideable` | `boolean` | `true` | `false` shows it in the picker checked and refusing to change |
| `layout.maxWidth` | `number` | none | The widest it may be dragged |

`layout` reaches `GridwrightColumn` by module augmentation, from the add-on's own module, exactly as
`filter` and `edit` do. An add-on of your own adds a column option the same way; see
[extensibility](extensibility.md).

### A width the add-on cannot add up

Sticky offsets are a sum of pixel widths, so `width` has to be a number of pixels: `240` and
`'240px'` both work. `'20%'`, `'auto'` and `'12em'` do not — there is no number to add — and a
column declared that way renders at `defaultWidth` (150) until somebody resizes it. This is said out
loud rather than guessed at: measuring the rendered width would make the layout depend on the order
things happened to mount in.

## What the add-on takes

```tsx
columnLayout({
    initial: savedLayout,
    onChange: (layout) => localStorage.setItem('grid-layout', JSON.stringify(layout)),
    picker: true,
    resizable: true,
    defaultWidth: 150,
    minWidth: 50,
    extraColumnWidth: 48,
});
```

| Option | Type | Default | What it does |
| :--- | :--- | :--- | :--- |
| `initial` | `Partial<ColumnLayoutState>` | — | A layout to start from: what `onChange` last gave you |
| `onChange` | `(layout: ColumnLayoutState) => void` | — | Called after a change is committed and rendered |
| `picker` | `boolean` | `true` | `false` leaves the toolbar alone so you can place `<GridColumnPicker />` yourself |
| `resizable` | `boolean` | `true` | `false` removes every handle; a picker-and-pinning grid |
| `defaultWidth` | `number` | `150` | For a column with no pixel `width` of its own |
| `minWidth` | `number` | `50` | The floor under every column, beneath its own `minWidth` |
| `extraColumnWidth` | `number` | `48` | For another add-on's column, such as the selection checkbox |

## Resizing

Drag the divider at the trailing edge of a header, or reach it with Tab and use the keyboard:

| Key | Does |
| :--- | :--- |
| `ArrowLeft` / `ArrowRight` | 5px narrower or wider — towards the end of the line always widens, so this is mirrored in a right-to-left page |
| `Shift` + arrow | 20px |
| `Home` | Snap to the minimum |
| `Enter`, or a double-click | Fit the content |

The new width is announced through the grid's live region on every step and on release.

**A drag does not re-render anything.** Column widths are CSS custom properties on the `<table>`
(`--gw-col-w-<column id>`), and each cell's `width` reads its column's property. A drag writes the
property straight onto the table element, so the browser repaints one column and React is not
involved; the width is committed to state on release, which is also when sticky offsets recompute
and `onChange` runs. At 25 rows and 8 columns the alternative is 200 elements re-rendered per
pointer move.

**Auto-fit measures what is mounted.** Under [`virtualRows()`](virtualization.md) that is the rows
on screen, not every row in the result: fitting a column to rows nobody has scrolled to would mean
fetching them, and a double-click is not a request for a download.

## Pinning

A pinned column is `position: sticky` at a computed offset. Offsets are logical, so `'left'` means
the start of the row and lands on the right in a right-to-left page.

The reader gets no pin control from this package, because where one belongs is a decision your
application makes. Build it out of the controller:

```tsx
import { useColumnLayout } from 'apsw-gridwright/react';

function PinButton({ columnId }: { columnId: string }) {
    const layout = useColumnLayout();
    const pinned = layout.pinOf(columnId) === 'left';
    return (
        <button type="button" aria-pressed={pinned} onClick={() => layout.setPinned(columnId, pinned ? null : 'left')}>
            Pin to start
        </button>
    );
}
```

Render it in an add-on of your own, in a toolbar slot, or anywhere inside the grid. The picker and
the resize handles use this same controller and nothing else.

**Another add-on's column comes with it.** The `selection()` checkbox column is pinned to the start
whenever any data column is, without being asked: a checkbox that scrolls out from under the name it
belongs to is worse than no pinning at all. It reaches the checkbox column through
`extraHeaderAttributes` and `extraCellAttributes`, which every add-on has. Override it by naming the
column in the layout: `initial: { pinned: { 'gridwright:selection': null } }`.

**Pinning needs something to be still against.** The table is `table-layout: fixed` with
`width: max-content`, so it grows past its container and the table's own wrapper scrolls sideways.
In a grid whose columns already fit, nothing scrolls and nothing appears pinned; that is correct,
not broken.

**Give the grid's container `min-width: 0`.** A flex or grid item is `min-width: auto` by default,
which means it refuses to be narrower than its content. Put a grid inside one and a wide table
pushes that container -- and usually the whole page -- sideways, instead of scrolling inside its own
wrapper. Nothing in the package can fix this from the inside, because the container belongs to your
layout:

```css
.the-thing-the-grid-sits-in {
    min-width: 0;
}
```

The symptom is a page that scrolls horizontally with no scrollbar on the table and no column
staying put.

## Visibility

The picker is a `role="menu"` of `menuitemcheckbox` items, grouped the way the table paints the
columns — pinned to the start, scrolling, pinned to the end — so the order a reader hears is the
order they see. Below them are "Show all columns" and "Reset layout", which puts the widths and the
pinning back as well.

A column with `layout: { hideable: false }` stays in the list, checked and refusing to be unchecked,
rather than being left out: a reader looking for a column they can see has to find it somewhere. The
last visible column cannot be hidden either.

**Hiding writes `hidden` onto the column**, through the add-on's `configure`, so the engine sees it
and not just the renderer. That is what makes an export cover what the reader is looking at:
`buildExportTable` leaves a hidden column out.

**Global search still reads a hidden column.** `hidden` says what is rendered and what an export
covers; `searchable` says what global search reads. They are two switches because they are two
questions, and a column somebody hid from view is not a column they want search to stop finding rows
by. Set `searchable: false` as well if you want both.

## Saving the layout

`onChange` hands you a `ColumnLayoutState` and `initial` takes one back. It is plain JSON on both
sides:

```json
{
  "widths": { "name": 240, "salary": 120 },
  "pinned": { "name": "left", "department": null },
  "hidden": { "city": true }
}
```

```tsx
const [saved] = useState(() => {
    try {
        const stored = localStorage.getItem('grid-layout');
        return stored ? JSON.parse(stored) : undefined;
    } catch {
        return undefined;
    }
});

<Gridwright
    columns={columns}
    data={rows}
    addons={[columnLayout({ initial: saved, onChange: (layout) => localStorage.setItem('grid-layout', JSON.stringify(layout)) })]}
/>;
```

Three things worth knowing about that round trip:

- **`onChange` is not called on mount**, so a handler that writes to storage does not overwrite a
  saved layout with the default one on every page load. It is not called during a drag either: one
  call per change, on release.
- **An unpinned column is `null`, not `undefined`.** `JSON.stringify` drops a key whose value is
  `undefined`, so "explicitly not pinned" would come back from storage saying nothing at all and the
  column's own `layout: { pinned }` would pin it again.
- **`initial` is read field by field.** Whatever comes out of storage is parsed JSON of a shape
  nobody checked, possibly written by an older version of this package. Values that are not the type
  they claim to be are dropped, and prototype keys are refused, so a corrupted entry costs the
  reader their saved widths rather than their grid.

## The controller

`useColumnLayout()` inside a grid that lists the add-on, or `useOptionalColumnLayout()` where it is
genuinely optional.

| Member | Does |
| :--- | :--- |
| `layout` | The current `ColumnLayoutState` |
| `widthOf(id)` | The width the column renders at now, clamped |
| `pinOf(id)` | `'left'`, `'right'` or `null` |
| `isHidden(id)` / `canHide(id)` | Whether it is hidden, and whether it may be |
| `canResize(id)` | Whether a handle is drawn for it |
| `boundsOf(id)` | `{ min, max }`, from the column's `minWidth` and `layout.maxWidth` |
| `setWidth(id, width)` | Clamped to `boundsOf(id)` |
| `setPinned(id, side)` | `null` unpins, and outranks the column's own `layout.pinned` |
| `setHidden(id, hidden)` | Refuses when `canHide` is false |
| `showAll()` / `reset()` | Every column back, or the whole layout back to `initial` |

## Styling

| Custom property | Default | Used for |
| :--- | :--- | :--- |
| `--gw-col-w-<column id>` | the resolved width | One column's width. Set on the `<table>`; read by its header and body cells |
| `--gw-pinned-shadow-start` | `6px 0 8px -6px rgb(15 23 42 / 0.35)` | The edge of the last column pinned to the start |
| `--gw-pinned-shadow-end` | `-6px 0 8px -6px rgb(15 23 42 / 0.35)` | The edge of the first column pinned to the end |

The column id is escaped before it becomes part of a property name, so
`--gw-col-w-first_20_name` is the property for a column called `first name`. Use
`columnWidthProperty(id)` rather than building the name yourself.

| Class | On |
| :--- | :--- |
| `gw-table--fixed` | The table, while the add-on is listed |
| `gw-resize-handle` | The handle in each resizable header |
| `gw-cell--pinned` | Every pinned header cell and body cell |
| `gw-cell--pinned-left-last`, `gw-cell--pinned-right-first` | The boundary cells that carry the shadow |
| `gw-column-picker`, `gw-column-picker-menu`, `gw-column-picker-item` | The picker |

The boundary shadow is drawn whether or not the grid is scrolled at that moment. It tells the reader
which columns will stay before they find out by scrolling, and knowing the scroll position would
mean holding a ref to the scrolling wrapper, which `virtualRows()` already holds.

## Accessibility

- The resize handle is a focusable `role="separator"` with `aria-orientation="vertical"`, named for
  its column, carrying `aria-valuenow` and `aria-valuemin`, and `aria-valuemax` only where a column
  declared one. A `<button>` would replace the semantics that hold the value with semantics that
  hold a press.
- Every width change is announced, on a keyboard step and on release.
- A column shown or hidden is announced by name, through the add-on's announcement contributor
  rather than through `announce`: a column appearing or disappearing settles the grid's own state,
  and a sentence said any other way is spoken over by the row range that follows. Showing several at
  once says nothing, because naming one of them would tell the reader the others are still hidden.
- A hidden column is not rendered at all, so the DOM order stays the column order and no
  `aria-colindex` bookkeeping is needed.
- The picker is a real menu: arrow keys move between items, `Escape` closes it, and focus returns to
  the trigger.

## What this add-on is not

- **Column reordering.** A separate interaction with its own keyboard model.
- **Nested header groups.** A distinct architectural addition.
- **Proportional flex resizing with no horizontal scroll.** Fixed table layout is what makes a
  dragged edge stay where it was dropped.
