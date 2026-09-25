# Lifecycle contract: multi-column sorting

> **Immutable during stage 6.** Nothing locks this file; it holds because agents hold it.

## Events added

None.

## Events changed

None. `toggleSort` already publishes the sort through the existing state change; the badge and the
announcement read that state.

## Ordering guarantees

Unchanged. The announcement is computed from the settled state, after the sort stage has run, so the
priority it names is the priority the rows are sorted by.

## Pipeline stages added

None.

## Teardown

Nothing new is subscribed.
