# Lifecycle contract: React-only surface, accessible grid state

> **Immutable during stage 6.** Mounted read-only into the implementation workspaces.

## Events added

| Event | Payload | Emitted when |
| :--- | :--- | :--- |
| — | — | — |

No event is added. The announcement is derived in the adapter from state the engine already
publishes, and deriving it is deliberately not an event: an event would put the wording on the
consumer's side of a boundary the message catalogue owns, and the point of the catalogue is that
every visible string is translated once, centrally. `labels` remains the escape hatch for a
consumer who wants different words.

## Events changed

| Event | Before | After |
| :--- | :--- | :--- |
| — | — | — |

No payload changes. Nothing in this feature is observable through `GridEmitter`.

## Ordering guarantees

The feature depends on two guarantees that already hold, and adds one of its own.

**Already guaranteed, and relied on.** By the time the adapter renders a `GridState`, the pipeline
has settled it: `rows`, `totalRows`, `isTotalExact` and `status` describe one consistent result,
not a half-applied one. The announcement is derived from that snapshot, so it can never describe a
range from the old page against a total from the new one.

**Already guaranteed, and relied on.** `state.version` changes on every published state, which is
what lets the announcement distinguish a genuinely new result from a re-render.

**Added.** The announcement is emitted only for a settled status. While `status` is `loading` or
`refreshing`, the region carries the loading label and nothing else; the result summary waits for
`ready`. A reader is therefore never told a row count that a fetch in flight is about to replace.

## Announcement priority

Exactly one of these is in the region at any moment. The order is the contract, and it is what
keeps the region to one fact.

1. `status` is `loading` or `refreshing` — the loading label.
2. `status` is `error` — the error title, whether or not stale rows are still on screen.
3. The sort changed since the last announcement — the column and its new direction.
4. Otherwise — the result summary: the range and total for a paginated grid, the total for a
   virtualized one, or the empty label when there are no rows.

A sort change is announced ahead of the result summary because the reader caused it and is waiting
to hear whether it applied. The summary that follows arrives on the next settled change, which for
a sort is usually no change in row count at all, so nothing useful is lost.

## Pipeline stages added

| Stage id | Order | Capability | Changes the total |
| :--- | ---: | :--- | :--- |
| — | — | — | — |

No stage is added, no stage is reordered, and no data source has to declare a new capability. The
feature does not touch `GridQuery`, which is the reason it is invisible across the local/remote
seam.

## Teardown

| Subscription | Released |
| :--- | :--- |
| The announcement's previous-message ref | Render-local. Garbage collected with the component; nothing to unsubscribe. |
| The pagination focus effect | Has no subscription. It reads a ref during a click handler and acts in the same commit, so there is nothing to release. |
| The tree context subscription read for `aria-expanded` | Already owned and released by `TreeProvider`. This feature adds a reader, not a subscriber. |

Nothing here registers a listener, a timer or an observer, so nothing here can leak one.
