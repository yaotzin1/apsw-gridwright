import type { ColumnValue, ResolvedColumn } from '../../core/types';
import { classes, useGridwrightContext } from '../context';
import type { GridwrightColumn } from '../types';

export interface GridHeaderProps {
    /** Renders the select-all checkbox column. Default: on when selection is multiple. */
    readonly showSelection?: boolean;
}

/**
 * The header row, with sorting affordances.
 *
 * `aria-sort` is set on the cell rather than the button because that is where assistive technology
 * looks for it, and the control is a real `<button>` so keyboard users reach it by tabbing rather
 * than by guessing that a `<th>` is clickable.
 */
export function GridHeader({ showSelection }: GridHeaderProps) {
    const { api, state, columns, definitions, classNames, labels } = useGridwrightContext();

    const selectionMode = api.getSelectionMode();
    const withSelection = showSelection ?? selectionMode === 'multiple';
    const pageIds = state.rows.map((row) => row.id);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => state.selectedIds.includes(id));
    const someSelected = !allSelected && pageIds.some((id) => state.selectedIds.includes(id));

    return (
        <thead className={classes('gw-thead', classNames.thead)}>
            <tr className={classes('gw-header-row', classNames.headerRow)}>
                {withSelection && (
                    <th className={classes('gw-header-cell', 'gw-cell--select', classNames.headerCell)} scope="col">
                        <input
                            type="checkbox"
                            className="gw-checkbox"
                            aria-label={labels.selectAll}
                            checked={allSelected}
                            ref={(node) => {
                                if (node) node.indeterminate = someSelected;
                            }}
                            onChange={() => api.selectPage()}
                        />
                    </th>
                )}

                {columns
                    .filter((column) => !column.hidden)
                    .map((column) => (
                        <HeaderCell
                            key={column.id}
                            column={column}
                            definition={definitions.get(column.id)}
                        />
                    ))}
            </tr>
        </thead>
    );
}

function HeaderCell<TRow>({
    column,
    definition,
}: {
    column: ResolvedColumn<TRow, ColumnValue>;
    definition: GridwrightColumn<TRow, ColumnValue> | undefined;
}) {
    const { api, classNames, labels } = useGridwrightContext<TRow>();
    const direction = api.getSort(column.id);

    const ariaSort = direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none';
    const nextActionLabel =
        direction === null ? labels.sortAscending : direction === 'asc' ? labels.sortDescending : labels.clearSort;

    const content = definition?.headerCell
        ? definition.headerCell({
              column: column as ResolvedColumn<TRow, ColumnValue>,
              api,
              sortDirection: direction,
          })
        : column.header;

    const style = {
        ...(column.width !== undefined ? { width: column.width } : {}),
        ...(column.minWidth !== undefined ? { minWidth: column.minWidth } : {}),
        ...(column.align ? { textAlign: alignToTextAlign(column.align) } : {}),
    };

    return (
        <th
            scope="col"
            className={classes('gw-header-cell', classNames.headerCell)}
            style={style}
            aria-sort={column.sortable ? ariaSort : undefined}
            data-column-id={column.id}
        >
            {column.sortable ? (
                <button
                    type="button"
                    className="gw-sort-button"
                    onClick={(event) => api.toggleSort(column.id, { additive: event.shiftKey })}
                    title={nextActionLabel}
                >
                    <span className="gw-header-label">{content}</span>
                    <span className="gw-sort-indicator" aria-hidden="true" data-direction={direction ?? 'none'} />
                </button>
            ) : (
                <span className="gw-header-label">{content}</span>
            )}
        </th>
    );
}

const alignToTextAlign = (align: 'start' | 'center' | 'end'): 'start' | 'center' | 'end' => align;
