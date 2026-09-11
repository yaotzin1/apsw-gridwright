# Lifecycle contract: unified options, virtualization and windowing

> **Immutable during stage 6.** Mounted read-only into the implementation workspaces.

## Events added

| Event | Payload | Emitted when |
| :--- | :--- | :--- |
| — | — | — |

None. Scrolling is not a grid event. It happens per frame, it is already observable on the scroll
container by anyone who wants it, and an event on the emitter would mean every listener in the
application runs sixty times a second for something the DOM already announced.

Moving the data window under virtualization goes through `api.setPage`, so it emits the
`query:change`, `fetch:start`, `fetch:success` and `fetch:settled` that any page change emits. A
consumer persisting the query or logging requests sees windowing as paging, which is what it is.

## Events changed

| Event | Before | After |
| :--- | :--- | :--- |
| — | — | — |

No payload changed. `fetch:success` carries the result as before; the windowed source adds a key to
`meta`, which is already an open record.

## Ordering guarantees

- `WINDOW_OFFSET_META` is present in `state.meta` by the time `fetch:success` fires, because the
  source returns it in the same result as the rows. A listener reading the rows can trust the offset
  that came with them.
- `tree.controllerRef` is called after mount, in an effect, and before any row is interactive. It is
  called exactly once per grid: the controller's identity is stable for the grid's life, so a
  consumer may safely put it in state without a render loop.
- `controllerRef(null)` runs on unmount, before the controller is destroyed.
- The virtual body requests a new window in an effect, after the render that discovered the scroll
  position. It is guarded on the page actually changing, or setting the page would publish state,
  which renders, which sets the page.

## Pipeline stages added

| Stage id | Order | Capability | Changes the total |
| :--- | ---: | :--- | :--- |
| — | — | — | — |

None. Virtualization is a rendering decision, below the pipeline entirely, and a windowed source is
a source rather than a stage. The tree stage is unchanged.

## Teardown

| Resource | Released when |
| :--- | :--- |
| Scroll listener on the container | The virtual body unmounts, or the container ref changes |
| `ResizeObserver` on the container | Same |
| Pending `requestAnimationFrame` | Same, cancelled rather than left to fire into a dead component |
| Blocks and in-flight loads in a windowed source | `invalidate()`, a query-key change, or the consumer disposing the source they created |
| Tree controller | The grid that created it unmounts; a controller handed in through `instance` belongs to its creator |

The engine still never disposes a data source it was handed, and a windowed source is routinely
shared between grids, so its lifetime belongs where it was created.
