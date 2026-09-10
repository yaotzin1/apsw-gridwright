---
name: data_source
description: Use when writing or reviewing a data source, when a grid loads from a server, or when totals, aborts, retries or pagination behave oddly. Covers the DataSource contract and capability negotiation.
---

# Data Source & Capability Negotiation

The whole local/remote mechanism is four booleans. Understand them and the rest follows.

## Capabilities declare what the source already did

```ts
interface DataSourceCapabilities {
    sort: boolean;
    filter: boolean;
    search: boolean;
    paginate: boolean;
}
```

Every facet left `false` is applied in memory by the pipeline. An array declares all four false and
the pipeline does everything. A SQL-backed endpoint declares all four true and the pipeline does
nothing. An endpoint that only pages declares `paginate: true`, and the pipeline sorts and filters
the page it received.

Nothing above the pipeline branches on any of this. That is the point: `<Gridwright data={rows} />`
and `<Gridwright dataSource={endpoint} />` are the same component.

## Getting it wrong is quiet, so state it honestly

Overstating a capability leaves work undone: the server ignores the sort, the pipeline skips it,
and the grid renders unsorted rows under an ascending arrow. Understating one only costs a second
pass over rows already in memory. When unsure, understate.

## Totals

- A source that pages **and** returns `totalRows` gets an exact page count.
- A source that pages and omits it gets `isTotalExact: false`. The grid then knows only that
  another page exists. Render a next control, never "page 3 of 47".
- Never compute a total from one page. `pageIndex * pageSize + rows.length` is a lower bound, and
  the engine already reports it as one.

## Aborts and retries

- `request.signal` is aborted when the query changes again or the grid is destroyed. Pass it to
  `fetch`. A source that ignores it leaks a request per keystroke.
- An abort is not a failure. Never retry one, never surface it as an error.
- Retry only what could plausibly succeed: 408, 429 and 5xx. A 404 answers the same way forever,
  and retrying it three times only delays the message the reader needs.

## Errors a person can act on

`createRestDataSource` reads `message`, `error`, `detail` or `title` out of the response body
before falling back to naming the status. "The server answered 403" tells the reader nothing;
"Your session expired" tells them exactly what to do. Most APIs send the second, and most clients
throw it away.

## Writing a new source

Implement `fetch`, declare `capabilities`, and add `subscribe` if the data can change underneath
the grid. Return rows synchronously when you can: the engine detects it and skips the loading
state. Do not paginate inside `fetch` while declaring `paginate: false`.
