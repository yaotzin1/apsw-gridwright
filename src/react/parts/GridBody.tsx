import { Fragment } from 'react';
import type { CSSProperties, HTMLAttributes, ReactNode, TdHTMLAttributes } from 'react';
import type { ColumnValue, GridRow, GridState, ResolvedColumn } from '../../core/types';
import { rowNumbering } from '../a11y/rows';
import { mergeAttributes } from '../addons/resolve';
import type { GridContext } from '../addons/types';
import { classes, useGridwrightContext } from '../context';
import { attributesOf, callSlot, columnCountOf, customRowOf, extraColumnsOf } from './slots';

/** Which of the three non-row states a body is in, if any. */
export type GridBodyStatus = 'error' | 'loading' | 'empty' | null;

/**
 * The state a body renders instead of rows.
 *
 * `windowed` is for a body whose rows are a window onto the result: there an empty window while the
 * next one loads is not an empty grid, so only a result with no rows at all counts.
 */
export function bodyStatusOf<TRow>(state: GridState<TRow>, windowed = false): GridBodyStatus {
    if (state.status === 'error' && state.rows.length === 0) return 'error';
    const nothing = windowed ? state.totalRows === 0 : state.rows.length === 0;
    if (!nothing) return null;
    return state.status === 'loading' ? 'loading' : state.status === 'idle' && !windowed ? null : 'empty';
}

/**
 * The status row: loading, empty or error, rendered inside the table rather than replacing it, so
 * the header and the column widths stay put. A table that collapses to a centred spinner and then
 * springs back to full height on every page change is the most common way a grid feels broken
 * while working correctly.
 *
 * Add-ons may replace any of the three; the last one to provide a renderer for a state wins.
 */
export function GridStatusBody({ status }: { status: Exclude<GridBodyStatus, null> }) {
    const grid = useGridwrightContext();
    const { api, state, classNames, labels, contributions } = grid;

    let content: ReactNode = null;
    let replaced = false;
    for (const { name, contribution } of contributions.active) {
        const renderer = contribution.status?.[status];
        if (!renderer) continue;
        replaced = true;
        content = callSlot(
            name,
            () =>
                status === 'error'
                    ? (renderer as NonNullable<NonNullable<typeof contribution.status>['error']>)(state.error!, () => void api.refresh(), grid)
                    : (renderer as (context: GridContext<unknown>) => ReactNode)(grid),
            null,
        );
    }

    if (!replaced) {
        content =
            status === 'error' ? (
                <div className="gw-error" role="alert">
                    <p className="gw-error-title">{labels.errorTitle}</p>
                    <p className="gw-error-message">{state.error?.message}</p>
                    {state.error?.retryable && (
                        <button type="button" className="gw-button" onClick={() => void api.refresh()}>
                            {labels.retry}
                        </button>
                    )}
                </div>
            ) : status === 'loading' ? (
                <span className="gw-loading">{labels.loading}</span>
            ) : (
                <span className="gw-empty">{labels.empty}</span>
            );
    }

    return (
        <tbody className={classes('gw-tbody', classNames.tbody)}>
            <tr className="gw-status-row">
                <td colSpan={columnCountOf(grid)} className={classes('gw-status', classNames.status)}>
                    {content}
                </td>
            </tr>
        </tbody>
    );
}

/**
 * The row body.
 *
 * When an add-on owns the body, a windowed one for instance, that add-on renders it instead.
 */
export function GridBody() {
    const grid = useGridwrightContext();
    const owner = grid.contributions.body;
    if (owner) return <>{callSlot(owner.name, () => owner.contribution.body!(grid), null)}</>;
    return <PagedBody />;
}

function PagedBody() {
    const grid = useGridwrightContext();
    const { state, classNames } = grid;

    const status = bodyStatusOf(state);
    if (status) return <GridStatusBody status={status} />;

    // Where this page starts in the whole result set. A row's ARIA index is its position across
    // every page, not its position in the twenty-five currently mounted, or a reader on page two
    // is told they are on row one.
    const { pageIndex, pageSize } = state.query.pagination;
    const pageOffset = pageIndex * pageSize;

    return (
        <tbody className={classes('gw-tbody', classNames.tbody)} aria-busy={state.status === 'refreshing'}>
            {state.rows.map((row, offset) => (
                <GridRowOrCustom key={String(row.id)} row={row} position={pageOffset + offset} />
            ))}
        </tbody>
    );
}

export interface GridRowViewProps<TRow> {
    readonly row: GridRow<TRow>;
    /** Zero-based position of the row in the whole result set, which `aria-rowindex` is built from. */
    readonly position: number;
    readonly style?: CSSProperties;
}

/** A row an add-on renders itself, or the default row. What every body renders per row. */
export function GridRowOrCustom<TRow>(props: GridRowViewProps<TRow>) {
    const grid = useGridwrightContext<TRow>();
    const custom = customRowOf(grid, props.row);
    return custom === undefined ? <GridRowView {...props} /> : <Fragment>{custom}</Fragment>;
}

/**
 * One row, as both bodies render it: the add-ons' row attributes, the extra columns on either side,
 * and a cell per visible column.
 *
 * One implementation, because two would drift, and the one that drifts is the one fewer people
 * look at.
 */
export function GridRowView<TRow>({ row, position, style }: GridRowViewProps<TRow>) {
    const grid = useGridwrightContext<TRow>();
    const { state, columns, classNames, contributions, onRowClick } = grid;
    const numbering = rowNumbering(state.totalRows, state.isTotalExact);
    const extras = extraColumnsOf(grid);

    const attributes = mergeAttributes<HTMLAttributes<HTMLTableRowElement> & Record<string, unknown>>(
        {
            className: classes('gw-row', classNames.row),
            style,
            'data-row-id': String(row.id),
            'aria-rowindex': numbering.indexOf(position),
            onClick: onRowClick ? () => onRowClick(row) : undefined,
        },
        ...attributesOf(contributions.active, 'rowAttributes', (fn) => fn(row, grid)),
    );

    const extraCell = (column: (typeof extras.start)[number]) => (
        <td
            key={column.id}
            {...mergeAttributes<TdHTMLAttributes<HTMLTableCellElement> & Record<string, unknown>>(
                { className: classes('gw-cell', column.className, classNames.cell), 'data-column-id': column.id },
                ...attributesOf(contributions.active, 'extraCellAttributes', (fn) => fn(row, column.id, grid)),
            )}
        >
            {column.cell(row, grid)}
        </td>
    );

    return (
        <tr {...attributes}>
            {extras.start.map(extraCell)}
            {columns
                .filter((column) => !column.hidden)
                .map((column) => (
                    <GridCell key={column.id} column={column} row={row} />
                ))}
            {extras.end.map(extraCell)}
        </tr>
    );
}

/** One body cell: the column's renderer or text, its icon, and the add-ons' cell attributes. */
export function GridCell<TRow>({ column, row }: { column: ResolvedColumn<TRow, ColumnValue>; row: GridRow<TRow> }) {
    const grid = useGridwrightContext<TRow>();
    const { api, classNames, definitions, contributions } = grid;
    const definition = definitions.get(column.id);

    const context = {
        value: column.getValue(row.data) as never,
        row: row.data,
        rowId: row.id,
        rowIndex: row.index,
        column,
        api,
    };
    const content = definition?.cell ? definition.cell(context) : column.getText(row.data);
    // Resolved per row rather than per column, so a folder and a file in the same column can
    // differ, and so a status glyph has somewhere to live that is not inside every cell renderer.
    const icon = definition?.icon?.(context);

    const attributes = mergeAttributes<TdHTMLAttributes<HTMLTableCellElement> & Record<string, unknown>>(
        {
            className: classes('gw-cell', classNames.cell),
            'data-column-id': column.id,
            style: column.align ? { textAlign: column.align } : undefined,
        },
        ...attributesOf(contributions.active, 'cellAttributes', (fn) => fn(row, column, grid)),
    );

    return (
        <td {...attributes}>
            {icon === undefined || icon === null || icon === false ? (
                content
            ) : (
                <span className="gw-cell-content">
                    <span className="gw-icon" aria-hidden="true">
                        {icon}
                    </span>
                    <span className="gw-cell-text">{content}</span>
                </span>
            )}
        </td>
    );
}
