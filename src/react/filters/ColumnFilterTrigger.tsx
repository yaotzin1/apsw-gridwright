import { useAddonMessages } from '../addons/context';
import { classes, useGridwrightContext } from '../context';
import { FILTERS_ADDON, filterMessages } from './messages';
import { useColumnFilters } from './ColumnFilterProvider';
import type { ColumnFilterTriggerProps } from './types';

/**
 * A column's filter button, for a header cell.
 *
 * A `<button>` beside the sort button rather than inside it: a button cannot contain a button, and a
 * reader has to be able to reach "sort by salary" and "filter salary" as two separate things. Its name
 * says whether the column is filtered, because the accent colour is otherwise the only sign.
 *
 * Renders nothing for a column that is not `filterable`, so a custom header can place it in every
 * column without checking.
 */
export function ColumnFilterTrigger({ columnId, className }: ColumnFilterTriggerProps) {
    const filters = useColumnFilters();
    const { api, columns, classNames } = useGridwrightContext();
    const t = useAddonMessages(FILTERS_ADDON, filterMessages);
    const column = columns.find((candidate) => candidate.id === columnId);

    if (!column || !column.filterable) return null;

    const active = api.getFilter(columnId) !== null;
    const expanded = filters.openColumnId === columnId;

    return (
        <button
            ref={filters.triggerRef(columnId)}
            type="button"
            className={classes('gw-filter-trigger', classNames.filterTrigger, className)}
            aria-haspopup="dialog"
            aria-expanded={expanded}
            aria-controls={expanded ? filters.dialogId : undefined}
            aria-label={t(active ? 'openActive' : 'open', { column: column.header })}
            data-active={active ? 'true' : undefined}
            onClick={() => (expanded ? filters.close(false) : filters.open(columnId))}
        >
            {/* A funnel. Decoration: the name above is what assistive technology reads. */}
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
                <path d="M2 3h12l-4.6 5.4v4.3l-2.8 1.3V8.4z" />
            </svg>
        </button>
    );
}
