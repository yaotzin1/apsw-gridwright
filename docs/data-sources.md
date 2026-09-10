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

## The three built-ins

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

## Lifetime

The engine never disposes a source it was handed. It did not create it, sources are routinely
shared between grids, and React Strict Mode destroys an engine once on purpose. Own the lifetime
where you created it.

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
