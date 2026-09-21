# Column layout: resizing, pinning and visibility

```tsx
import { Gridwright, columnLayout } from 'apsw-gridwright/react';

<Gridwright columns={columns} dataSource={source} addons={[columnLayout()]} />;
```

That is the whole feature: drag handles on every header, draggable headers, a "Columns" picker in
the toolbar, and `layout` on any column that wants to say something about itself.

The four arrive together because they are one problem. A pinned column sits at an offset that is
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
| `layout.movable` | `boolean` | `true` | `false` keeps it where it is, and nothing may be moved across it |
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
| `reorderable` | `boolean` | `true` | `false` makes no header a drag source and removes the shortcut |
| `defaultWidth` | `number` | `150` | For a column with no pixel `width` of its own |
| `minWidth` | `number` | `50` | The floor under every column, beneath its own `minWidth` |
| `extraColumnWidth` | `number` | `48` | For another add-on's column, such as the selection checkbox |
| `canChange` | `(change, layout, resolved) => boolean` | — | Refuses a change your application's rules do not allow. Ask `resolved`, not `layout`, for what is actually pinned or hidden |

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

**The reader pins from the column picker**, which offers both edges beside each column's visibility
checkbox. Pressing the edge a column is already pinned to unpins it.

**Pinning moves the column to the edge**, and unpinning moves it clear of the run it was in. A
column frozen in the middle of the row is not what "pinned to the start" means to the reader who
asked for it, and one left unpinned between two frozen columns would scroll away and leave a hole.
`setPinned` does both in one update, so a control of your own gets the same behaviour for free:

```tsx
layout.setPinned('salary', 'left'); // pinned, and now the innermost column of the start run
layout.setPinned('salary', null); // unpinned, and now just clear of it
```

A declared `layout: { pinned: 'left' }` is different: it is you saying where the column is *and*
that it is frozen, so it stays where you put it in the array.

For a pin control somewhere other than the picker — a toolbar, a settings dialog — build it out of
the controller:

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

Render it in an add-on of your own, in a toolbar slot, or anywhere inside the grid. The picker, the
resize handles and the drag all use this same controller and nothing else.

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

## Reordering

Drag a header sideways and drop it where you want it, or focus a header and use the keyboard:

| Key | Does |
| :--- | :--- |
| `Ctrl` / `Cmd` + `ArrowLeft` | Move the column one position towards the start |
| `Ctrl` / `Cmd` + `ArrowRight` | Move it one position towards the end |

`Ctrl` rather than a bare arrow, because a bare arrow inside a grid belongs to cell navigation, and
a shortcut that moves is much harder to take away later than one that was never offered. The header
is already focusable for sorting, so reordering adds no Tab stop: a ten-column header does not
become thirty Tab presses for a keyboard user who never reorders anything. Each move is announced by
name and position.

The drag is the browser's own — `draggable` plus the native drag events — so the drag image, the
drop cursor, `Escape` to cancel and the auto-scroll when you near the edge all come from the
platform. There is no drag-and-drop library here and no runtime dependency. The cost is that native
drag-and-drop is weak on touch, which is the reason the keyboard path is a first-class route rather
than a fallback.

**A locked column is a wall.** `layout: { movable: false }` stops the column being moved *and* stops
anything being moved across it, so a column declared first stays first. Locking it any other way
would mean a reader could put something in front of it and achieve the same thing.

**Dropping into a run of pinned columns pins the column**, and dragging one out unpins it. A column
painted between two frozen ones would scroll away and leave a hole, which is not something anyone
can have meant by dropping it there.

**The order reaches the engine**, so `api.getColumns()` reports it and an export writes its columns
in it. A data source that reads `request.columns` to build its own projection receives them in the
reader's order too.

**A saved order that no longer matches the columns.** Ids naming a column that no longer exists are
ignored, and a column the saved order does not name goes after the ones it does, keeping its
declared position among the other unnamed ones. So a column you add later appears at the end for a
reader with a saved layout, and at its declared position for everyone else. The alternatives were
guessing where they would have put a column they have never seen, or throwing away their whole
arrangement because one column changed.

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
  "hidden": { "city": true },
  "order": ["name", "salary", "startedOn", "department"]
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
- **An order is a list of ids, validated as one.** A value that is not an array of strings is
  dropped and the grid keeps its declared order; ids are not checked against the columns, because
  `initial` is read before the columns are known and an unknown id simply falls out later.
- **`initial` is read field by field.** Whatever comes out of storage is parsed JSON of a shape
  nobody checked, possibly written by an older version of this package. Values that are not the type
  they claim to be are dropped, and prototype keys are refused, so a corrupted entry costs the
  reader their saved widths rather than their grid.

## Refusing a change

The per-column options — `resizable`, `hideable`, `movable` — are read on every render, so
`hideable: user.isAdmin` already works. What they cannot say is anything about *more than one*
column, and there is no per-column lock for pinning at all. `canChange` is for those:

```tsx
columnLayout({
    // At most three pinned columns: the fourth starts pushing the scrolling region off screen.
    canChange: (change, layout, resolved) =>
        change.type !== 'pin' ||
        change.side === null ||
        resolved.order.filter((id) => resolved.pinOf(id) !== null).length < 3,
});
```

It is called before every change the add-on commits — a width, a pin, a visibility toggle, a move,
"show all" and "reset" — and returning `false` refuses it. The change it receives is a discriminated
union, so a rule about one kind cannot read a field belonging to another:

It receives three things: the change, the **saved state**, and a **resolved view**.

```ts
type ColumnLayoutChange =
    | { type: 'width'; columnId: string; width: number }      // already clamped
    | { type: 'pin'; columnId: string; side: ColumnPin | null }
    | { type: 'visibility'; columnId: string; hidden: boolean }
    | { type: 'move'; columnId: string; toIndex: number }     // already clamped
    | { type: 'showAll' }
    | { type: 'reset' };
```

**`layout` is the reader's overrides; `resolved` is what is true.** `ColumnLayoutState` holds only
what the reader changed, because that is what round-trips through storage — a column pinned by its
own `layout: { pinned }` has no entry in it and never will. A rule that means "at most three pinned"
means three *pinned columns*, so it must ask `resolved`, not count `layout.pinned`:

```ts
interface ColumnLayoutResolved {
    readonly order: readonly string[];          // visible data columns, in painting order
    widthOf(columnId: string): number;          // already clamped
    pinOf(columnId: string): ColumnPin | null;  // the reader's choice, or the column's own
    isHidden(columnId: string): boolean;        // the reader's choice, or the column's own
    indexOf(columnId: string): number;
}
```

`ColumnLayoutController` extends it, so the guard's `pinOf` *is* the controller's `pinOf` and the
two cannot drift. It deliberately has no `allows`: `allows` is what calls your guard, so a guard
that could call it would recurse.

**It narrows and never widens.** A change the add-on already refuses — a column with
`movable: false`, the last visible column, reordering switched off — stays refused whatever your
guard returns. The add-on's own rules are the floor and the guard is a ceiling.

**It governs the controller too.** `setWidth`, `setPinned`, `moveColumn` and the rest are the same
entry points the built-in controls use, so your own control cannot step around your own rule.

**The controls that can, disable themselves.** A picker item, a pin toggle, "Show all columns" and
"Reset layout" whose change the guard would refuse are `aria-disabled` — not `disabled`, so they
keep their place in the arrow-key order and can still be read. A refused reset also leaves the menu
open, because closing it would be the one visible consequence of a change that did not happen. Ask
`allows` for the same answer in a control of your own:

```tsx
const layout = useColumnLayout();
const refused = !layout.allows({ type: 'pin', columnId, side: 'left' });
<button aria-disabled={refused || undefined} onClick={() => !refused && layout.setPinned(columnId, 'left')}>Pin</button>;
```

A resize and a drag cannot be disabled in advance, because the final width and the destination are
decided by the gesture; those are refused when they commit. Everything else names its change before
it happens, so everything else says so before it is pressed.

**Nothing is announced when a change is refused.** It is a thing that did not happen, and the live
region interrupting to describe a non-event is worse than silence. There is also no reason string:
only your application can phrase its own policy, and a generic "not allowed" helps nobody. Say it
where the rule is, or let the disabled control speak.

**A guard that throws allows the change and reports it**, the same rule a pipeline stage and a slot
follow. A rule that has silently stopped running is worse than one that was never there.

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
| `setPinned(id, side)` | Pins and moves to that edge; `null` unpins and moves clear. Outranks the column's own `layout.pinned` |
| `setHidden(id, hidden)` | Refuses when `canHide` is false |
| `order` | The visible data columns in painting order, by id |
| `indexOf(id)` / `canMove(id)` | The column's position, and whether it may be moved |
| `moveColumn(id, toIndex)` | Moves it to that position; out of range clamps |
| `allows(change)` | Whether that change would be allowed, without making it |
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
| `[data-movable]`, `[data-dragging]`, `[data-drop-target]` | A header that can be dragged, the one being dragged, and the edge a drop will land against |
| `gw-cell--pinned` | Every pinned header cell and body cell |
| `gw-cell--pinned-left-last`, `gw-cell--pinned-right-first` | The boundary cells that carry the shadow |
| `gw-column-picker`, `gw-column-picker-menu`, `gw-column-picker-item` | The picker |
| `gw-column-picker-row`, `gw-column-picker-pin` | One column's row in the picker, and its two pin toggles |

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
  the trigger. Each column contributes three items — its visibility checkbox and one pin toggle per
  edge — and each pin toggle is named for what it does ("Pin Salary to the start") with its checked
  state saying whether it is already done.

## What this add-on is not

- **Nested header groups.** A distinct architectural addition.
- **Proportional flex resizing with no horizontal scroll.** Fixed table layout is what makes a
  dragged edge stay where it was dropped.
