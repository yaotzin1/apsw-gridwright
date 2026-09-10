# Lifecycle contract: Gridwright core

> **Immutable during stage 6.** Mounted read-only into the implementation workspaces.

## Events

Subscribe with `api.on(name, listener)`, which returns an unsubscribe.

| Event | Payload | Emitted when |
| :--- | :--- | :--- |
| `state:change` | `{ state }` | after every state publication |
| `query:change` | `{ query, previous }` | after a query change that is not a no-op |
| `fetch:start` | `{ query }` | before the source is called, including for a synchronous source |
| `fetch:success` | `{ rows, totalRows, durationMs }` | after a settled fetch is applied |
| `fetch:error` | `{ error }` | after a non-aborted failure is applied |
| `fetch:settled` | `{ ok }` | after either of the two above |
| `selection:change` | `{ selectedIds }` | after a selection change that is not a no-op |
| `plugin:error` | `{ plugin, error }` | a plugin's setup, stage or listener threw |

`rows` on `fetch:success` is the source's rows before the pipeline, not the rendered page. The
rendered page is on the state.

## Ordering guarantees

- `state:change` for a fetch's result fires **before** `fetch:success`. A listener reading
  `getState()` from `fetch:success` sees the new rows.
- `query:change` fires **before** the fetch it triggers. A listener that persists the query to a
  URL runs before the request goes out.
- A recompute triggered by `setColumns` or by registering a plugin publishes `state:change` and
  deliberately does **not** publish `fetch:success`. A recompute is not a network round trip, and
  anything counting requests would be wrong.
- Nothing is emitted for a superseded response. A stale sequence is dropped before any listener
  runs.
- Nothing is emitted for an abort. An abort is the engine superseding its own request.
- `destroy()` emits nothing and clears every listener.

## Listener isolation

A listener that throws does not stop the listeners after it. The failure is re-emitted on
`plugin:error`, except for a `plugin:error` listener that throws, which is logged instead so the
emitter cannot recurse.

## Pipeline stages

| Stage id | Order | Capability | Changes the total |
| :--- | ---: | :--- | :--- |
| `core:filter` | 100 | `filter` | yes |
| `core:search` | 200 | `search` | yes |
| `core:sort` | 300 | `sort` | no |
| `core:paginate` | 900 | `paginate` | yes, to the pre-slice count |

A stage is skipped exactly when the data source reports its capability. A stage id must be unique
within one engine; a duplicate throws rather than replacing silently.

## Teardown

`GridPlugin.setup` may return an unsubscribe. `api.use(plugin)` returns one that runs the
teardown, removes every stage the plugin registered, and recomputes. `api.destroy()` aborts the
in-flight request, clears the debounce timer, runs every teardown, unsubscribes from the source and
clears every listener. It does **not** dispose the data source.
