import { findColumn } from '../core/columns';
import { STAGE_ORDER } from '../core/pipeline';
import type { ColumnValue, GridPlugin, PipelineContext, ResolvedColumn } from '../core/types';
import { compareValues } from '../core/values';

export const SORTING_STAGE_ID = 'core:sort';

/**
 * In-memory multi-column sort.
 *
 * Skipped entirely when the data source reports `sort: true`, which is what keeps a server-ordered
 * page from being reordered locally by a comparator that knows only the 25 rows in front of it.
 */
export function sortingPlugin<TRow>(): GridPlugin<TRow> {
    return {
        name: 'gridwright:sorting',
        setup(context) {
            return context.registerStage({
                id: SORTING_STAGE_ID,
                order: STAGE_ORDER.SORT,
                capability: 'sort',
                run(rows, pipeline) {
                    if (pipeline.query.sort.length === 0 || rows.length === 0) return rows;
                    return sortRows(rows, pipeline);
                },
            });
        },
    };
}

function sortRows<TRow>(rows: readonly TRow[], pipeline: PipelineContext<TRow>): readonly TRow[] {
    type Plan = { column: ResolvedColumn<TRow, ColumnValue>; direction: 1 | -1 };

    const plan: Plan[] = [];
    for (const spec of pipeline.query.sort) {
        const column = findColumn(pipeline.columns, spec.columnId);
        // A sort on an unknown or non-sortable column is dropped rather than throwing: column sets
        // change at runtime and a stale sort spec should not blank the grid.
        if (!column || !column.sortable) continue;
        plan.push({ column, direction: spec.direction === 'desc' ? -1 : 1 });
    }

    if (plan.length === 0) return rows;

    // Copied first: the rows array may be the data source's own storage, and sorting in place
    // would mutate what a local source hands out on the next fetch.
    return [...rows].sort((left, right) => {
        for (const { column, direction } of plan) {
            const a = column.getValue(left);
            const b = column.getValue(right);
            const result = column.comparator
                ? column.comparator(a, b, left, right)
                : compareValues(a, b);
            if (result !== 0) return result * direction;
        }
        return 0;
    });
}
