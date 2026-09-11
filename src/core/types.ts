/**
 * The public type surface of the Gridwright core.
 *
 * Everything here is framework-agnostic and DOM-free by contract. Rendering concerns -- cell
 * renderers, class names, slots -- belong to an adapter such as `apsw-gridwright/react`, never
 * here. The lint gate enforces the boundary: `document`, `window` and `react` are banned under
 * `src/core`, `src/data` and `src/plugins`.
 */

export type RowId = string | number;

/**
 * The value type of a column whose value type is not known at this point.
 *
 * A grid holds columns of different value types in one array, and `unknown` cannot express that
 * under `strictFunctionTypes`: a comparator written for numbers is not assignable to one declared
 * over `unknown`, so every typed column would be rejected by the array that holds it. This alias
 * is the single place the package permits `any`, and this comment is the reason.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ColumnValue = any;

export type Unsubscribe = () => void;

export type SortDirection = 'asc' | 'desc';

export interface SortSpec {
    readonly columnId: string;
    readonly direction: SortDirection;
}

/**
 * The operator vocabulary a filter may use. A remote source receives these verbatim, so the set is
 * deliberately small and serialisable: adding an operator is a breaking change for every server
 * that already speaks it.
 */
export type FilterOperator =
    | 'eq'
    | 'ne'
    | 'contains'
    | 'notContains'
    | 'startsWith'
    | 'endsWith'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'between'
    | 'in'
    | 'notIn'
    | 'isEmpty'
    | 'isNotEmpty';

export interface FilterSpec {
    readonly columnId: string;
    readonly operator: FilterOperator;
    readonly value?: unknown;
}

export interface PaginationSpec {
    readonly pageIndex: number;
    readonly pageSize: number;
}

/** The complete description of what the grid is currently asking for. */
export interface GridQuery {
    readonly sort: readonly SortSpec[];
    readonly filters: readonly FilterSpec[];
    readonly search: string;
    readonly pagination: PaginationSpec;
}

export type GridStatus = 'idle' | 'loading' | 'refreshing' | 'ready' | 'error';

export interface GridError {
    readonly message: string;
    /** True when retrying the same query could plausibly succeed: network blips, 5xx, timeouts. */
    readonly retryable: boolean;
    readonly status?: number;
    readonly cause?: unknown;
}

export interface GridRow<TRow> {
    readonly id: RowId;
    /** Position within the currently rendered page, zero-based. */
    readonly index: number;
    readonly data: TRow;
    readonly selected: boolean;
}

export interface GridState<TRow> {
    readonly status: GridStatus;
    readonly query: GridQuery;
    readonly rows: readonly GridRow<TRow>[];
    /** Rows matching the query across all pages. Check `isTotalExact` before displaying it. */
    readonly totalRows: number;
    readonly pageCount: number;
    readonly hasNextPage: boolean;
    readonly hasPreviousPage: boolean;
    /**
     * False when a paginating source answered without a total. The grid then knows only that
     * another page exists, so render a next control rather than "page 3 of 47".
     */
    readonly isTotalExact: boolean;
    readonly selectedIds: readonly RowId[];
    readonly error: GridError | null;
    /** Increments on every settled fetch. Useful as a cheap render key. */
    readonly version: number;
    readonly meta: Readonly<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------------------------

export type ColumnAlign = 'start' | 'center' | 'end';

export interface ColumnDef<TRow, TValue = ColumnValue> {
    readonly id: string;
    readonly header?: string;
    /**
     * How to read the value out of a row. A key for the common case, a function for anything
     * else. Omit it and the column reads the property named by `id`.
     */
    readonly accessor?: keyof TRow | ((row: TRow) => TValue);
    /** Default true. */
    readonly sortable?: boolean;
    /** Default true. */
    readonly filterable?: boolean;
    /** Default true. Controls whether global search looks at this column. */
    readonly searchable?: boolean;
    readonly hidden?: boolean;
    readonly width?: number | string;
    readonly minWidth?: number;
    readonly align?: ColumnAlign;
    /** Sort order for this column. Falls back to a type-aware default comparator. */
    readonly comparator?: (a: TValue, b: TValue, rowA: TRow, rowB: TRow) => number;
    /** Client-side predicate for this column. Falls back to the operator vocabulary above. */
    readonly filterFn?: (value: TValue, filter: FilterSpec, row: TRow) => boolean;
    /** Turns a value into text, for global search and for an adapter default cell. */
    readonly formatValue?: (value: TValue, row: TRow) => string;
    /**
     * Default true. A column set false is left out of every export.
     *
     * For a column whose cell is a control rather than a value: a button, a status light, a
     * thumbnail. What the reader sees there is not text, and exporting the underlying value
     * produces a column of identifiers nobody asked for.
     */
    readonly exportable?: boolean;
    /**
     * Export text for this column, overriding `formatValue`.
     *
     * For the case where the screen and the file want different things: a currency column
     * rendered as `$120,000` and exported as `120000`, so the spreadsheet can add it up.
     */
    readonly exportValue?: (value: TValue, row: TRow) => string;
    readonly meta?: Readonly<Record<string, unknown>>;
}

export interface ResolvedColumn<TRow, TValue = ColumnValue> extends ColumnDef<TRow, TValue> {
    readonly index: number;
    readonly header: string;
    readonly sortable: boolean;
    readonly filterable: boolean;
    readonly searchable: boolean;
    readonly hidden: boolean;
    readonly getValue: (row: TRow) => TValue;
    readonly getText: (row: TRow) => string;
}

// ---------------------------------------------------------------------------------------------
// Data sources
// ---------------------------------------------------------------------------------------------

/**
 * Which facets of the query the source resolves for itself.
 *
 * This is the whole local/remote mechanism. Every facet left false is applied in memory by the
 * pipeline, so an array of rows and a paginating REST endpoint travel the same code path and the
 * component above them cannot tell the difference. A source that overstates a capability does not
 * break the grid, it only leaves the work undone.
 */
export interface DataSourceCapabilities {
    readonly sort: boolean;
    readonly filter: boolean;
    readonly search: boolean;
    readonly paginate: boolean;
}

export interface DataSourceRequest<TRow> {
    readonly query: GridQuery;
    readonly columns: readonly ResolvedColumn<TRow, ColumnValue>[];
    /** Aborted when the query changes again or the grid is destroyed. Pass it to fetch. */
    readonly signal: AbortSignal;
    readonly meta: Readonly<Record<string, unknown>>;
}

export interface DataSourceResult<TRow> {
    readonly rows: readonly TRow[];
    /**
     * Rows matching the query before pagination. Required from a source that paginates and wants
     * an exact page count; omit it when the total is genuinely unknown.
     */
    readonly totalRows?: number;
    readonly meta?: Readonly<Record<string, unknown>>;
}

export interface DataSource<TRow> {
    /** Free-form label used in diagnostics: local, remote, rest, or your own. */
    readonly kind: string;
    readonly capabilities: DataSourceCapabilities;
    fetch(request: DataSourceRequest<TRow>): DataSourceResult<TRow> | Promise<DataSourceResult<TRow>>;
    /**
     * Every row matching the query, ignoring the pagination in it.
     *
     * Only a source that paginates for itself needs this, and only then to support exporting more
     * than the page in memory. Without it `fetchAllRows` refuses rather than passing off one page
     * as the whole result. The request is the same shape `fetch` receives, so a source has one
     * request to parse rather than two.
     */
    fetchAll?(request: DataSourceRequest<TRow>): DataSourceResult<TRow> | Promise<DataSourceResult<TRow>>;
    /** Lets a source tell the grid its data changed underneath it. */
    subscribe?(onInvalidate: () => void): Unsubscribe;
    dispose?(): void;
}

// ---------------------------------------------------------------------------------------------
// Pipeline and plugins
// ---------------------------------------------------------------------------------------------

export interface PipelineContext<TRow> {
    readonly query: GridQuery;
    readonly columns: readonly ResolvedColumn<TRow, ColumnValue>[];
    readonly capabilities: DataSourceCapabilities;
    /** Running total for the current pass; a stage that narrows the set should update it. */
    readonly totalRows: number;
}

export interface PipelineOutput<TRow> {
    readonly rows: readonly TRow[];
    readonly totalRows?: number;
}

/**
 * One in-memory transformation between the data source and the rendered rows.
 *
 * Stages run in ascending `order`. A stage that names a `capability` is skipped whenever the data
 * source already reports that capability, which is what keeps a server-side grid from re-sorting
 * its own page locally.
 */
export interface PipelineStage<TRow> {
    readonly id: string;
    readonly order: number;
    readonly capability?: keyof DataSourceCapabilities;
    run(rows: readonly TRow[], context: PipelineContext<TRow>): readonly TRow[] | PipelineOutput<TRow>;
}

export interface GridEventMap<TRow> {
    'state:change': { readonly state: GridState<TRow> };
    'query:change': { readonly query: GridQuery; readonly previous: GridQuery };
    'fetch:start': { readonly query: GridQuery };
    'fetch:success': {
        readonly rows: readonly TRow[];
        readonly totalRows: number;
        readonly durationMs: number;
    };
    'fetch:error': { readonly error: GridError };
    'fetch:settled': { readonly ok: boolean };
    'selection:change': { readonly selectedIds: readonly RowId[] };
    'plugin:error': { readonly plugin: string; readonly error: unknown };
}

export type GridEventName = keyof GridEventMap<never>;

export interface PluginContext<TRow> {
    readonly api: GridApi<TRow>;
    registerStage(stage: PipelineStage<TRow>): Unsubscribe;
    on<K extends keyof GridEventMap<TRow>>(
        event: K,
        listener: (payload: GridEventMap<TRow>[K]) => void,
    ): Unsubscribe;
    /** Publishes a value on `state.meta`, namespaced by the plugin that wrote it. */
    setMeta(key: string, value: unknown): void;
}

export interface GridPlugin<TRow> {
    readonly name: string;
    readonly version?: string;
    /** Return a teardown function to release anything the plugin allocated. */
    setup(context: PluginContext<TRow>): void | Unsubscribe;
}

// ---------------------------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------------------------

export type SelectionMode = 'none' | 'single' | 'multiple';

export interface GridEngineOptions<TRow> {
    readonly columns: readonly ColumnDef<TRow, ColumnValue>[];
    readonly dataSource: DataSource<TRow>;
    /** Stable identity for a row. Defaults to the `id` property, then to the row index. */
    readonly getRowId?: (row: TRow, index: number) => RowId;
    readonly initialQuery?: Partial<GridQuery>;
    readonly plugins?: readonly GridPlugin<TRow>[];
    /** Default `none`. Set `single` or `multiple` to render and track a selection. */
    readonly selectionMode?: SelectionMode;
    /** Keep the previous page visible while the next one loads. Default true. */
    readonly keepPreviousData?: boolean;
    /** Collapses bursts of query changes, such as typing in the search box. Default 0. */
    readonly queryDebounceMs?: number;
    /** Fetch on creation. Default true. */
    readonly autoFetch?: boolean;
    readonly onError?: (error: GridError) => void;
}

/** What `getMatchingRows` answers: the rows, and whether they are all of them. */
export interface MatchingRows<TRow> {
    readonly rows: readonly TRow[];
    /**
     * False when the source paginates, whatever the row count is. A paginating source that
     * happened to return everything on one page is still reporting one page.
     */
    readonly isComplete: boolean;
}

export interface GridApi<TRow> {
    getState(): GridState<TRow>;
    subscribe(listener: (state: GridState<TRow>) => void): Unsubscribe;
    on<K extends keyof GridEventMap<TRow>>(
        event: K,
        listener: (payload: GridEventMap<TRow>[K]) => void,
    ): Unsubscribe;

    getColumns(): readonly ResolvedColumn<TRow, ColumnValue>[];
    setColumns(columns: readonly ColumnDef<TRow, ColumnValue>[]): void;
    setDataSource(dataSource: DataSource<TRow>): void;

    setQuery(update: Partial<GridQuery> | ((current: GridQuery) => Partial<GridQuery>)): void;
    setSort(sort: readonly SortSpec[]): void;
    toggleSort(columnId: string, options?: { additive?: boolean }): void;
    getSort(columnId: string): SortDirection | null;
    setFilters(filters: readonly FilterSpec[]): void;
    setFilter(columnId: string, filter: Omit<FilterSpec, 'columnId'> | null): void;
    getFilter(columnId: string): FilterSpec | null;
    setSearch(term: string): void;
    setPage(pageIndex: number): void;
    nextPage(): void;
    previousPage(): void;
    setPageSize(pageSize: number): void;

    setSelectionMode(mode: SelectionMode): void;
    getSelectionMode(): SelectionMode;
    toggleRowSelection(id: RowId): void;
    setSelectedIds(ids: readonly RowId[]): void;
    selectPage(): void;
    clearSelection(): void;
    isSelected(id: RowId): boolean;
    /** Selected rows that are loaded right now; ids selected on other pages cannot be resolved. */
    getSelectedRows(): readonly TRow[];

    /**
     * Every row matching the query, before the page was cut, and whether that is all of them.
     *
     * `state.rows` is one page. This runs the registered stages below `STAGE_ORDER.PAGINATE` over
     * the rows the source last returned, which for an in-memory source is the whole result set.
     *
     * `isComplete` is the part worth reading. A source that paginates for itself left the rest on
     * the server, so what comes back is the page in memory and nothing more. Exporting it as
     * though it were everything is the mistake this return shape exists to prevent.
     */
    getMatchingRows(): MatchingRows<TRow>;
    /**
     * Every row matching the query, fetching the ones that are not in memory.
     *
     * Resolves from memory when the source does not paginate. When it does, this asks the source's
     * `fetchAll`, runs the same stages over what comes back, and rejects with a `GridwrightError`
     * when the source has no `fetchAll` to ask. It never resolves with a truncated set.
     *
     * It does not touch grid state: no loading status, no `fetch:*` event, no change to the rows
     * on screen. An export is not a navigation.
     */
    fetchAllRows(options?: { signal?: AbortSignal }): Promise<readonly TRow[]>;

    use(plugin: GridPlugin<TRow>): Unsubscribe;
    /**
     * Recomputes the visible rows from the last settled result, without asking the source again.
     *
     * For state that changes what is shown rather than what was fetched: an expanded tree node, a
     * plugin's own option. `refresh()` would issue a network request to answer a question the
     * client can already answer.
     */
    invalidatePipeline(): void;
    refresh(): Promise<void>;
    destroy(): void;
    readonly destroyed: boolean;
}
