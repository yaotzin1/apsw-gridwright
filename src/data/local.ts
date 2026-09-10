import type { DataSource, DataSourceCapabilities, Unsubscribe } from '../core/types';

export interface LocalDataSource<TRow> extends DataSource<TRow> {
    /** Replaces the backing array and tells any attached grid to recompute. */
    setRows(rows: readonly TRow[]): void;
    getRows(): readonly TRow[];
}

export interface LocalDataSourceOptions {
    /**
     * Override individual capabilities when the array is already sorted, filtered or paged by
     * something upstream. Everything defaults to false, meaning the pipeline does all of it.
     */
    readonly capabilities?: Partial<DataSourceCapabilities>;
}

const NOTHING_RESOLVED: DataSourceCapabilities = {
    sort: false,
    filter: false,
    search: false,
    paginate: false,
};

/**
 * An in-memory array as a data source.
 *
 * It declares no capabilities, so every facet of the query is applied by the pipeline. It also
 * answers synchronously, which the engine detects: an array-backed grid renders its first page on
 * the first paint instead of flashing a loading state it never needed.
 */
export function createLocalDataSource<TRow>(
    initialRows: readonly TRow[] = [],
    options: LocalDataSourceOptions = {},
): LocalDataSource<TRow> {
    let rows = initialRows;
    const listeners = new Set<() => void>();

    return {
        kind: 'local',
        capabilities: { ...NOTHING_RESOLVED, ...options.capabilities },

        fetch() {
            return { rows, totalRows: rows.length };
        },

        subscribe(onInvalidate: () => void): Unsubscribe {
            listeners.add(onInvalidate);
            return () => {
                listeners.delete(onInvalidate);
            };
        },

        setRows(next) {
            rows = next;
            for (const listener of [...listeners]) listener();
        },

        getRows: () => rows,

        dispose() {
            listeners.clear();
        },
    };
}
