import { classes, useGridwrightContext } from '../context';
import { useOptionalColumnFilters } from './ColumnFilterProvider';
import type { GridFilterClearProps } from './types';

/**
 * Removes every filter, for a toolbar. Shown only while there is one to remove.
 *
 * It counts `query.filters`, not the columns with a trigger, so a filter set by code is counted and
 * cleared too: a filter the reader cannot see how to remove is one they will take for the data.
 */
export function GridFilterClear({ className }: GridFilterClearProps) {
    const { api, state, labels } = useGridwrightContext();
    const filters = useOptionalColumnFilters();
    const count = state.query.filters.length;

    if (count === 0) return null;

    return (
        <button
            type="button"
            className={classes('gw-button', 'gw-filter-clear-all', className)}
            onClick={() => {
                filters?.close(false);
                // This button is about to disappear. Moving focus before it does keeps the reader in
                // the grid instead of on the document body, and the headers are where filters live.
                filters?.focusTrigger();
                api.setFilters([]);
            }}
        >
            {labels.filterClearAll(count)}
        </button>
    );
}
