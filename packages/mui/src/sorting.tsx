import TableSortLabel from '@mui/material/TableSortLabel';
import {
    ariaSortOf,
    headerContentOf,
    sortAnnouncement,
    sortingMessages,
    sortPriorityOf,
    sortTitleOf,
    SORTING_ADDON,
    useAddonMessages,
    useGridwrightContext,
    type GridAddon,
    type ResolvedColumn,
    type SortingOptions,
} from 'apsw-gridwright/react';

/**
 * Sorting from the headers with MUI's `TableSortLabel`.
 *
 * The same add-on as `sorting()` in another control: the same name, so translations, overrides and
 * everything that orders against it still find it; the same `aria-sort`, title, priority badge and
 * sentence, because both call the helpers `apsw-gridwright/react` exports.
 */
export function muiSorting<TRow>(options: SortingOptions = {}): GridAddon<TRow> {
    const multiSort = options.multiSort !== false;

    return {
        name: SORTING_ADDON,
        setup: () => ({
            messages: sortingMessages,
            headerLabel: (column) => <MuiSortLabel column={column} multiSort={multiSort} />,
            headerAttributes: (column, grid) => (column.sortable ? { 'aria-sort': ariaSortOf(grid.api.getSort(column.id)) } : {}),
            announce: [sortAnnouncement<TRow>()],
        }),
    };
}

function MuiSortLabel<TRow>({ column, multiSort }: { column: ResolvedColumn<TRow>; multiSort: boolean }) {
    const grid = useGridwrightContext<TRow>();
    const t = useAddonMessages(SORTING_ADDON, sortingMessages);
    const content = headerContentOf(column, grid);

    if (!column.sortable) return <span className="gw-header-label">{content}</span>;

    const direction = grid.api.getSort(column.id);
    const priority = direction === null ? 0 : sortPriorityOf(grid.api.getState().query.sort, column.id);

    return (
        <TableSortLabel
            // A real button, whatever the theme's ButtonBase does: MUI's default is a span with a
            // role, and the grid promises a control a keyboard reaches by tabbing.
            component="button"
            type="button"
            className="gw-sort-button"
            active={direction !== null}
            direction={direction ?? 'asc'}
            title={sortTitleOf(direction, multiSort, t)}
            onClick={(event) => grid.api.toggleSort(column.id, { additive: multiSort && event.shiftKey })}
        >
            <span className="gw-header-label">{content}</span>
            {/* Hidden, so the button's name stays the header text; the announcement speaks the priority. */}
            {priority > 0 && (
                <span className="gw-sort-priority" aria-hidden="true">
                    {priority}
                </span>
            )}
        </TableSortLabel>
    );
}
