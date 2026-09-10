# API surface contract: Gridwright core

> **Immutable during stage 6.** Mounted read-only into the implementation workspaces.

## Semver classification

**Initial public surface, 0.1.0.** Everything named here is a promise from this version forward.

## Entry points

| Specifier | Contents |
| :--- | :--- |
| `apsw-gridwright` | the headless engine, data sources, plugins, types |
| `apsw-gridwright/react` | `Gridwright`, `useGridwright`, the parts, React-specific types |
| `apsw-gridwright/styles.css` | the structural stylesheet |

Each JavaScript entry resolves ESM and CJS, each with its own `types` condition (`.d.ts` and
`.d.cts`). Both entries share one module instance through a split chunk, so `GridwrightError` is
one class regardless of the import path.

## Core exports

| Name | Signature |
| :--- | :--- |
| `createGridEngine` | `<TRow>(options: GridEngineOptions<TRow>) => GridApi<TRow>` |
| `createLocalDataSource` | `<TRow>(rows?, options?) => LocalDataSource<TRow>` |
| `createRemoteDataSource` | `<TRow>(options: RemoteDataSourceOptions<TRow>) => RemoteDataSource<TRow>` |
| `createRestDataSource` | `<TRow>(options: RestDataSourceOptions<TRow>) => RemoteDataSource<TRow>` |
| `corePlugins` | `<TRow>() => readonly GridPlugin<TRow>[]` |
| `filteringPlugin`, `searchPlugin`, `sortingPlugin`, `paginationPlugin` | `<TRow>(options?) => GridPlugin<TRow>` |
| `runPipeline` | `<TRow>(options: PipelineRunOptions<TRow>) => PipelineRunResult<TRow>` |
| `STAGE_ORDER` | `{ PRE, FILTER, SEARCH, SORT, TRANSFORM, PAGINATE, POST }` |
| `resolveColumns`, `findColumn`, `visibleColumns` | column helpers |
| `createQuery`, `normalizeQuery`, `queriesEqual`, `resetsPage`, `DEFAULT_PAGE_SIZE` | query helpers |
| `compareValues`, `matchesFilter`, `toText`, `isNullish` | value helpers |
| `GridwrightError`, `toGridError`, `isRetryableStatus`, `isAbortError` | errors |
| `GridEmitter` | the typed event bus |
| `VERSION` | `string`, kept equal to `package.json` by the packaging audit |

Types exported: `ColumnDef`, `ColumnAlign`, `ColumnValue`, `ResolvedColumn`, `DataSource`,
`DataSourceCapabilities`, `DataSourceRequest`, `DataSourceResult`, `FilterOperator`, `FilterSpec`,
`GridApi`, `GridEngineOptions`, `GridError`, `GridEventMap`, `GridEventName`, `GridPlugin`,
`GridQuery`, `GridRow`, `GridState`, `GridStatus`, `PaginationSpec`, `PipelineContext`,
`PipelineOutput`, `PipelineStage`, `PluginContext`, `RowId`, `SelectionMode`, `SortDirection`,
`SortSpec`, `Unsubscribe`, plus the data source option and result types.

## React exports

| Name | Signature |
| :--- | :--- |
| `Gridwright` | `<TRow>(props: GridwrightProps<TRow>) => JSX.Element`, with `.Root`, `.Toolbar`, `.Table`, `.Header`, `.Body`, `.Pagination` attached |
| `useGridwright` | `<TRow>(options: UseGridwrightOptions<TRow>) => GridwrightInstance<TRow>` |
| `GridwrightProvider`, `useGridwrightContext` | composition |
| `GridToolbar`, `GridTable`, `GridHeader`, `GridBody`, `GridPagination` | the parts |
| `defaultLabels`, `mergeLabels` | interface copy |

Types exported: `GridwrightColumn`, `GridwrightProps`, `GridwrightInstance`, `GridwrightClassNames`,
`GridwrightLabels`, `GridwrightContextValue`, `CellContext`, `HeaderContext`,
`UseGridwrightOptions`, plus the part prop types.

## Defaults

Each of these is a promise. Changing one is a major version even though nothing fails to compile.

| Option | Default | Consequence |
| :--- | :--- | :--- |
| `pagination.pageSize` | `25` | |
| `selectionMode` | `'none'` | No checkbox column unless asked for |
| `keepPreviousData` | `true` | Rows stay on screen through a refresh and a failed refresh |
| `queryDebounceMs` | `0` | No debounce; typing hits the source per keystroke unless set |
| `autoFetch` | `true` | The engine fetches on creation |
| `column.sortable/filterable/searchable` | `true` | |
| `column.hidden` | `false` | |
| Local source capabilities | all `false` | The pipeline does everything |
| Remote and REST capabilities | all `true` | The server does everything |
| Retry | 2 attempts, 250ms base, doubling | Retryable statuses only |
| REST page parameter | one-based `page` with `pageSize` | |
| `searchable` columns in search | all of them | |

## Verification

- [x] Every type in an exported signature is exported
- [x] Both `import` and `require` conditions resolve types
- [x] `npm run check:exports` passes
- [x] The core bundle contains no `react` import
- [x] `dependencies` is empty
