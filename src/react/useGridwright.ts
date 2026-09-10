import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createGridEngine } from '../core/engine';
import { createQuery } from '../core/query';
import type { LocalDataSource } from '../data/local';
import { createLocalDataSource } from '../data/local';
import type { ColumnValue, DataSource, GridApi } from '../core/types';
import type { GridwrightColumn, GridwrightInstance, UseGridwrightOptions } from './types';

/**
 * Cheap identity for a column set.
 *
 * Column arrays are almost always written inline, so their reference changes on every render.
 * Rebuilding the engine's columns on reference alone would loop: setColumns publishes state, the
 * state publishes a render, the render makes a new array. Only the parts the engine actually
 * reads take part in this signature; renderers are read from props at render time instead.
 */
function columnSignature<TRow>(columns: readonly GridwrightColumn<TRow, ColumnValue>[]): string {
    return columns
        .map((column) =>
            [
                column.id,
                column.header ?? '',
                typeof column.accessor === 'function' ? 'fn' : String(column.accessor ?? ''),
                column.sortable === false ? '0' : '1',
                column.filterable === false ? '0' : '1',
                column.searchable === false ? '0' : '1',
                column.hidden ? '1' : '0',
            ].join('~'),
        )
        .join('|');
}

/**
 * Creates and owns a grid engine for a React tree.
 *
 * Use it directly when you want to compose the parts yourself, or let `<Gridwright />` call it for
 * you. Either way the engine outlives renders, and the component re-renders through
 * `useSyncExternalStore`, so a state change reaches concurrent-mode React without tearing.
 */
export function useGridwright<TRow>(options: UseGridwrightOptions<TRow>): GridwrightInstance<TRow> {
    if (options.data !== undefined && options.dataSource !== undefined) {
        throw new Error(
            '[gridwright] pass either `data` for an in-memory array or `dataSource` for anything else, not both.',
        );
    }

    const latest = useRef(options);
    latest.current = options;

    // Owned by this hook, so it is also disposed by this hook. A source passed in by the caller
    // belongs to the caller and is never disposed here.
    const ownedLocalSource = useRef<LocalDataSource<TRow> | null>(null);

    const resolveSource = useCallback((): DataSource<TRow> => {
        const current = latest.current;
        if (current.dataSource) return current.dataSource;
        if (!ownedLocalSource.current) {
            ownedLocalSource.current = createLocalDataSource<TRow>(current.data ?? []);
        }
        return ownedLocalSource.current;
    }, []);

    const createEngine = useCallback((): GridApi<TRow> => {
        const current = latest.current;
        const baseQuery = createQuery(current.initialQuery);

        return createGridEngine<TRow>({
            columns: current.columns,
            dataSource: resolveSource(),
            ...(current.getRowId ? { getRowId: current.getRowId } : {}),
            initialQuery: current.pageSize
                ? { ...baseQuery, pagination: { ...baseQuery.pagination, pageSize: current.pageSize } }
                : baseQuery,
            ...(current.selectionMode ? { selectionMode: current.selectionMode } : {}),
            ...(current.keepPreviousData !== undefined
                ? { keepPreviousData: current.keepPreviousData }
                : {}),
            ...(current.queryDebounceMs !== undefined
                ? { queryDebounceMs: current.queryDebounceMs }
                : {}),
            ...(current.plugins ? { plugins: current.plugins } : {}),
        });
    }, [resolveSource]);

    const [api, setApi] = useState<GridApi<TRow>>(createEngine);

    // What the engine is actually attached to. Comparing a new prop against `resolveSource()`
    // would compare it against itself, which is always equal, so the swap never happened.
    const attachedSource = useRef<DataSource<TRow> | null>(options.dataSource ?? null);

    useEffect(() => {
        // Strict Mode runs effects twice on mount and destroys the engine in between. Rebuilding
        // when that happens is what keeps a double-invoked mount from leaving a dead grid.
        if (api.destroyed) {
            attachedSource.current = latest.current.dataSource ?? null;
            setApi(createEngine());
            return;
        }
        return () => {
            api.destroy();
        };
    }, [api, createEngine]);

    useEffect(
        () => () => {
            ownedLocalSource.current?.dispose?.();
            ownedLocalSource.current = null;
        },
        [],
    );

    const state = useSyncExternalStore(api.subscribe, api.getState, api.getState);

    const signature = columnSignature(options.columns);
    useEffect(() => {
        // Keyed on the signature, not the array reference: see columnSignature above.
        api.setColumns(latest.current.columns);
    }, [api, signature]);

    const data = options.data;
    useEffect(() => {
        if (data === undefined) return;
        const source = ownedLocalSource.current;
        if (!source || source.getRows() === data) return;
        source.setRows(data);
    }, [api, data]);

    const dataSource = options.dataSource;
    useEffect(() => {
        if (!dataSource) return;
        if (attachedSource.current === dataSource) return;
        attachedSource.current = dataSource;
        api.setDataSource(dataSource);
    }, [api, dataSource]);

    const selectionMode = options.selectionMode;
    useEffect(() => {
        if (selectionMode && selectionMode !== api.getSelectionMode()) {
            api.setSelectionMode(selectionMode);
        }
    }, [api, selectionMode]);

    const pageSize = options.pageSize;
    useEffect(() => {
        if (pageSize && pageSize !== api.getState().query.pagination.pageSize) {
            api.setPageSize(pageSize);
        }
    }, [api, pageSize]);

    useEffect(() => {
        const offQuery = api.on('query:change', ({ query }) => latest.current.onQueryChange?.(query));
        const offSelection = api.on('selection:change', ({ selectedIds }) =>
            latest.current.onSelectionChange?.(selectedIds, api.getSelectedRows()),
        );
        const offError = api.on('fetch:error', ({ error }) => latest.current.onError?.(error));

        return () => {
            offQuery();
            offSelection();
            offError();
        };
    }, [api]);

    const definitions = useMemo(() => {
        const map = new Map<string, GridwrightColumn<TRow, ColumnValue>>();
        for (const column of options.columns) map.set(column.id, column);
        return map;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [signature, options.columns]);

    return useMemo(
        () => ({ api, state, columns: api.getColumns(), definitions }),
        [api, state, definitions],
    );
}
