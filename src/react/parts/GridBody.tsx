import type { ReactNode } from 'react';
import type { ColumnValue, GridError, GridRow, ResolvedColumn } from '../../core/types';
import { rowNumbering } from '../a11y/rows';
import { treeRowAria } from '../a11y/tree';
import type { TreeRowAria } from '../a11y/tree';
import { classes, useGridwrightContext } from '../context';
import { useOptionalTreeContext } from '../tree/context';
import type { TreeContextValue } from '../tree/context';
import { isTreeNode } from '../tree/rowData';
import type { GridwrightColumn } from '../types';

export interface GridBodyProps<TRow> {
    readonly showSelection?: boolean;
    readonly onRowClick?: (row: GridRow<TRow>) => void;
    readonly renderEmpty?: () => ReactNode;
    readonly renderLoading?: () => ReactNode;
    readonly renderError?: (error: GridError, retry: () => void) => ReactNode;
}

/**
 * The row body, including the three states a grid spends much of its life in.
 *
 * Empty, loading and error are rendered inside the table rather than replacing it, so the header
 * and the column widths stay put. A table that collapses to a centred spinner and then springs
 * back to full height on every page change is the most common way a grid feels broken while
 * working correctly.
 */
export function GridBody<TRow>({
    showSelection,
    onRowClick,
    renderEmpty,
    renderLoading,
    renderError,
}: GridBodyProps<TRow>) {
    const { api, state, columns, definitions, classNames, labels } = useGridwrightContext<TRow>();
    const tree = useOptionalTreeContext();

    const selectionMode = api.getSelectionMode();
    const withSelection = showSelection ?? selectionMode === 'multiple';
    const visible = columns.filter((column) => !column.hidden);
    const columnCount = visible.length + (withSelection ? 1 : 0);

    const numbering = rowNumbering(state.totalRows, state.isTotalExact);
    // Where this page starts in the whole result set. A row's ARIA index is its position across
    // every page, not its position in the twenty-five currently mounted, or a reader on page two
    // is told they are on row one.
    const { pageIndex, pageSize } = state.query.pagination;
    const pageOffset = pageIndex * pageSize;

    const isInitialLoad = state.status === 'loading' && state.rows.length === 0;
    const isEmpty = state.rows.length === 0 && (state.status === 'ready' || state.status === 'refreshing');

    if (state.status === 'error' && state.rows.length === 0) {
        return (
            <tbody className={classes('gw-tbody', classNames.tbody)}>
                <tr className="gw-status-row">
                    <td colSpan={columnCount} className={classes('gw-status', classNames.status)}>
                        {renderError ? (
                            renderError(state.error!, () => void api.refresh())
                        ) : (
                            <div className="gw-error" role="alert">
                                <p className="gw-error-title">{labels.errorTitle}</p>
                                <p className="gw-error-message">{state.error?.message}</p>
                                {state.error?.retryable && (
                                    <button type="button" className="gw-button" onClick={() => void api.refresh()}>
                                        {labels.retry}
                                    </button>
                                )}
                            </div>
                        )}
                    </td>
                </tr>
            </tbody>
        );
    }

    if (isInitialLoad) {
        return (
            <tbody className={classes('gw-tbody', classNames.tbody)}>
                <tr className="gw-status-row">
                    <td colSpan={columnCount} className={classes('gw-status', classNames.status)}>
                        {renderLoading ? renderLoading() : <span className="gw-loading">{labels.loading}</span>}
                    </td>
                </tr>
            </tbody>
        );
    }

    if (isEmpty) {
        return (
            <tbody className={classes('gw-tbody', classNames.tbody)}>
                <tr className="gw-status-row">
                    <td colSpan={columnCount} className={classes('gw-status', classNames.status)}>
                        {renderEmpty ? renderEmpty() : <span className="gw-empty">{labels.empty}</span>}
                    </td>
                </tr>
            </tbody>
        );
    }

    return (
        <tbody className={classes('gw-tbody', classNames.tbody)} aria-busy={state.status === 'refreshing'}>
            {state.rows.map((row, offset) => (
                <tr
                    key={String(row.id)}
                    className={classes(
                        'gw-row',
                        classNames.row,
                        row.selected && 'gw-row--selected',
                        row.selected && classNames.rowSelected,
                    )}
                    data-row-id={String(row.id)}
                    aria-rowindex={numbering.indexOf(pageOffset + offset)}
                    aria-selected={selectionMode === 'none' ? undefined : row.selected}
                    {...hierarchyOf(tree, row.data)}
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
                                // Without this a click on the checkbox also fires the row handler,
                                // so selecting a row navigates away from the grid you are selecting in.
                                onClick={(event) => event.stopPropagation()}
                            />
                        </td>
                    )}

                    {visible.map((column) => (
                        <GridCell
                            key={column.id}
                            column={column}
                            row={row}
                            definition={definitions.get(column.id)}
                        />
                    ))}
                </tr>
            ))}
        </tbody>
    );
}

/**
 * One body cell.
 *
 * Exported because the virtual body renders the same cells; two implementations would drift, and
 * the one that drifts is the one fewer people look at.
 */
export function GridCell<TRow>({
    column,
    row,
    definition,
}: {
    column: ResolvedColumn<TRow, ColumnValue>;
    row: GridRow<TRow>;
    definition: GridwrightColumn<TRow, ColumnValue> | undefined;
}) {
    const { api, classNames } = useGridwrightContext<TRow>();

    const value = column.getValue(row.data);
    const content = definition?.cell
        ? definition.cell({
              value: value as never,
              row: row.data,
              rowId: row.id,
              rowIndex: row.index,
              column: column as ResolvedColumn<TRow, ColumnValue>,
              api,
          })
        : column.getText(row.data);

    // Resolved per row rather than per column, so a folder and a file in the same column can
    // differ, and so a status glyph has somewhere to live that is not inside every cell renderer.
    const icon = definition?.icon?.({
        value: value as never,
        row: row.data,
        rowId: row.id,
        rowIndex: row.index,
        column: column as ResolvedColumn<TRow, ColumnValue>,
        api,
    });

    return (
        <td
            className={classes('gw-cell', classNames.cell)}
            data-column-id={column.id}
            style={column.align ? { textAlign: column.align } : undefined}
        >
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

/**
 * The hierarchy attributes for a row, when the grid is a tree.
 *
 * Type-erased because a tree grid renders `GridRow<TreeNode<TRow>>` while the component is still
 * generic over the consumer's `TRow`, and the controller is invariant in it. The runtime check is
 * the same one `rowDataOf` makes, for the same reason: `tree` is a switch on the component, so a
 * part has to work both ways.
 */
function hierarchyOf(tree: TreeContextValue<unknown> | null, data: unknown): TreeRowAria | undefined {
    if (!tree) return undefined;
    return isTreeNode<unknown>(data) ? treeRowAria(tree.controller, data) : undefined;
}