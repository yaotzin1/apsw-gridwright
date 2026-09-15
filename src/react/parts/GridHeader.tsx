import type { ReactNode, ThHTMLAttributes } from 'react';
import type { ColumnValue, ResolvedColumn } from '../../core/types';
import { mergeAttributes } from '../addons/resolve';
import type { GridContext } from '../addons/types';
import { classes, useGridwrightContext } from '../context';
import { attributesOf, callSlot, extraColumnsOf, renderColumnSlot } from './slots';

/**
 * A column header's own content: the column's `headerCell` renderer, or its header text.
 *
 * Exported for an add-on that owns the header label, so a sort button of your own still shows the
 * header a column definition asked for.
 */
export function headerContentOf<TRow>(column: ResolvedColumn<TRow, ColumnValue>, grid: GridContext<TRow>): ReactNode {
    const definition = grid.definitions.get(column.id);
    return definition?.headerCell
        ? definition.headerCell({ column, api: grid.api, sortDirection: grid.api.getSort(column.id) })
        : column.header;
}

/**
 * The header row.
 *
 * The shell renders a header cell per visible column, with its width and alignment, and the extra
 * columns add-ons contribute on either side. Everything inside a cell beyond the header text comes
 * from add-ons: the sort button owns the label, a filter button sits after it, never inside it.
 */
export function GridHeader() {
    const grid = useGridwrightContext();
    const { columns, classNames } = grid;
    const extras = extraColumnsOf(grid);

    const extraHeader = (column: (typeof extras.start)[number]) => (
        <th
            key={column.id}
            {...mergeAttributes<ThHTMLAttributes<HTMLTableCellElement> & Record<string, unknown>>(
                { scope: 'col', className: classes('gw-header-cell', column.className, classNames.headerCell), 'data-column-id': column.id },
                ...attributesOf(grid.contributions.active, 'extraHeaderAttributes', (fn) => fn(column.id, grid)),
            )}
        >
            {column.header(grid)}
        </th>
    );

    return (
        <thead className={classes('gw-thead', classNames.thead)}>
            {/* Row one of the table. ARIA numbers header rows along with the rest, so the body's
                indices start at two and `aria-rowcount` counts this row. */}
            <tr className={classes('gw-header-row', classNames.headerRow)} aria-rowindex={1}>
                {extras.start.map(extraHeader)}
                {columns
                    .filter((column) => !column.hidden)
                    .map((column) => (
                        <HeaderCell key={column.id} column={column} />
                    ))}
                {extras.end.map(extraHeader)}
            </tr>
        </thead>
    );
}

function HeaderCell<TRow>({ column }: { column: ResolvedColumn<TRow, ColumnValue> }) {
    const grid = useGridwrightContext<TRow>();
    const { classNames, contributions } = grid;

    const owner = contributions.headerLabel;
    const label = owner
        ? callSlot(owner.name, () => owner.contribution.headerLabel!(column, grid), null)
        : <span className="gw-header-label">{headerContentOf(column, grid)}</span>;

    const before = renderColumnSlot(grid, 'headerBefore', column);
    const after = renderColumnSlot(grid, 'headerAfter', column);

    const attributes = mergeAttributes<ThHTMLAttributes<HTMLTableCellElement> & Record<string, unknown>>(
        {
            scope: 'col',
            className: classes('gw-header-cell', classNames.headerCell),
            style: {
                ...(column.width !== undefined ? { width: column.width } : {}),
                ...(column.minWidth !== undefined ? { minWidth: column.minWidth } : {}),
                ...(column.align ? { textAlign: column.align } : {}),
            },
            'data-column-id': column.id,
        },
        ...attributesOf(contributions.active, 'headerAttributes', (fn) => fn(column, grid)),
    );

    return (
        <th {...attributes}>
            {before.length > 0 || after.length > 0 ? (
                // Controls side by side, never one inside another: a button cannot hold a button.
                <div className="gw-header-content">
                    {before}
                    {label}
                    {after}
                </div>
            ) : (
                label
            )}
        </th>
    );
}
