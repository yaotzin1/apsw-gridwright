import { findColumn } from '../core/columns';
import { STAGE_ORDER } from '../core/pipeline';
import type { GridPlugin } from '../core/types';
import { matchesFilter } from '../core/values';

export const FILTERING_STAGE_ID = 'core:filter';

/**
 * In-memory column filters, combined with AND.
 *
 * Skipped when the data source reports `filter: true`. It reports the surviving row count as the
 * new total, because after filtering the page count must describe the matches, not the table.
 */
export function filteringPlugin<TRow>(): GridPlugin<TRow> {
    return {
        name: 'gridwright:filtering',
        setup(context) {
            return context.registerStage({
                id: FILTERING_STAGE_ID,
                order: STAGE_ORDER.FILTER,
                capability: 'filter',
                run(rows, pipeline) {
                    const filters = pipeline.query.filters;
                    // Returning the rows unchanged, rather than `{ rows, totalRows: rows.length }`:
                    // a stage that does nothing must not touch the total. A source that paginates
                    // and reports a total leaves this stage running (it does not filter for itself),
                    // and clobbering the total with the length of one page made `hasNextPage` false
                    // -- the reader was trapped on page one with no way to say why.
                    if (filters.length === 0) return rows;

                    const applicable = filters
                        .map((filter) => ({
                            filter,
                            column: findColumn(
                                pipeline.columns,
                                filter.columnId,
                            ),
                        }))
                        .filter((entry) => entry.column !== undefined && entry.column.filterable);

                    if (applicable.length === 0) return rows;

                    const matched = rows.filter((row) =>
                        applicable.every(({ filter, column }) => {
                            const value = column!.getValue(row);
                            return column!.filterFn
                                ? column!.filterFn(value, filter, row)
                                : matchesFilter(value, filter);
                        }),
                    );

                    return { rows: matched, totalRows: matched.length };
                },
            });
        },
    };
}
