# Lifecycle contract: 2D cell navigation and clipboard copy

> **Immutable during stage 6.** Nothing locks this file; it holds because agents hold it.

## Events added

| Event | Payload | Emitted when |
| :--- | :--- | :--- |
| — | — | — |

No engine event, no `GridInstance` listener, no pipeline stage. `onActiveCellChange` is an option
callback, not an event: it is called from a React effect after the cursor has moved and the cell is
rendered, and it is not part of any emitter's ordering.

## Events changed

| Event | Before | After |
| :--- | :--- | :--- |
| — | — | — |

## Ordering guarantees

- **`onActiveCellChange` runs after the move is rendered**, not during the key handler, so reading
  the DOM from it finds the cell already carrying `tabIndex={0}`.
- **It never fires on mount.** The first cursor position is a default the add-on chose, not a move
  the reader made, and a handler that persists it would otherwise overwrite a restored cursor on
  every first paint. This is the rule `columnLayout({ onChange })` and
  `rowDetail({ onExpandedChange })` already follow.
- **A refused move fires nothing.** A key that could not move the cursor -- an edge, a missing
  column -- returns `false` from `tableKeyDown` and leaves state untouched.
- **The cursor never emits a query.** Moving it fetches nothing and changes no row's selection.

## Pipeline stages added

| Stage id | Order | Capability | Changes the total |
| :--- | ---: | :--- | :--- |
| — | — | — | — |

## Teardown

| Held | Released |
| :--- | :--- |
| The `requestAnimationFrame` handle used to focus a cell that had to be scrolled to first | Cancelled in the effect's cleanup, so an unmount mid-scroll does not call `focus()` on a detached node |

No other timer, listener or subscription. The key handler is a `tableKeyDown` contribution that
`GridTable` attaches to its own `<table>` and React removes with it; `useVirtualScroll()` and
`useOptionalTreeContext()` are read during render and subscribe to nothing of this add-on's.
