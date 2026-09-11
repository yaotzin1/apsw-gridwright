# Lifecycle contract: data export

> **Immutable during stage 6.** Mounted read-only into the implementation workspaces.

## Events added

None. An export reads settled state and produces a file; it publishes nothing on the engine's
event bus, and a listener counting `fetch:*` events must not see an export as a load.

`fetchAllRows()` is the one exception worth stating plainly: it calls the data source, and it does
so *without* touching engine state. No `fetch:start`, no `fetch:success`, no `state:change`, no
spinner. The rows it returns never become `state.rows`.

| Event | Payload | Emitted when |
| :--- | :--- | :--- |
| — | — | — |

## Events changed

| Event | Before | After |
| :--- | :--- | :--- |
| — | — | — |

## Ordering guarantees

- `getMatchingRows()` reads the last settled result. During a fetch it returns the previous rows,
  which is what the reader is looking at, and never a partial one.
- `getMatchingRows().isComplete` is false whenever the source declares `paginate: true`, whatever
  the row count happens to be. A source that paginates but returned everything on one page is
  still reporting one page.
- `fetchAllRows()` resolves with rows that have passed every registered stage below
  `STAGE_ORDER.PAGINATE`, in that order, whether they came from memory or from `fetchAll`.
- `fetchAllRows()` rejects with a `GridwrightError` when the source paginates and declares no
  `fetchAll`. It never resolves with a truncated set.

## Pipeline stages added

| Stage id | Order | Capability | Changes the total |
| :--- | ---: | :--- | :--- |
| — | — | — | — |

Export is not a pipeline stage. It transforms nothing the grid renders.

## Teardown

The menu removes its document-level pointer and key listeners when it closes and on unmount. The
object URL behind a download is revoked after the click, in the same task. The print document is
built in an iframe that is removed once the print dialog returns, and a print that leaves the
iframe attached because the dialog was dismissed is still removed on unmount.
