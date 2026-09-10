import { corePlugins } from '../plugins';
import { resolveColumns } from './columns';
import { GridEmitter } from './emitter';
import { isAbortError, toGridError } from './errors';
import { runPipeline } from './pipeline';
import { createQuery, normalizeQuery, queriesEqual, resetsPage } from './query';
import type {
    DataSource,
    DataSourceResult,
    FilterSpec,
    GridApi,
    GridEngineOptions,
    GridError,
    GridPlugin,
    GridQuery,
    GridRow,
    GridState,
    PipelineStage,
    RowId,
    SelectionMode,
    SortDirection,
    SortSpec,
    Unsubscribe,
} from './types';

const isThenable = (value: unknown): value is Promise<unknown> =>
    typeof (value as { then?: unknown } | null)?.then === 'function';

const now = (): number =>
    typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();

/**
 * Creates a grid engine: query state, a data source, an in-memory pipeline and the plugins that
 * fill it.
 *
 * The engine has no opinion about where rows come from. It asks the data source what that source
 * resolves for itself, applies everything the source left undone, and publishes one state shape
 * either way. That is why the React component never branches on local versus remote, and why
 * swapping an array for a REST endpoint is a one-line change at the call site.
 */
export function createGridEngine<TRow>(options: GridEngineOptions<TRow>): GridApi<TRow> {
    const emitter = new GridEmitter<TRow>();
    const keepPreviousData = options.keepPreviousData ?? true;
    const debounceMs = Math.max(0, options.queryDebounceMs ?? 0);
    const explicitRowId = options.getRowId;

    let columns = resolveColumns(options.columns);
    let dataSource = options.dataSource;
    // Off unless asked for: a checkbox column nobody requested is a column the reader has to
    // account for, and most grids are read-only.
    let selectionMode: SelectionMode = options.selectionMode ?? 'none';
    let destroyed = false;

    const stages = new Map<string, PipelineStage<TRow>>();
    const pluginTeardowns = new Map<string, Unsubscribe[]>();
    const meta: Record<string, unknown> = {};

    const subscribers = new Set<(state: GridState<TRow>) => void>();

    let requestSequence = 0;
    let inFlight: AbortController | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let sourceInvalidation: Unsubscribe | null = null;
    /** Rows exactly as the source returned them, kept so selection changes need no refetch. */
    let sourceRows: readonly TRow[] = [];
    let sourceTotal: number | undefined;

    let state: GridState<TRow> = {
        status: 'idle',
        query: createQuery(options.initialQuery),
        rows: [],
        totalRows: 0,
        pageCount: 1,
        hasNextPage: false,
        hasPreviousPage: false,
        isTotalExact: true,
        selectedIds: [],
        error: null,
        version: 0,
        meta: {},
    };

    // -----------------------------------------------------------------------------------------
    // State plumbing
    // -----------------------------------------------------------------------------------------

    function setState(patch: Partial<GridState<TRow>>): void {
        state = { ...state, ...patch };
        for (const listener of [...subscribers]) {
            try {
                listener(state);
            } catch (error) {
                console.error('[gridwright] state subscriber threw', error);
            }
        }
        emitter.emit('state:change', { state });
    }

    function rowIdFor(row: TRow, indexInPage: number): RowId {
        if (explicitRowId) return explicitRowId(row, indexInPage);

        const candidate = (row as { id?: unknown } | null)?.id;
        if (typeof candidate === 'string' || typeof candidate === 'number') return candidate;

        // Falling back to a position, the offset must include the page. Without it row 0 of page 2
        // shares an id with row 0 of page 1 and a selection silently follows the reader around.
        const { pageIndex, pageSize } = state.query.pagination;
        return pageIndex * pageSize + indexInPage;
    }

    function buildRows(rows: readonly TRow[], selectedIds: readonly RowId[]): readonly GridRow<TRow>[] {
        const selected = new Set<RowId>(selectedIds);
        return rows.map((data, index) => ({
            id: rowIdFor(data, index),
            index,
            data,
            selected: selected.has(rowIdFor(data, index)),
        }));
    }

    // -----------------------------------------------------------------------------------------
    // Fetching
    // -----------------------------------------------------------------------------------------

    function applyResult(
        sequence: number,
        result: DataSourceResult<TRow>,
        startedAt: number,
        options: { silent?: boolean } = {},
    ): void {
        if (destroyed || sequence !== requestSequence) return;

        sourceRows = result.rows ?? [];
        sourceTotal = result.totalRows;

        const capabilities = dataSource.capabilities;
        const declaredTotal = typeof sourceTotal === 'number' ? sourceTotal : sourceRows.length;

        const pipeline = runPipeline<TRow>({
            stages: [...stages.values()],
            rows: sourceRows,
            context: {
                query: state.query,
                columns: columns,
                capabilities,
                totalRows: declaredTotal,
            },
            onStageError: (stageId, error) => {
                emitter.emit('plugin:error', { plugin: stageId, error });
            },
        });

        const { pageIndex, pageSize } = state.query.pagination;

        // A paginating source that returns no total leaves the grid able to say "there is another
        // page" and nothing more. Reporting that as an exact count would invent a number.
        const isTotalExact = !capabilities.paginate || typeof sourceTotal === 'number';
        const totalRows = isTotalExact
            ? pipeline.totalRows
            : pageIndex * pageSize + pipeline.rows.length;

        const hasNextPage = isTotalExact
            ? (pageIndex + 1) * pageSize < totalRows
            : pipeline.rows.length === pageSize;
        const pageCount = isTotalExact
            ? Math.max(1, Math.ceil(totalRows / pageSize))
            : pageIndex + (hasNextPage ? 2 : 1);

        const selectedIds = selectionMode === 'none' ? [] : state.selectedIds;

        setState({
            status: 'ready',
            rows: buildRows(pipeline.rows, selectedIds),
            totalRows,
            pageCount,
            hasNextPage,
            hasPreviousPage: pageIndex > 0,
            isTotalExact,
            selectedIds,
            error: null,
            version: state.version + 1,
            meta: { ...meta, ...(result.meta ?? {}) },
        });

        // A recompute is not a fetch. Announcing one would make a plugin registration look like
        // a network round trip to anything counting requests.
        if (!options.silent) {
            emitter.emit('fetch:success', {
                rows: sourceRows,
                totalRows,
                durationMs: now() - startedAt,
            });
            emitter.emit('fetch:settled', { ok: true });
        }

        // Filtering while deep in a set can leave the reader on a page that no longer exists. The
        // engine is the only layer that knows the total, so the correction belongs here rather
        // than in the pagination stage, which cannot see a remote source's count.
        if (isTotalExact && pageIndex > 0 && pageIndex >= pageCount) {
            setPage(pageCount - 1);
        }
    }

    function handleFetchError(sequence: number, cause: unknown, controller: AbortController): void {
        if (destroyed || sequence !== requestSequence) return;
        if (controller.signal.aborted || isAbortError(cause)) return;

        const error: GridError = toGridError(cause);

        setState({
            status: 'error',
            rows: keepPreviousData ? state.rows : [],
            error,
            version: state.version + 1,
        });

        emitter.emit('fetch:error', { error });
        emitter.emit('fetch:settled', { ok: false });
        options.onError?.(error);
    }

    function performFetch(): Promise<void> {
        if (destroyed) return Promise.resolve();

        inFlight?.abort();
        const controller = new AbortController();
        inFlight = controller;
        const sequence = (requestSequence += 1);
        const startedAt = now();
        const query = state.query;

        emitter.emit('fetch:start', { query });

        let result: DataSourceResult<TRow> | Promise<DataSourceResult<TRow>>;
        try {
            result = dataSource.fetch({
                query,
                columns: columns,
                signal: controller.signal,
                meta: { ...meta },
            });
        } catch (error) {
            handleFetchError(sequence, error, controller);
            return Promise.resolve();
        }

        // A synchronous source resolves in this tick, so publishing a loading state first would
        // make an in-memory grid flash a spinner it never needed.
        if (!isThenable(result)) {
            applyResult(sequence, result as DataSourceResult<TRow>, startedAt);
            return Promise.resolve();
        }

        const showsStaleRows = keepPreviousData && state.rows.length > 0;
        setState({ status: showsStaleRows ? 'refreshing' : 'loading', error: null });

        return (result as Promise<DataSourceResult<TRow>>).then(
            (settled) => applyResult(sequence, settled, startedAt),
            (error: unknown) => handleFetchError(sequence, error, controller),
        );
    }

    function scheduleFetch(): void {
        if (destroyed) return;
        if (debounceMs === 0) {
            void performFetch();
            return;
        }
        if (debounceTimer !== null) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            debounceTimer = null;
            void performFetch();
        }, debounceMs);
    }

    /**
     * Recomputes the visible page from rows already fetched, without touching the source.
     *
     * Only from a settled, successful state. Running this mid-fetch would publish `ready` over an
     * in-flight `loading` using rows that have not arrived, so a column change during the first
     * load turned the grid into a permanently empty one that claimed to be finished.
     */
    function recomputeFromCache(): void {
        if (state.status !== 'ready') return;
        applyResult(requestSequence, { rows: sourceRows, totalRows: sourceTotal }, now(), { silent: true });
    }

    // -----------------------------------------------------------------------------------------
    // Query commands
    // -----------------------------------------------------------------------------------------

    function commitQuery(patch: Partial<GridQuery>): void {
        if (destroyed) return;

        const previous = state.query;
        const merged = normalizeQuery({
            sort: patch.sort ?? previous.sort,
            filters: patch.filters ?? previous.filters,
            search: patch.search ?? previous.search,
            pagination: { ...previous.pagination, ...(patch.pagination ?? {}) },
        });

        const pageWasSetExplicitly =
            patch.pagination?.pageIndex !== undefined &&
            patch.pagination.pageIndex !== previous.pagination.pageIndex;

        const next =
            !pageWasSetExplicitly && resetsPage(previous, merged)
                ? { ...merged, pagination: { ...merged.pagination, pageIndex: 0 } }
                : merged;

        if (queriesEqual(previous, next)) return;

        setState({ query: next });
        emitter.emit('query:change', { query: next, previous });
        scheduleFetch();
    }

    function setPage(pageIndex: number): void {
        commitQuery({ pagination: { ...state.query.pagination, pageIndex } });
    }

    // -----------------------------------------------------------------------------------------
    // Selection
    // -----------------------------------------------------------------------------------------

    function commitSelection(ids: readonly RowId[]): void {
        const next = selectionMode === 'none' ? [] : ids;
        const unchanged =
            next.length === state.selectedIds.length &&
            next.every((id, index) => id === state.selectedIds[index]);
        if (unchanged) return;

        setState({
            selectedIds: next,
            rows: state.rows.map((row) => ({ ...row, selected: next.includes(row.id) })),
        });
        emitter.emit('selection:change', { selectedIds: next });
    }

    // -----------------------------------------------------------------------------------------
    // Plugins
    // -----------------------------------------------------------------------------------------

    function installPlugin(plugin: GridPlugin<TRow>): Unsubscribe {
        if (destroyed) return () => undefined;

        const teardowns: Unsubscribe[] = [];
        const context = {
            api,
            registerStage(stage: PipelineStage<TRow>): Unsubscribe {
                if (stages.has(stage.id)) {
                    throw new Error(
                        `[gridwright] stage id "${stage.id}" is already registered. Give the stage its own id, or unregister the existing one first.`,
                    );
                }
                stages.set(stage.id, stage);
                const remove = () => {
                    stages.delete(stage.id);
                };
                teardowns.push(remove);
                return remove;
            },
            on: emitter.on.bind(emitter),
            setMeta(key: string, value: unknown): void {
                meta[`${plugin.name}:${key}`] = value;
                setState({ meta: { ...state.meta, [`${plugin.name}:${key}`]: value } });
            },
        };

        try {
            const teardown = plugin.setup(context);
            if (typeof teardown === 'function') teardowns.push(teardown);
        } catch (error) {
            emitter.emit('plugin:error', { plugin: plugin.name, error });
        }

        pluginTeardowns.set(plugin.name, teardowns);

        // Stages added after the first fetch have to be given the rows they missed, or a plugin
        // registered late appears to do nothing until the next query change.
        recomputeFromCache();

        return () => {
            for (const teardown of teardowns.splice(0)) {
                try {
                    teardown();
                } catch (error) {
                    emitter.emit('plugin:error', { plugin: plugin.name, error });
                }
            }
            pluginTeardowns.delete(plugin.name);
            recomputeFromCache();
        };
    }

    function attachSource(source: DataSource<TRow>): void {
        sourceInvalidation?.();
        sourceInvalidation = source.subscribe?.(() => {
            void performFetch();
        }) ?? null;
    }

    // -----------------------------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------------------------

    const api: GridApi<TRow> = {
        getState: () => state,

        subscribe(listener) {
            subscribers.add(listener);
            return () => {
                subscribers.delete(listener);
            };
        },

        on: (event, listener) => emitter.on(event, listener),

        getColumns: () => columns,

        setColumns(next) {
            columns = resolveColumns(next);
            recomputeFromCache();
        },

        setDataSource(next) {
            dataSource = next;
            attachSource(next);
            void performFetch();
        },

        setQuery(update) {
            const patch = typeof update === 'function' ? update(state.query) : update;
            commitQuery(patch);
        },

        setSort(sort) {
            commitQuery({ sort });
        },

        toggleSort(columnId, toggleOptions) {
            const column = columns.find((entry) => entry.id === columnId);
            if (!column || !column.sortable) return;

            const current = state.query.sort.find((spec) => spec.columnId === columnId);
            const additive = toggleOptions?.additive ?? false;
            const others = additive
                ? state.query.sort.filter((spec) => spec.columnId !== columnId)
                : [];

            // asc, then desc, then off. The third state matters: without it a column can never be
            // returned to the source's natural order once it has been clicked.
            let next: readonly SortSpec[];
            if (!current) {
                next = [...others, { columnId, direction: 'asc' as SortDirection }];
            } else if (current.direction === 'asc') {
                next = [...others, { columnId, direction: 'desc' as SortDirection }];
            } else {
                next = others;
            }

            commitQuery({ sort: next });
        },

        getSort(columnId) {
            return state.query.sort.find((spec) => spec.columnId === columnId)?.direction ?? null;
        },

        setFilters(filters) {
            commitQuery({ filters });
        },

        setFilter(columnId, filter) {
            const remaining = state.query.filters.filter((entry) => entry.columnId !== columnId);
            const next: readonly FilterSpec[] = filter
                ? [...remaining, { columnId, ...filter }]
                : remaining;
            commitQuery({ filters: next });
        },

        getFilter(columnId) {
            return state.query.filters.find((entry) => entry.columnId === columnId) ?? null;
        },

        setSearch(term) {
            commitQuery({ search: term });
        },

        setPage,

        nextPage() {
            if (!state.hasNextPage) return;
            setPage(state.query.pagination.pageIndex + 1);
        },

        previousPage() {
            if (!state.hasPreviousPage) return;
            setPage(state.query.pagination.pageIndex - 1);
        },

        setPageSize(pageSize) {
            commitQuery({ pagination: { ...state.query.pagination, pageSize } });
        },

        setSelectionMode(mode) {
            selectionMode = mode;
            if (mode === 'none') commitSelection([]);
            if (mode === 'single' && state.selectedIds.length > 1) {
                commitSelection(state.selectedIds.slice(0, 1));
            }
        },

        getSelectionMode: () => selectionMode,

        toggleRowSelection(id) {
            if (selectionMode === 'none') return;
            if (selectionMode === 'single') {
                commitSelection(state.selectedIds[0] === id ? [] : [id]);
                return;
            }
            commitSelection(
                state.selectedIds.includes(id)
                    ? state.selectedIds.filter((entry) => entry !== id)
                    : [...state.selectedIds, id],
            );
        },

        setSelectedIds(ids) {
            commitSelection(selectionMode === 'single' ? ids.slice(0, 1) : ids);
        },

        selectPage() {
            if (selectionMode === 'none') return;
            const pageIds = state.rows.map((row) => row.id);
            if (selectionMode === 'single') {
                commitSelection(pageIds.slice(0, 1));
                return;
            }
            const allSelected = pageIds.every((id) => state.selectedIds.includes(id));
            commitSelection(
                allSelected
                    ? state.selectedIds.filter((id) => !pageIds.includes(id))
                    : [...new Set([...state.selectedIds, ...pageIds])],
            );
        },

        clearSelection() {
            commitSelection([]);
        },

        isSelected: (id) => state.selectedIds.includes(id),

        getSelectedRows: () => state.rows.filter((row) => row.selected).map((row) => row.data),

        use: installPlugin,

        invalidatePipeline() {
            recomputeFromCache();
        },

        refresh() {
            if (debounceTimer !== null) {
                clearTimeout(debounceTimer);
                debounceTimer = null;
            }
            return performFetch();
        },

        destroy() {
            if (destroyed) return;
            destroyed = true;

            if (debounceTimer !== null) clearTimeout(debounceTimer);
            debounceTimer = null;
            inFlight?.abort();
            inFlight = null;

            for (const teardowns of pluginTeardowns.values()) {
                for (const teardown of teardowns) {
                    try {
                        teardown();
                    } catch (error) {
                        console.error('[gridwright] plugin teardown threw', error);
                    }
                }
            }
            pluginTeardowns.clear();
            stages.clear();

            // The data source is not disposed here. The engine did not create it, a source is
            // routinely shared between grids, and React Strict Mode destroys an engine once on
            // purpose -- disposing someone else's source there would break the remount.
            sourceInvalidation?.();
            sourceInvalidation = null;

            subscribers.clear();
            emitter.clear();
        },

        get destroyed() {
            return destroyed;
        },
    };

    emitter.setErrorHandler((event, error) => {
        emitter.emit('plugin:error', { plugin: `listener:${event}`, error });
    });

    for (const plugin of options.plugins ?? corePlugins<TRow>()) {
        installPlugin(plugin);
    }

    attachSource(dataSource);

    if (options.autoFetch ?? true) {
        void performFetch();
    }

    return api;
}
