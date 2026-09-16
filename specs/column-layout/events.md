# Lifecycle contract: column layout (resizing, pinning and visibility)

> **Immutable during stage 6.** Nothing locks this file; it holds because agents hold it.

## Events added

No engine event. The engine emits `query:change`, `selection:change` and `fetch:*`, and none of
them is what happened when a reader dragged a column edge: no query changed, no row moved, nothing
was fetched. Adding `layout:change` to the emitter would put a presentation event on an object that
is documented as framework-agnostic, and every consumer of it would be a React consumer.

The one thing a consumer is told is an option on the add-on:

| Callback | Payload | Called when |
| :--- | :--- | :--- |
| `columnLayout({ onChange })` | `ColumnLayoutState` | after a width, a pin or a visibility change has been committed to state and rendered |

## Events changed

| Event | Before | After |
| :--- | :--- | :--- |
| — | — | — |

No existing payload changes, so nothing here is a major.

## Ordering guarantees

By the time `onChange` runs:

- the new layout is in state and the grid has rendered with it, so
  `controller.widthOf`, `pinOf` and `isHidden` already agree with the argument;
- for a visibility change, `configure` has already written `hidden` onto the columns and
  `api.setColumns` has already been called, so the engine's idea of which columns exist matches
  what the reader sees, and an export started from the `onChange` handler exports the right set;
- for a width change, the drag is over. `onChange` is never called per pointer move. A reader who
  drags a column edge across the table produces one call, on release.

`onChange` is not called for the initial layout. A grid that has just mounted has had nothing
changed on it, and a handler that writes to storage would otherwise overwrite a saved layout with
the default one on every page load.

## Pipeline stages added

| Stage id | Order | Capability | Changes the total |
| :--- | ---: | :--- | :--- |
| — | — | — | — |

No stage, and no plugin. Hiding a column does change what the search stage looks at and what an
export writes, but it does that through `ColumnDef.hidden`, which those stages already read.

## Teardown

| Held | Released | When |
| :--- | :--- | :--- |
| Pointer capture on the resize handle | `releasePointerCapture`, and the capture is implicitly dropped when the element unmounts | `pointerup` or `pointercancel` |
| The in-flight drag (its start position and start width) | cleared on release, cancel, and on unmount | the drag ends, or the handle unmounts mid-drag |
| The uncommitted width written on the table element during a drag | overwritten by the value computed from state on the next render; on `pointercancel` the last value seen is committed, so the property and the state never disagree | release, cancel, or the next render |
| The `onChange` handler | read from a ref, never from a closure captured when the drag started | — |

A drag that ends because the window lost the pointer is a `pointercancel`, and it commits rather
than reverts: the reader has seen the column at that width, and springing back would read as the
grid rejecting what they did.

Nothing is registered on `document` or `window` at all. Pointer capture retargets every later
`pointermove`, `pointerup` and `pointercancel` for that pointer to the handle itself, so the
handlers are ordinary React props on one element: a drag survives the cursor leaving the header,
and there is no document-level listener that can outlive the gesture or the component.
