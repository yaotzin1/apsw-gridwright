import type { ColumnValue, GridState, ResolvedColumn, SortSpec } from '../../core/types';
import { useAddonMessages } from '../addons/context';
import type { AnnouncementChange, GridAddon } from '../addons/types';
import { useGridwrightContext } from '../context';
import { headerContentOf } from '../parts/GridHeader';
import { SORTING_ADDON, sortingMessages } from './messages';

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
            headerAttributes: (column, grid) => {
                if (!column.sortable) return {};
                const direction = grid.api.getSort(column.id);
                return { 'aria-sort': direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none' };
            },
            announce: [
                {
                    // Above column filters: both are caused by the reader from a header, and a sort is
                    // the one a row count says nothing about.
                    priority: 20,
                    key: (state) => sortSignature(state),
                    describe: (change) => describeSort(change),
                },
            ],
        }),
    };
}

function SortButton<TRow>({ column, multiSort }: { column: ResolvedColumn<TRow, ColumnValue>; multiSort: boolean }) {
    const grid = useGridwrightContext<TRow>();
    const t = useAddonMessages(SORTING_ADDON, sortingMessages);
    const content = headerContentOf(column, grid);

    if (!column.sortable) return <span className="gw-header-label">{content}</span>;

    const direction = grid.api.getSort(column.id);
    const action = direction === null ? t('ascending') : direction === 'asc' ? t('descending') : t('clear');
    const sort = grid.api.getState().query.sort;
    // A priority means something only against another sorted column, so a single sort shows none.
    const priority = direction !== null && sort.length > 1 ? sort.findIndex((spec) => spec.columnId === column.id) + 1 : 0;

    return (
        <button
            type="button"
            className="gw-sort-button"
            onClick={(event) => grid.api.toggleSort(column.id, { additive: multiSort && event.shiftKey })}
            title={multiSort ? t('actionWithShift', { action }) : action}
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

const sortSignature = (state: GridState<unknown>): string =>
    state.query.sort.map((spec) => `${spec.columnId}:${spec.direction}`).join(',');

/**
 * The one column whose sort changed, named by its header.
 *
 * Sorting is usually one column at a time, and where it is not, the column the reader just
 * activated is the one that differs from the previous query. A multi-column sort where several
 * change at once comes from `setSort`, which the reader did not press, so naming the first is as
 * good an answer as any and better than naming none.
 */
function describeSort<TRow>({ previous, next, headers, t }: AnnouncementChange<TRow>): string | null {
    const before = new Map(previous?.query.sort.map((spec: SortSpec) => [spec.columnId, spec.direction]) ?? []);
    const after = new Map(next.query.sort.map((spec) => [spec.columnId, spec.direction]));

    let priority = 0;
    for (const [columnId, direction] of after) {
        priority += 1;
        if (before.get(columnId) !== direction) {
            const column = headers.get(columnId) ?? columnId;
            // With one sorted column its priority is noise, and the sentence stays as it always was.
            if (after.size === 1) return t(direction === 'asc' ? 'sortedAscending' : 'sortedDescending', { column });
            return t(direction === 'asc' ? 'sortedAscendingPriority' : 'sortedDescendingPriority', { column, priority });
        }
    }
    // Nothing added or redirected, so anything that differs was cleared.
    for (const columnId of before.keys()) {
        if (!after.has(columnId)) return t('sortCleared', { column: headers.get(columnId) ?? columnId });
    }
    return null;
}
