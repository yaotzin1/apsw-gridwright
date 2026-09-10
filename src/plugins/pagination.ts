import { STAGE_ORDER } from '../core/pipeline';
import type { GridPlugin } from '../core/types';

export const PAGINATION_STAGE_ID = 'core:paginate';

/**
 * Cuts the current page out of the rows the earlier stages produced.
 *
 * It runs last, and it reports the pre-slice length as the total. That ordering is load-bearing:
 * the total has to count the matches, so pagination must see the filtered and searched set rather
 * than the set the data source handed over.
 *
 * Skipped when the data source reports `paginate: true`, in which case the total comes from the
 * source's own answer instead.
 */
export function paginationPlugin<TRow>(): GridPlugin<TRow> {
    return {
        name: 'gridwright:pagination',
        setup(context) {
            return context.registerStage({
                id: PAGINATION_STAGE_ID,
                order: STAGE_ORDER.PAGINATE,
                capability: 'paginate',
                run(rows, pipeline) {
                    const { pageIndex, pageSize } = pipeline.query.pagination;
                    const totalRows = rows.length;
                    const start = pageIndex * pageSize;

                    // A page past the end yields nothing on purpose. The engine notices the
                    // out-of-range page once it knows the total and moves to the last real page,
                    // which is the only place that can do it for a remote source too.
                    return { rows: rows.slice(start, start + pageSize), totalRows };
                },
            });
        },
    };
}
