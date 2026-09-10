# Data model: Gridwright core

## GridQuery

Everything the grid is asking for. Travels to the data source verbatim.

| Field | Type | Default | Notes |
| :--- | :--- | :--- | :--- |
| `sort` | `readonly SortSpec[]` | `[]` | Order is tie-break order. One entry per column. |
| `filters` | `readonly FilterSpec[]` | `[]` | Combined with AND. |
| `search` | `string` | `''` | Global term across searchable columns. |
| `pagination` | `PaginationSpec` | `{ pageIndex: 0, pageSize: 25 }` | `pageIndex` is zero-based here; the REST source sends one-based `page`. |

`normalizeQuery` repairs a page size of zero and a negative page index at every entry point, so no
caller can produce a slice that throws inside a stage.

## GridState

| Field | Type | Written by | Notes |
| :--- | :--- | :--- | :--- |
| `status` | `idle \| loading \| refreshing \| ready \| error` | engine | `refreshing` means rows are still on screen. |
| `query` | `GridQuery` | engine | |
| `rows` | `readonly GridRow<TRow>[]` | pipeline | The current page, with ids and selection flags. |
| `totalRows` | `number` | pipeline or source | A lower bound when `isTotalExact` is false. |
| `pageCount` | `number` | engine | A lower bound when `isTotalExact` is false. |
| `hasNextPage` | `boolean` | engine | From the total, or from a full page when the total is unknown. |
| `hasPreviousPage` | `boolean` | engine | |
| `isTotalExact` | `boolean` | engine | False when a paginating source sent no total. |
| `selectedIds` | `readonly RowId[]` | engine | Survives paging; only loaded rows resolve to objects. |
| `error` | `GridError \| null` | engine | |
| `version` | `number` | engine | Increments per settled fetch. A cheap render key. |
| `meta` | `Record<string, unknown>` | plugins, sources | Plugin keys are namespaced `<plugin>:<key>`. |

## Row identity

`getRowId`, then the `id` property, then the position **plus the page offset**. The offset is
load-bearing: without it row 0 of page 2 shares an id with row 0 of page 1, and a selection
silently follows the reader from page to page.

## DataSourceCapabilities

Four booleans, each meaning "the source already did this".

| Source | sort | filter | search | paginate |
| :--- | :--- | :--- | :--- | :--- |
| `createLocalDataSource` | false | false | false | false |
| `createRemoteDataSource` | true | true | true | true |
| `createRestDataSource` | true | true | true | true |

Every default is overridable. Understating costs a second pass in memory; overstating leaves the
work undone.

## Pipeline stage slots

| Slot | Order | Built-in |
| :--- | ---: | :--- |
| `PRE` | 0 | — |
| `FILTER` | 100 | `core:filter` |
| `SEARCH` | 200 | `core:search` |
| `SORT` | 300 | `core:sort` |
| `TRANSFORM` | 500 | — (reserved for grouping and aggregation) |
| `PAGINATE` | 900 | `core:paginate` |
| `POST` | 1000 | — |

A stage that narrows the row set returns an updated `totalRows`. Pagination runs last so the total
counts the matches rather than the rows the source returned.

## Filter operators

`eq`, `ne`, `contains`, `notContains`, `startsWith`, `endsWith`, `gt`, `gte`, `lt`, `lte`,
`between`, `in`, `notIn`, `isEmpty`, `isNotEmpty`.

Deliberately small and serialisable: a remote source receives them verbatim, so adding one is a
breaking change for every server that already speaks the vocabulary. Text comparisons are
case-insensitive, `between` is inclusive on both bounds, and an unrecognised operator keeps every
row rather than dropping them all.
