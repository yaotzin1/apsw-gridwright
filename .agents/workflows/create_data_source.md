# Workflow: Creating a Data Source

## 1. Check the built-ins first

- An array in memory: `createLocalDataSource`.
- Any async function: `createRemoteDataSource`.
- A REST endpoint: `createRestDataSource`, which already handles parameter encoding, the common
  envelope shapes, the `X-Total-Count` header and server error messages.

A custom source is for a transport those do not cover: GraphQL, a websocket-fed cache, IndexedDB.

## 2. Declare capabilities honestly

```ts
const source: DataSource<Row> = {
    kind: 'graphql',
    capabilities: { sort: true, filter: true, search: false, paginate: true },
    async fetch({ query, signal }) {
        const page = await client.query({ query: DOCUMENT, variables: toVariables(query), signal });
        return { rows: page.items, totalRows: page.total };
    },
};
```

Every facet left `false` is applied in memory by the pipeline. Overstating one leaves the work
undone and the grid renders unsorted rows under an ascending arrow. Understating one costs a second
pass over rows already in memory. When unsure, understate.

## 3. Honour the signal

Pass `request.signal` to the transport. It is aborted when the query changes again or the grid is
destroyed. Ignoring it leaks a request per keystroke.

## 4. Totals

Return `totalRows` when the transport knows it. Omit it when it does not, and the grid reports
`isTotalExact: false` rather than inventing a count from one page.

## 5. Invalidation

Implement `subscribe(onInvalidate)` if the data can change underneath the grid, and call the
listeners after a mutation elsewhere in the application. `createRemoteDataSource` exposes this as
`invalidate()`.

## 6. Errors

Throw `GridwrightError` with a message a person can act on, and a `status` where one exists. The
retry policy reads it: 408, 429 and 5xx are retried, everything else is surfaced immediately.

## 7. Test it

Cover: a successful page, an aborted request, a retryable failure, a permanent failure, and a
response with no total. The engine tests in `tests/unit/engine-remote.test.ts` are the pattern.
