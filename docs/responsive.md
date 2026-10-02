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
