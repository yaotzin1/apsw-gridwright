# Research: column reordering

## Options considered

### Option A — A drag-and-drop library

**How it works.** `dnd-kit`, `react-dnd` or `interactjs` supplies sensors, a drag overlay, collision
detection and a keyboard story.

**Rejected because.** It is a runtime dependency, which this package has none of and takes none of
without a decision recorded in a spec. The problem here is also far smaller than what those
libraries solve: one element moving within one row, over targets that are laid out left to right
with no nesting and no free positioning. `dnd-kit` alone is larger than this entire package.

### Option B — Pointer events, as the resize handle uses

**How it works.** `pointerdown` on the header, capture the pointer, track `pointermove` to find the
column under the cursor, commit on `pointerup`. The same machinery already written for resizing.

**Rejected because.** Resizing needs a continuous stream of positions, which is what pointer capture
is for. A reorder needs three moments — where it started, what it is over, where it was dropped —
and taking the pointer route means re-implementing the drag image, the drop cursor, escape-to-cancel
and the auto-scroll when the pointer nears the edge of a scrolling container, all of which the
browser already does. It would also fight the resize handle for the same `pointerdown`.

### Option C — The native HTML drag-and-drop API

**How it works.** The header cell gets `draggable`, and `onDragStart`, `onDragOver`, `onDrop` and
`onDragEnd` do the rest. The browser supplies the drag image, the cursor, the cancel gesture and
the auto-scroll.

**Chosen because.** It is the smallest thing that works, it needs no dependency, and — decisively —
it needs no change to the add-on contract: `draggable` is already in `CONTRIBUTABLE_ATTRIBUTES`, and
`on*` handlers are already permitted. A third-party add-on could write this feature today. Its known
weaknesses do not bite here: the API is awkward for free-form positioning and for touch, and this
feature is neither free-form nor the only way in, because the keyboard path is a first-class
alternative rather than a fallback.

### Option D — Keyboard: a new focusable control per header

**How it works.** A "move" button beside the resize handle, with arrow keys.

**Rejected because.** Every header already costs a keyboard user two Tab stops under
`columnLayout()` — the sort button and the resize handle. A third makes Tab through a ten-column
header thirty presses, for every keyboard user, whether or not they ever reorder anything.
`Ctrl`+arrow on the control that is already focused costs nothing.

### Option E — Keyboard: bare arrows on the header

**How it works.** `ArrowLeft` / `ArrowRight` on the focused header moves the column.

**Rejected because.** Bare arrows inside a `role="grid"` belong to cell navigation, which
`specs/cell-navigation-and-clipboard` is specified to add. Taking them now means giving them back
later, and a keyboard shortcut that moves is much harder to take away than one that was never
offered.

## Prior art

| Grid | Pointer | Keyboard | Pinned columns |
| :--- | :--- | :--- | :--- |
| AG Grid | Native HTML drag-and-drop on the header | None by default | Dragging into a pinned region pins the column |
| TanStack Table | Headless: exposes `columnOrder` state, the drag is the consumer's | Consumer's | Consumer's |
| MUI DataGrid | Native drag-and-drop | None | Reordering is constrained within the pinned group |

Two things are worth taking. AG Grid's rule that **dropping into a pinned region pins the column** is
the same conclusion this spec reaches independently (C-4), and it is reassuring that the obvious
alternative was not chosen by someone who had to ship it. And TanStack's `columnOrder` confirms that
an array of ids is the shape this state wants.

Where this package differs: **the keyboard path is not optional here.** Two of the three grids above
ship reordering with no keyboard route at all. Accessibility is a blocking gate in this repository,
so a reorder a keyboard user cannot perform would not be a reorder feature, it would be a pointer
feature with a gap.

## Measurements

No performance claim. The change is one array reordering per commit, over a list whose length is the
column count — tens, not thousands — and it happens on a drop or a keypress, never per row, per cell
or per frame. `orderedColumns` runs once per render in the same pass that already computes widths
and offsets.

The one number worth stating is what it does **not** do: a reorder does not refetch. It calls
`setColumns`, which re-resolves columns and re-runs the pipeline over the rows already held; no
request is made, because no facet of `GridQuery` changed.

## Open questions

None. The two that were open at the start of stage 3 are resolved in the spec's clarifications:
whether the feature is its own add-on (C-1: no, it shares state with pinning) and what happens when
a column is dropped among pinned ones (C-4: it takes that pin).
