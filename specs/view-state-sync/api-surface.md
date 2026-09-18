# API surface contract: view state and URL synchronization

> **Immutable during stage 6.** Nothing locks this file; it holds because agents hold it. An
> implementation that finds this wrong stops and returns to stage 3; it does not edit this file.

## Semver classification

**minor**

Reasoning: new exports only, all from `apsw-gridwright/react`. No existing signature, type, default,
event payload or rendered markup changes. `<Gridwright />` gains no prop; the feature is an add-on a
grid opts into.

## Exports added

All from `apsw-gridwright/react`.

| Name | Entry | Signature |
| :--- | :--- | :--- |
| `urlSync` | `./react` | `<TRow>(options?: UrlSyncOptions) => GridAddon<TRow>` |
| `URL_SYNC_ADDON` | `./react` | `'gridwright:url-sync'` |
| `serializeGridQuery` | `./react` | `(query: GridQuery, options?: GridQueryParamsOptions) => URLSearchParams` |
| `parseGridQuery` | `./react` | `<TRow>(params: URLSearchParams, columns: readonly ColumnDef<TRow, ColumnValue>[], options?: ParseGridQueryOptions) => Partial<GridQuery>` |
| `formatSearchParams` | `./react` | `(params: URLSearchParams) => string` |
| `UrlSyncOptions` | `./react` (type) | see data-model.md |
| `UrlSyncAdapter` | `./react` (type) | `{ getParams(): URLSearchParams; setParams(params: URLSearchParams, mode: UrlSyncHistoryMode): void; subscribe?(onChange: () => void): Unsubscribe }` |
| `UrlSyncHistoryMode` | `./react` (type) | `'push' \| 'replace'` |
| `UrlSyncFacet` | `./react` (type) | `'search' \| 'sort' \| 'filters' \| 'page' \| 'size'` |
| `GridQueryParamsOptions` | `./react` (type) | `{ prefix?: string; facets?: readonly UrlSyncFacet[]; baseline?: GridQuery }` |
| `ParseGridQueryOptions` | `./react` (type) | `GridQueryParamsOptions & { maxPageSize?: number }` |

`parseGridQuery` returns only the facets the parameters name validly. `pagination`, when returned, is
complete: a missing half comes from `baseline`.

`formatSearchParams` returns the query string without a leading `?`, encoded like
`URLSearchParams.toString()` except that `:` and `,` stay literal and a space is `%20`.

## Exports changed

None.

## Exports removed or deprecated

None. (`createUrlSyncAdapter`, named in the draft, was never shipped; see spec §9 item 10.)

## Defaults introduced or changed

New options only; nothing existing changes.

| Option | Old default | New default |
| :--- | :--- | :--- |
| `UrlSyncOptions.prefix` | — | `''` |
| `UrlSyncOptions.facets` | — | all five |
| `UrlSyncOptions.push` | — | `['page']` |
| `UrlSyncOptions.debounceMs` | — | `300` |
| `UrlSyncOptions.maxPageSize` | — | `max(100, the grid's starting page size)` |
| `UrlSyncOptions.adapter` | — | the browser's `location`, `history` and `popstate` |
| `GridQueryParamsOptions.baseline` | — | `createQuery()` |

## Type entry points

- [x] Every type appearing in a new signature is itself exported (`GridQuery`, `ColumnDef`,
      `ColumnValue`, `Unsubscribe` from the core entry; the rest from `./react`)
- [x] Both `import` and `require` conditions still resolve types
- [x] `npm run check:exports` passes
