# Data model: view state and URL synchronization

## Types added

```ts
export type UrlSyncFacet = 'search' | 'sort' | 'filters' | 'page' | 'size';
export type UrlSyncHistoryMode = 'push' | 'replace';

export interface GridQueryParamsOptions {
    /** Put before every parameter name, so two grids on one page do not collide. Default ''. */
    readonly prefix?: string;
    /** Which parts of the query are read and written. Default all five. */
    readonly facets?: readonly UrlSyncFacet[];
    /** The grid's own starting query. A facet equal to it is not written. Default createQuery(). */
    readonly baseline?: GridQuery;
}

export interface ParseGridQueryOptions extends GridQueryParamsOptions {
    /** The largest `size` accepted. Default max(100, baseline page size). */
    readonly maxPageSize?: number;
}

export interface UrlSyncAdapter {
    /** The current parameters. Read on every render of the grid, so keep it cheap. */
    getParams(): URLSearchParams;
    /** Writes the complete parameters: the grid's own and everyone else's. */
    setParams(params: URLSearchParams, mode: UrlSyncHistoryMode): void;
    /** Calls back when the parameters change from outside: Back, Forward, a link. Optional. */
    subscribe?(onChange: () => void): Unsubscribe;
}

export interface UrlSyncOptions {
    readonly adapter?: UrlSyncAdapter;
    readonly prefix?: string;
    readonly facets?: readonly UrlSyncFacet[];
    /** Facets whose change adds a history entry. Default ['page']. */
    readonly push?: readonly UrlSyncFacet[];
    /** Delay before a replace write. Default 300. */
    readonly debounceMs?: number;
    readonly maxPageSize?: number;
}
```

## Types changed

None.

## State shape

No engine state is added. The add-on holds, per mounted grid:

| Field | Type | Default | Written by |
| :--- | :--- | :--- | :--- |
| baseline | `GridQuery` | the grid's starting query | `setup`, once |
| initial | `Partial<GridQuery>` | parsed from the URL | `setup`, once |
| last seen | `string` (the grid's own parameters) | the URL at mount | every write and every external change |
| pending | timer | none | a replace write; cleared by a push, an external change, unmount |

## Serialisation

| Parameter | Facet | Form | Example |
| :--- | :--- | :--- | :--- |
| `q` | search | the text | `q=north%20wing` |
| `sort` | sort | `id:asc\|desc`, comma separated, in priority order | `sort=score:desc,name:asc` |
| `f` | filters | `id:operator[:value]...`, comma separated | `f=status:in:open:pending,score:gt:50` |
| `page` | page | 1-based positive integer | `page=3` |
| `size` | size | positive integer, at most `maxPageSize` | `size=50` |

Escaping inside a piece: `%` → `%25`, `:` → `%3A`, `,` → `%2C`, then `URLSearchParams` encodes the
parameter as a whole.

A value piece is written bare when it is a string that `JSON.parse` rejects, and as JSON otherwise
(numbers, booleans, `null`, and strings that would read as one of those or start with `"` or `[`).
Reading tries `JSON.parse` and keeps the result only when it is a string, a finite number, a boolean
or `null`; a piece `JSON.parse` rejects is the string itself; any other parsed value drops the
filter.

Arity by operator: `isEmpty`, `isNotEmpty` none; `between` exactly two; `in`, `notIn` any number
(read as an array); every other operator exactly one.
