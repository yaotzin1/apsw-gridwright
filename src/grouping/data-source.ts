import type { DataSource, DataSourceRequest, DataSourceResult, RowId, Unsubscribe } from '../core/types';
import type { GroupMemberRow } from './types';

export interface GroupingDataSourceOptions<TRow> {
    readonly getRowId: (row: TRow, index: number) => RowId;
}

const isThenable = (value: unknown): value is Promise<unknown> => typeof (value as { then?: unknown } | null)?.then === 'function';

/**
 * Wraps a data source so every row it answers becomes a member row, flat and ungrouped.
 *
 * The grouping stage runs after filtering, search and sorting, on rows already in this shape, and
 * turns some of them into group headers. Wrapping happens here, once, rather than inside the stage,
 * so `fetchAll` (an export of every matching row) produces the same shape without a second path.
 */
export function createGroupingDataSource<TRow>(source: DataSource<TRow>, options: GroupingDataSourceOptions<TRow>): DataSource<GroupMemberRow<TRow>> {
    const wrap = (row: TRow, index: number): GroupMemberRow<TRow> => ({
        kind: 'row',
        row,
        rowId: options.getRowId(row, index),
        depth: 0,
    });

    const toMembers = (result: DataSourceResult<TRow>): DataSourceResult<GroupMemberRow<TRow>> => ({
        rows: result.rows.map(wrap),
        ...(result.totalRows !== undefined ? { totalRows: result.totalRows } : {}),
        ...(result.meta ? { meta: result.meta } : {}),
    });

    return {
        kind: `grouping:${source.kind}`,
        capabilities: source.capabilities,

        fetch(request: DataSourceRequest<GroupMemberRow<TRow>>) {
            // Column ids are identical on both sides of the wrapper, and a source that reads columns
            // only reads their ids, so the cast is safe and avoids duplicating the set.
            const inner = request as unknown as DataSourceRequest<TRow>;
            const result = source.fetch(inner);
            return isThenable(result) ? result.then(toMembers) : toMembers(result);
        },

        ...(source.fetchAll
            ? {
                  fetchAll(request: DataSourceRequest<GroupMemberRow<TRow>>) {
                      const inner = request as unknown as DataSourceRequest<TRow>;
                      const result = source.fetchAll!(inner);
                      return isThenable(result) ? result.then(toMembers) : toMembers(result);
                  },
              }
            : {}),

        subscribe(onInvalidate: () => void): Unsubscribe {
            return source.subscribe?.(onInvalidate) ?? (() => undefined);
        },

        dispose() {
            source.dispose?.();
        },
    };
}
