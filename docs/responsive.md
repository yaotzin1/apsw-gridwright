# Responsive layout

`responsive()` lets a grid respond to the width of **its container**, not the window's. A grid in a
sidebar, a dialog or a phone gets the same treatment, because the number it reads is the width of
the space it was given.

```tsx
import { Gridwright, responsive } from 'apsw-gridwright/react';

const columns = [
    { id: 'name', header: 'Name' },
    { id: 'email', header: 'Email', responsive: { hideBelow: 700 } },
    { id: 'title', header: 'Job title', responsive: { hideBelow: 900 } },
];

<Gridwright columns={columns} data={rows} addons={[responsive()]} />;
```

## What it does

- **Hides columns by width.** A column with `responsive: { hideBelow: <px> }` is hidden while the
  container is narrower than that, and comes back when it widens.
  Only the view changes: the column is still sorted, filtered, searched and exported, and
  `columnLayout()`'s saved layout never sees the width (so `onChange` does not fire for a resize).
- **Lets go of pinning on a narrow container.** When the pinned columns would take more than half
  the width, they stop sticking at that width. The reader's pins are kept and return when there is room.
- **Shares the width.** `useContainerWidth()` returns the width in pixels, or `null` before it is
  measured or when `responsive()` is not listed. Use it in an add-on's own component to adapt.

## Without `responsive()`

Nothing about columns changes. The stylesheet does change for everyone, and these are the visible
differences:

- On a **coarse pointer** (`pointer: coarse`) the sort button, buttons, selects, menu items and the
  column picker are at least `--gw-touch-target` (44 px) high. A mouse is unaffected.
- Overlays (the column picker menu, the row menu) are never wider than the screen.
- A `rowActions()` menu gets a **three-dot button** on each row on a device that cannot hover
  (`hover: none`), whatever its `trigger` is: a finger can neither hover nor right-click. Tapping it
  opens the menu and does not select the row.
  On such a device the row's own hover and click routes are off, so one tap is enough and a tap on the
  row selects it; a long press still opens the menu through the context-menu route.

## Rows as cards

`responsive({ stackBelow: 560 })` draws each row as a card while the container is narrower than 560 px: one line per
visible column, the column's header as the label, and the cell as the value.

- **The header row goes, a sort control takes its place.** A "Sort by" select (and a direction select once a
  column is chosen) sit in the toolbar and read and write the same sort state as the header buttons. They set
  the primary sort; a multi-sort made earlier is replaced, as a plain header click would.
- **Semantics are kept.** `role="grid"` stays on the table, rows and cells get explicit `row` and `gridcell`
  roles, and the header cells stay in the document, visually hidden, so each value still has its column header.
  The visible label is generated from the header text with an empty alternative, so a screen reader hears the
  header once. This has not been checked with a screen reader yet.
- **Everything else works on a card:** selection, row detail, the tree, grouping and `rowActions()`.
- **Keyboard.** With `cellNavigation()`, ArrowDown and ArrowRight go to the next value and ArrowUp and ArrowLeft to
  the previous, on to the next card at the end of one. The header row is not reachable while it is not drawn.
- **A hidden column stays hidden** in a card, and pinned columns lose their stickiness.
- **`virtualRows()` wins.** Windowing places rows by a fixed height, so with it listed `stackBelow` is ignored and
  the table stays a table. Nothing throws.

## A sort or filter on a column the width has hidden

It stays in force, because hiding is a view concern. A line above the table says so ("Sorted by Department,
hidden at this width"), so the order of the rows is never unexplained.

## An add-on that changes with the width

An add-on is always listed, so the grid's add-on list never changes with the width (each add-on
calls hooks, and the list of names is the grid's identity). To draw something different on a narrow
container, give the contribution a `whenNarrow`:

```tsx
const filters = (): GridAddon<Row> => ({
    name: 'acme:quick-filters',
    setup: () => ({
        toolbar: () => <QuickFilterBar />,
        // Below 600 px the bar becomes a single button that opens a popover.
        whenNarrow: { below: 600, contribution: { toolbar: () => <QuickFilterButton /> } },
    }),
});
```

Below `below` pixels the narrow slots replace the same-named ones; every other slot keeps the base
contribution. The edge is hard (no hysteresis), the add-on's `setup` state survives a resize, and it
needs `responsive()` in the list: without a measured width the base contribution always applies.
`whenNarrow` can change what is drawn; it cannot change `configure`, `plugins`, `columnSignature`,
`provide` or `messages`, which describe the engine and do not depend on a screen.

## Server rendering

The first render is the full table, so the server and the client produce the same markup. Pass
`responsive({ initialWidth })` when you know the device class at request time. The measured width
applies after mount.

## A grid in a shrink-to-fit parent

A grid listing `responsive()` becomes a CSS size container. That is the one thing that changes how it
sizes itself: in an `inline-block`, a float or a flex item with no `min-width`, it takes **30 rem**
instead of the width of its content. Give the parent a width, or use a block, grid or `flex: 1`
parent. A grid that does not list `responsive()` is not a size container and sizes as before.

## Testing

jsdom has no layout. Stub `ResizeObserver` and push the width in, as `tests/react/responsive.test.tsx`
does. Check the stylesheet in a real browser in a **visible** window: a background tab runs no frames,
so the observer never fires.
