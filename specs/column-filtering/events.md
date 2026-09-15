# Lifecycle contract: column filtering

> **Immutable during stage 6.** Mounted read-only into the implementation workspaces.

## Events added

None. Applying a filter calls `api.setFilter`, which already emits `query:change`, and the fetch
that follows emits the `fetch:*` events it always has. A listener cannot tell a filter set by the
dialog from one set by code, and should not be able to.

| Event | Payload | Emitted when |
| :--- | :--- | :--- |
| — | — | — |

## Events changed

| Event | Before | After |
| :--- | :--- | :--- |
| — | — | — |

## Ordering guarantees

- Nothing is emitted while the dialog is open. The draft is component state; opening, typing,
  changing the condition, Escape and a click outside publish no event and no state.
- Apply emits exactly one `query:change`, whose `query.filters` holds the column's new `FilterSpec`
  in place of its previous one, and whose `query.pagination.pageIndex` is 0.
- "Clear filter" emits one `query:change` without the column's filter. "Clear filters" emits one
  `query:change` with `filters: []`. Neither emits when there was nothing to clear.
- By the time the live region says "{column}, filtered", `query.filters` holds the filter. The
  settled range announcement follows the state publish that carries the filtered rows, as it does
  for a sort.
- Focus returns to the trigger before the query is committed, so a synchronous source's re-render
  lands with focus already where the reader expects it.

## Pipeline stages added

| Stage id | Order | Capability | Changes the total |
| :--- | ---: | :--- | :--- |
| — | — | — | — |

The existing `core:filter` (`STAGE_ORDER.FILTER`, capability `filter`) and the tree stage do the
work.

## Teardown

- The provider adds `pointerdown` on `document`, and `scroll` (capture) and `resize` on `window`,
  only while a dialog is open, and removes them when it closes and on unmount.
- A trigger unregisters its element from the provider on unmount, so a column that disappears while
  its dialog is open closes the dialog rather than positioning it against a detached node.
- No timers.
