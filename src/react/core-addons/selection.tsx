import type { KeyboardEvent, MouseEvent } from 'react';
import type { GridRow } from '../../core/types';
import { useAddonMessages } from '../addons/context';
import type { GridAddon, GridContext } from '../addons/types';
import { classes, useGridwrightContext } from '../context';
import { cellControlOf } from '../navigation/cell-control';
import { useCellTabIndex } from '../navigation/context';
import { SELECTION_ADDON, selectionMessages } from './messages';

export interface SelectionOptions {
    /**
     * A checkbox column, with a select-all checkbox in its header. Default: on when the grid's
     * `selectionMode` is `multiple`.
     */
    readonly checkboxes?: boolean;
    /** The "3 selected" count in the toolbar, while a toolbar is shown. Default true. */
    readonly count?: boolean;
    /**
     * The select-page checkbox in the checkbox column's header. Default true. Off, the header holds
     * the column's name for assistive technology and nothing visible: on a remote grid "select all"
     * reads as every row, and it selects one page.
     */
    readonly selectAll?: boolean;
    /**
     * Clicking a row toggles its selection. Clicks on controls inside the row, and clicks that end a
     * text selection, do not. With `cellNavigation()`, `Space` on a focused cell that holds no
     * control toggles its row too, which is the keyboard route when `checkboxes` is off. Default
     * false.
     */
    readonly selectOnRowClick?: boolean;
}

/**
 * What a click inside a row operates instead of selecting the row. A button in a cell is the reader
 * asking for that button, not for the row.
 */
const ROW_CLICK_EXEMPT =
    'button, a, input, select, textarea, label, [role="button"], [role="checkbox"], [role="switch"], [role="link"], [role="menuitem"], [contenteditable]:not([contenteditable="false"])';

/**
 * The view of the engine's selection: checkboxes, `aria-selected` on rows, `aria-multiselectable` on
 * the table, the selected class, and the count.
 *
 * The selection itself stays in the engine, whoever renders it: moving it here would give
 * `GridRow.selected` a second source of truth.
 */
export function selection<TRow>(options: SelectionOptions = {}): GridAddon<TRow> {
    return {
        name: SELECTION_ADDON,
        setup: ({ options: grid }) => {
            const checkboxes = options.checkboxes ?? grid.selectionMode === 'multiple';
            const selectAll = options.selectAll !== false;
            const onRowClick = options.selectOnRowClick === true;
            return {
                messages: selectionMessages,
                ...(checkboxes
                    ? {
                          columns: [
                              {
                                  id: SELECTION_ADDON,
                                  placement: 'start' as const,
                                  className: 'gw-cell--select',
                                  header: () => (selectAll ? <SelectPage /> : <SelectColumnName />),
                                  cell: (row: GridRow<TRow>) => <SelectRow rowId={row.id} selected={row.selected} />,
                              },
                          ],
                      }
                    : {}),
                tableAttributes: (context) => ({
                    // Without it a reader has no way to know that more than one row may be selected,
                    // and checkboxes alone do not say so: a single-selection grid has them too.
                    'aria-multiselectable': context.api.getSelectionMode() === 'multiple' ? true : undefined,
                }),
                rowAttributes: (row, context) =>
                    context.api.getSelectionMode() === 'none'
                        ? {}
                        : {
                              'aria-selected': row.selected,
                              className: classes(
                                  row.selected ? classes('gw-row--selected', context.classNames.rowSelected) : undefined,
                                  onRowClick ? 'gw-row--selectable' : undefined,
                              ),
                              ...(onRowClick
                                  ? {
                                        onClick: (event: MouseEvent<HTMLTableRowElement>) => {
                                            if (isRowSelectingClick(event)) context.api.toggleRowSelection(row.id);
                                        },
                                    }
                                  : {}),
                          },
                ...(onRowClick ? { tableKeyDown: toggleFocusedRow } : {}),
                ...(options.count === false
                    ? {}
                    : { toolbarStatus: (context) => (context.state.selectedIds.length > 0 ? <SelectedCount /> : null) }),
            };
        },
    };
}

/** A click on the row itself, not on something in it, and not the end of a text selection. */
function isRowSelectingClick(event: MouseEvent<HTMLTableRowElement>): boolean {
    const target = event.target instanceof Element ? event.target : null;
    if (target === null) return false;
    const exempt = target.closest(ROW_CLICK_EXEMPT);
    if (exempt !== null && event.currentTarget.contains(exempt)) return false;
    // A grid nested in a detail row selects its own rows.
    if (target.closest('tr') !== event.currentTarget) return false;
    // Dragging across a value to copy it ends in a click; that reader wanted the text, not the row.
    const selection = event.currentTarget.ownerDocument.getSelection();
    return !(selection && !selection.isCollapsed && selection.anchorNode !== null && event.currentTarget.contains(selection.anchorNode));
}

/**
 * `Space` on the focused body cell, which only `cellNavigation()` gives the grid.
 *
 * A cell holding a control is left alone: `cellNavigation()` runs after the core add-ons and
 * operates that control, so `Space` on the checkbox cell ticks the checkbox exactly once.
 */
function toggleFocusedRow<TRow>(event: KeyboardEvent<HTMLTableElement>, grid: GridContext<TRow>): boolean {
    if (event.key !== ' ' || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return false;
    const cell = event.target instanceof HTMLTableCellElement ? event.target : null;
    if (cell === null || cell.tagName !== 'TD' || cell.closest('table') !== event.currentTarget) return false;
    if (cellControlOf(cell) !== null) return false;
    const rowId = cell.closest('tr')?.getAttribute('data-row-id');
    const row = grid.state.rows.find((candidate) => String(candidate.id) === rowId);
    if (row === undefined) return false;
    grid.api.toggleRowSelection(row.id);
    return true;
}

function SelectColumnName() {
    const t = useAddonMessages(SELECTION_ADDON, selectionMessages);
    return <span className="gw-visually-hidden">{t('selectColumn')}</span>;
}

function SelectPage() {
    const { api, state } = useGridwrightContext();
    const t = useAddonMessages(SELECTION_ADDON, selectionMessages);
    const pageIds = state.rows.map((row) => row.id);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => state.selectedIds.includes(id));
    const someSelected = !allSelected && pageIds.some((id) => state.selectedIds.includes(id));

    return (
        <input
            type="checkbox"
            className="gw-checkbox"
            aria-label={t('all')}
            checked={allSelected}
            ref={(node) => {
                if (node) node.indeterminate = someSelected;
            }}
            onChange={() => api.selectPage()}
        />
    );
}

function SelectRow({ rowId, selected }: { rowId: GridRow<unknown>['id']; selected: boolean }) {
    const { api } = useGridwrightContext();
    const t = useAddonMessages(SELECTION_ADDON, selectionMessages);
    const tabIndex = useCellTabIndex(SELECTION_ADDON);
    return (
        <input
            type="checkbox"
            className="gw-checkbox"
            tabIndex={tabIndex}
            aria-label={t('row')}
            checked={selected}
            onChange={() => api.toggleRowSelection(rowId)}
            // Without this a click on the checkbox also fires the row handler, so selecting a row
            // navigates away from the grid you are selecting in.
            onClick={(event) => event.stopPropagation()}
        />
    );
}

function SelectedCount() {
    const { state } = useGridwrightContext();
    const t = useAddonMessages(SELECTION_ADDON, selectionMessages);
    return <span className="gw-selected-count">{t('count', { count: state.selectedIds.length })}</span>;
}
