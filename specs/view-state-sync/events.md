# Lifecycle contract: view state and URL synchronization

> **Immutable during stage 6.** Nothing locks this file; it holds because agents hold it.

## Events added

None. The add-on listens to `query:change`; it emits nothing.

## Events changed

None.

## Ordering guarantees

- The URL's query is in `initialQuery` before the engine is created: the first `fetch:start` carries
  it, and no `query:change` is emitted for it.
- `query:change` listeners run synchronously inside `setQuery`. The add-on writes after the event, so
  a consumer's `onQueryChange` sees the query before the URL does.
- A change applied from the URL emits `query:change` like any other (and `onQueryChange` sees it),
  but is not written back. When the engine reset the page the entry named, a second `query:change`
  follows with that page.
- A push write happens in the same task as the `query:change`; a replace write after `debounceMs` of
  quiet.

## Pipeline stages added

None.

| Stage id | Order | Capability | Changes the total |
| :--- | ---: | :--- | :--- |

## Teardown

| Resource | Released |
| :--- | :--- |
| `query:change` listener | when the engine changes (Strict Mode rebuild) and on unmount |
| adapter subscription (`popstate` for the default adapter) | when the adapter object changes and on unmount |
| pending replace timer | on unmount, on a push, on an external change; never flushed after unmount |
