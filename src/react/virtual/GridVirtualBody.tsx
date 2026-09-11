import { useEffect, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import { WINDOW_OFFSET_META } from '../../data/windowed';
import { rowNumbering } from '../a11y/rows';
import type { GridRow } from '../../core/types';
import { classes, useGridwrightContext } from '../context';
import { GridCell } from '../parts/GridBody';
import { useVirtualRows } from './useVirtualRows';

export interface GridVirtualBodyProps<TRow> {
    /** The scroll container. Usually the ref you gave `<GridTable scrollRef>`. */
    readonly containerRef: RefObject<HTMLElement | null>;
    /** Must match `--gw-row-height`, or the rows drift away from the scrollbar. Default 40. */
    readonly rowHeight?: number;
    readonly overscan?: number;
    readonly showSelection?: boolean;
    readonly onRowClick?: (row: GridRow<TRow>) => void;
    /** Rendered for a row inside the viewport whose data has not arrived. */
    readonly renderSkeleton?: (absoluteIndex: number) => ReactNode;
}

/**
 * A body that renders only the rows on screen.
 *
 * Two spacer rows carry the height of everything above and below, so the element stays a real
 * `<table>` with real `<tr>` children. Absolutely positioning rows would be simpler to write and
 * would throw away column alignment and the grid semantics a screen reader depends on.
 *
 * `aria-rowindex` carries the true position, because the row a screen reader is on is row four
 * million, not row four of what happens to be mounted. It is header-inclusive, like every other
 * row index in the grid, so it agrees with the `aria-rowcount` on the table above it.
 */
export function GridVirtualBody<TRow>({
    containerRef,
    rowHeight = 40,
    overscan,
    showSelection,
    onRowClick,
    renderSkeleton,
}: GridVirtualBodyProps<TRow>) {
    const { api, state, columns, definitions, classNames, labels } = useGridwrightContext<TRow>();

    const selectionMode = api.getSelectionMode();
    const withSelection = showSelection ?? selectionMode === 'multiple';
    const visible = columns.filter((column) => !column.hidden);
    const columnCount = visible.length + (withSelection ? 1 : 0);

    const virtual = useVirtualRows({
        count: state.totalRows,
        rowHeight,
        ...(overscan !== undefined ? { overscan } : {}),
        containerRef,
    });

    const numbering = rowNumbering(state.totalRows, state.isTotalExact);

    const { pageIndex, pageSize } = state.query.pagination;

    // Where the rows the grid is holding start.
    //
    // A windowed source publishes it, which is the reliable answer: while a new window loads, the
    // previous rows are still on screen and the query has already moved on, so the query alone
    // would place them at positions they do not occupy. Any other paginating source publishes
    // nothing, and then the query is all there is, so the rows are only addressable once they have
    // settled. Until then the window is skeletons, which is honest: those rows are on their way.
    const published = state.meta[WINDOW_OFFSET_META];
    const hasPublishedOffset = typeof published === 'number';
    const windowOffset = hasPublishedOffset ? published : pageIndex * pageSize;
    const addressable =
        hasPublishedOffset || state.status === 'ready' || state.status === 'error' || state.status === 'idle';

    // Move the data window to follow the scroll. Guarded on the page actually changing, or this
    // is a render loop: setting the page publishes state, which renders, which sets the page.
    const requested = useRef<number | null>(null);
    useEffect(() => {
        if (state.totalRows === 0 || pageSize <= 0) return;

        const wantedPage = Math.floor(virtual.firstVisibleIndex / pageSize);
        if (wantedPage === pageIndex || wantedPage === requested.current) return;

        requested.current = wantedPage;
        api.setPage(wantedPage);
    }, [api, virtual.firstVisibleIndex, pageSize, pageIndex, state.totalRows]);

    useEffect(() => {
        requested.current = null;
    }, [state.version]);

    if (state.status === 'error' && state.rows.length === 0) {
        return (
            <tbody className={classes('gw-tbody', classNames.tbody)}>
                <tr className="gw-status-row">
                    <td colSpan={columnCount} className={classes('gw-status', classNames.status)}>
                        <div className="gw-error" role="alert">
                            <p className="gw-error-title">{labels.errorTitle}</p>
                            <p className="gw-error-message">{state.error?.message}</p>
                        </div>
                    </td>
                </tr>
            </tbody>
        );
    }

    if (state.totalRows === 0) {
        return (
            <tbody className={classes('gw-tbody', classNames.tbody)}>
                <tr className="gw-status-row">
                    <td colSpan={columnCount} className={classes('gw-status', classNames.status)}>
                        {state.status === 'loading' ? labels.loading : labels.empty}
                    </td>
                </tr>
            </tbody>
        );
    }

    const rendered: ReactNode[] = [];
    for (let absolute = virtual.startIndex; absolute < virtual.endIndex; absolute += 1) {
        const row = addressable ? state.rows[absolute - windowOffset] : undefined;

        if (!row) {
            rendered.push(
                <tr
                    key={`skeleton-${absolute}`}
                    className="gw-row gw-row--skeleton"
                    style={{ height: rowHeight }}
                    aria-rowindex={numbering.indexOf(absolute)}
                    aria-busy="true"
                >
                    <td className={classes('gw-cell', classNames.cell)} colSpan={columnCount}>
                        {renderSkeleton ? renderSkeleton(absolute) : <span className="gw-skeleton" />}
                    </td>
                </tr>,
            );
            continue;
        }

        rendered.push(
            <tr
                key={String(row.id)}
                className={classes(
                    'gw-row',
                    classNames.row,
                    row.selected && 'gw-row--selected',
                    row.selected && classNames.rowSelected,
                )}
                style={{ height: rowHeight }}
                data-row-id={String(row.id)}
                aria-rowindex={numbering.indexOf(absolute)}
                aria-selected={selectionMode === 'none' ? undefined : row.selected}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
                {withSelection && (
                    <td className={classes('gw-cell', 'gw-cell--select', classNames.cell)}>
                        <input
                            type="checkbox"
                            className="gw-checkbox"
                            aria-label={labels.selectRow}
                            checked={row.selected}
                            onChange={() => api.toggleRowSelection(row.id)}
                            onClick={(event) => event.stopPropagation()}
                        />
                    </td>
                )}

                {visible.map((column) => (
                    <GridCell key={column.id} column={column} row={row} definition={definitions.get(column.id)} />
                ))}
            </tr>,
        );
    }

    return (
        <tbody className={classes('gw-tbody', classNames.tbody)} aria-busy={state.status === 'refreshing'}>
            {virtual.paddingTop > 0 && (
                <tr aria-hidden="true" className="gw-spacer">
                    <td colSpan={columnCount} style={{ height: virtual.paddingTop, padding: 0, border: 0 }} />
                </tr>
            )}

            {rendered}

            {virtual.paddingBottom > 0 && (
                <tr aria-hidden="true" className="gw-spacer">
                    <td colSpan={columnCount} style={{ height: virtual.paddingBottom, padding: 0, border: 0 }} />
                </tr>
            )}
        </tbody>
    );
}
