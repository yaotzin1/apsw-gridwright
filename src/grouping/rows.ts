import type { GroupedRow } from './types';

/**
 * Drops group headers and hands back the member rows, in the same order.
 *
 * `api.getMatchingRows()` on a grouped grid answers `GroupedRow<TRow>[]`, group headers included,
 * the same way it does for a tree grid's nodes: every stage below `PAGINATE` ran, and grouping is one
 * of them. An export or any other consumer of "every matching row" that wants your row and nothing
 * else calls this on the result.
 */
export function ungroupedRows<TRow>(rows: readonly GroupedRow<TRow>[]): readonly TRow[] {
    return rows.flatMap((row) => (row.kind === 'row' ? [row.row] : []));
}
