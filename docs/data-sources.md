# Data sources

A data source answers two questions: what are the rows, and what did you already do to them. The
second question is the one that makes local and remote data the same thing.

## The contract

```ts
interface DataSource<TRow> {
    readonly kind: string;
    readonly capabilities: DataSourceCapabilities;
    fetch(request: DataSourceRequest<TRow>): DataSourceResult<TRow> | Promise<DataSourceResult<TRow>>;
    subscribe?(onInvalidate: () => void): Unsubscribe;
    dispose?(): void;
}
```

`fetch` receives the whole query, the resolved columns, an abort signal and a meta bag. It returns
rows and, when it knows one, a total.

## Capabilities

```ts
interface DataSourceCapabilities {
    sort: boolean;
    filter: boolean;
    search: boolean;
    paginate: boolean;
}
```

Each flag means "the source already did this". Every facet left `false` is applied in memory by the
pipeline.

| Source | Declares | The pipeline does |
| :--- | :--- | :--- |
| An array | nothing | filter, search, sort, paginate |
| A full query API | everything | nothing |
| An endpoint that only pages | `paginate` | filter, search, sort, on the page received |

That third row is the common real case and the reason this is a declaration rather than a boolean.
Nothing above the pipeline branches on any of it, which is why moving a grid from an array to an
endpoint changes one prop.

**Understate when unsure.** Overstating leaves the work undone: the server ignores the sort, the
pipeline skips it, and the grid renders unsorted rows under an ascending arrow. Understating costs
one extra pass over rows already in memory.

## The built-in sources

An array, any async function, a REST endpoint, and one that holds a window rather than a table.

### An array

```ts
import { createLocalDataSource } from 'apsw-gridwright';

const source = createLocalDataSource(people);
source.setRows(nextPeople);    // notifies any attached grid
```

Declares nothing and answers synchronously. The engine detects the synchronous return and skips the
loading state, so an array-backed grid renders its first page on the first paint instead of
flashing a spinner it never needed.

`<Gridwright data={people} />` creates and owns one of these for you.

### Any async function

```ts
import { createRemoteDataSource } from 'apsw-gridwright';

const source = createRemoteDataSource<Person>({
    capabilities: { sort: true, filter: true, search: false, paginate: true },
    retry: { attempts: 2, delayMs: 250 },
    fetcher: async ({ query, signal }) => {
        const page = await client.people({ page: query.pagination.pageIndex + 1, signal });
        return { rows: page.items, totalRows: page.total };
    },
});

source.invalidate();   // refetch, e.g. after a mutation elsewhere in the app
```

Defaults to declaring all four capabilities, because an endpoint that returns one page at a time is
the reason to be remote at all.

Retries apply only to failures that could plausibly succeed: 408, 429 and 5xx. A 404 answers the
same way forever, and retrying it three times only delays the message the reader needs. An abort is
never retried.

### A REST endpoint

```ts
import { createRestDataSource } from 'apsw-gridwright';

const source = createRestDataSource<Person>({
    url: '/api/people',
    headers: () => ({ Authorization: `Bearer ${token()}` }),
});
```

Headers are resolved per request, so a refreshed token is picked up without rebuilding the source.

The wire format, written down rather than inferred, because a grid and a server that disagree about
whether `page` is zero-based produce an off-by-one nobody notices until page two is missing a row:

| Parameter | Value |
| :--- | :--- |
| `page` | **one-based** page number |
| `pageSize` | rows per page |
| `sort` | `column:asc,other:desc`, in tie-break order |
| `search` | the raw term, omitted when empty |
| `filters` | JSON array of `{ columnId, operator, value }`, omitted when empty |

Responses are read from a bare array, `{ data, total }`, `{ items, count }`, `{ rows, total }`,
`{ results, count }`, `{ content, totalCount }`, a nested `meta.total` or `pagination.total`, or an
`X-Total-Count` header. Override either half:

```ts
createRestDataSource<Person>({
    url: '/api/people',
    buildParams: (query) => ({
        offset: String(query.pagination.pageIndex * query.pagination.pageSize),
        limit: String(query.pagination.pageSize),
    }),
    parseResponse: (payload) => ({ rows: payload.records, totalRows: payload.recordCount }),
});
```

`POST` puts the query in a JSON body instead of the URL, for a filter set too large for a query
string.

## Totals

- Paginate **and** return `totalRows`, and the page count is exact.
- Paginate and omit it, and `state.isTotalExact` is `false`. `totalRows` and `pageCount` become
  lower bounds, and the footer reads "1-25 of many".
- Never compute a total from one page. `pageIndex * pageSize + rows.length` is a lower bound, and
  the engine already reports it as one.

The grid will not invent a number, because a number in the footer is a number the reader acts on.

## Aborts

`request.signal` is aborted when the query changes again or the grid is destroyed. Pass it to your
transport. A source that ignores it leaks a request per keystroke, and the engine still discards the
stale answer, so the only cost is the wasted work.

```ts
fetcher: async ({ query, signal }) => {
    const response = await fetch(url, { signal });
    // ...
}
```

An abort is not a failure. It is the engine superseding its own request, and it never reaches the
error state.

## Errors a person can act on

Throw `GridwrightError` to control both the message and the retry advice:

```ts
import { GridwrightError } from 'apsw-gridwright';

if (!response.ok) {
    throw new GridwrightError(await messageFrom(response), { status: response.status });
}
```

`retryable` is derived from the status unless you set it. `createRestDataSource` already reads
`message`, `error`, `detail` or `title` out of the response body before falling back to naming the
status: "The server answered 403" tells the reader nothing, while "Your session expired" tells them
exactly what to do.

## Invalidation

Implement `subscribe` when the data can change underneath the grid:

```ts
subscribe(onInvalidate) {
    return eventBus.on('people-changed', onInvalidate);
}
```

`createLocalDataSource` uses it for `setRows`, and `createRemoteDataSource` exposes it as
`invalidate()`.

## Writing back

A data source reads. Nothing in this package writes through it, because a grid that owned your
mutations would own your transactions too. The two hooks that fire when the reader changes something
are `onCellEdit` and the tree's `onCommit`, and both are yours to send wherever the rows came from.
After a successful write, `invalidate()` is what tells the grid its rows are stale. See
[persistence](persistence.md).

## Lifetime

The engine never disposes a source it was handed. It did not create it, sources are routinely
shared between grids, and React Strict Mode destroys an engine once on purpose. Own the lifetime
where you created it.

## A source that holds a window

`createWindowedDataSource` answers ranges instead of tables. It is what makes a result set larger
than memory a scrolling problem rather than an impossible one:

```ts
import { createWindowedDataSource } from 'apsw-gridwright';

const source = createWindowedDataSource({
    blockSize: 200,
    maxBlocks: 12,
    fetchRange: async ({ offset, limit, query, signal }) => {
        const response = await fetch(`/api/people?offset=${offset}&limit=${limit}`, { signal });
        const body = await response.json();
        return { rows: body.data, totalRows: body.total };
    },
});
```

It keeps the blocks covering the current window plus a few neighbours and evicts the rest, so the
browser holds `blockSize * maxBlocks` rows whatever the total is. `totalRows` is required, because
it is the scrollbar's height.

It declares `paginate: true` always: it answers with exactly the window asked for, so the pagination
stage must not slice it again. Every block is dropped when the sort, the filters or the search
change, since a block describes positions in a result set that no longer exists.

`invalidate()` drops the cache after a mutation elsewhere in your application and notifies the grid,
which asks for its window again; a fetch already in flight when you call it will not put its rows
back into the cache that was just cleared. `cachedBlockCount` is there for a diagnostic
panel or a test.

Pair it with `virtual` on the component. See [virtualization](virtualization.md).

## Writing your own

```ts
const graphql: DataSource<Person> = {
    kind: 'graphql',
    capabilities: { sort: true, filter: true, search: true, paginate: true },
    async fetch({ query, signal }) {
        const { data } = await client.query({
            query: PEOPLE,
            variables: {
                first: query.pagination.pageSize,
                offset: query.pagination.pageIndex * query.pagination.pageSize,
                orderBy: query.sort.map((spec) => `${spec.columnId}_${spec.direction.toUpperCase()}`),
                where: toWhere(query.filters, query.search),
            },
            context: { fetchOptions: { signal } },
        });
        return { rows: data.people.nodes, totalRows: data.people.totalCount };
    },
};
```

Cover five cases in tests: a successful page, an aborted request, a retryable failure, a permanent
failure, and a response with no total. `tests/unit/engine-remote.test.ts` is the pattern, including
the overlapping-request race driven with a deferred promise rather than a timer.

## Decorating one

A source is a plain object, so a wrapper is the supported way to add cross-cutting behaviour. This
is also the answer to "can I intercept a fetch", which events deliberately cannot do:

```ts
const timed: DataSource<Person> = {
    ...source,
    async fetch(request) {
        const started = performance.now();
        try {
            return await source.fetch(request);
        } finally {
            track('grid.fetch', { ms: performance.now() - started });
        }
    },
};
```
