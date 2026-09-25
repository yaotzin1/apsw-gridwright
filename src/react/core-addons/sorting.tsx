import type { ColumnValue, ResolvedColumn } from '../../core/types';
import { useAddonMessages } from '../addons/context';
import type { GridAddon } from '../addons/types';
import { useGridwrightContext } from '../context';
import { headerContentOf } from '../parts/GridHeader';
import { SORTING_ADDON, sortingMessages } from './messages';
import { ariaSortOf, sortAnnouncement, sortPriorityOf, sortTitleOf } from './sorting-logic';

export interface SortingOptions {
    /** Shift-activating a header adds its column to the sort instead of replacing it. Default true. */
    readonly multiSort?: boolean;
}

/**
 * Sorting from the headers: a real button owning each sortable header's label, `aria-sort` on the
 * cell, and a sentence in the live region naming the column the reader just sorted.
 *
 * `aria-sort` goes on the cell rather than the button because that is where assistive technology
 * looks for it, and the control is a `<button>` so keyboard users reach it by tabbing rather than by
 * guessing that a `<th>` is clickable.
 */
export function sorting<TRow>(options: SortingOptions = {}): GridAddon<TRow> {
    const multiSort = options.multiSort !== false;

    return {
        name: SORTING_ADDON,
        setup: () => ({
            messages: sortingMessages,
            headerLabel: (column) => <SortButton column={column} multiSort={multiSort} />,
            headerAttributes: (column, grid) => (column.sortable ? { 'aria-sort': ariaSortOf(grid.api.getSort(column.id)) } : {}),
            announce: [sortAnnouncement<TRow>()],
        }),
    };
}

function SortButton<TRow>({ column, multiSort }: { column: ResolvedColumn<TRow, ColumnValue>; multiSort: boolean }) {
    const grid = useGridwrightContext<TRow>();
    const t = useAddonMessages(SORTING_ADDON, sortingMessages);
    const content = headerContentOf(column, grid);

    if (!column.sortable) return <span className="gw-header-label">{content}</span>;

    const direction = grid.api.getSort(column.id);
    const priority = direction === null ? 0 : sortPriorityOf(grid.api.getState().query.sort, column.id);

    return (
        <button
            type="button"
            className="gw-sort-button"
            onClick={(event) => grid.api.toggleSort(column.id, { additive: multiSort && event.shiftKey })}
            title={sortTitleOf(direction, multiSort, t)}
        >
            <span className="gw-header-label">{content}</span>
            <span className="gw-sort-indicator" aria-hidden="true" data-direction={direction ?? 'none'} />
            {/* Hidden, so the button's name stays the header text; the announcement speaks the priority. */}
            {priority > 0 && (
                <span className="gw-sort-priority" aria-hidden="true">
                    {priority}
                </span>
            )}
        </button>
    );
}
