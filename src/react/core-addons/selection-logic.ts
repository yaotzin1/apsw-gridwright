import type { KeyboardEvent, MouseEvent } from 'react';
import type { GridRow, GridState } from '../../core/types';
import type { ContributedAttributes, GridContext } from '../addons/types';
import { cellControlOf } from '../navigation/cell-control';

/**
 * What the selection add-on decides, with no renderer: the select-page state, the row and table
 * attributes, and the row click and `Space` that select without a checkbox. The native checkboxes
 * and any other view of them call these, so the ARIA and the guards cannot drift between views.
 */

/** Whether the page is wholly selected, or partly: the select-page checkbox's checked and indeterminate. */
export function pageSelectionOf(state: Pick<GridState<unknown>, 'rows' | 'selectedIds'>): { readonly all: boolean; readonly some: boolean } {
    const selected = new Set(state.selectedIds);
    const pageIds = state.rows.map((row) => row.id);
    const all = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
    return { all, some: !all && pageIds.some((id) => selected.has(id)) };
}

/**
 * `aria-multiselectable` on the table. Without it a reader has no way to know that more than one
 * row may be selected, and checkboxes alone do not say so: a single-selection grid has them too.
 */
export function selectionTableAttributes<TRow>(grid: GridContext<TRow>): ContributedAttributes<HTMLTableElement> {
    return { 'aria-multiselectable': grid.api.getSelectionMode() === 'multiple' ? true : undefined };
}

/**
 * What a click inside a row operates instead of selecting the row. A button in a cell is the reader
 * asking for that button, not for the row.
 */
const ROW_CLICK_EXEMPT =
    'button, a, input, select, textarea, label, [role="button"], [role="checkbox"], [role="switch"], [role="link"], [role="menuitem"], [contenteditable]:not([contenteditable="false"])';

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
 * `aria-selected`, the selected class and, with `selectOnRowClick`, the class and click that make
 * the row itself the control. Nothing at all when the grid's selection mode is `none`, so a grid
 * without selection does not claim every row is unselected.
 */
export function selectionRowAttributes<TRow>(
    row: GridRow<TRow>,
    grid: GridContext<TRow>,
    options: { readonly selectOnRowClick?: boolean } = {},
): ContributedAttributes<HTMLTableRowElement> {
    if (grid.api.getSelectionMode() === 'none') return {};
    const onRowClick = options.selectOnRowClick === true;
    return {
        'aria-selected': row.selected,
        className:
            [row.selected ? 'gw-row--selected' : '', row.selected ? (grid.classNames.rowSelected ?? '') : '', onRowClick ? 'gw-row--selectable' : '']
                .filter(Boolean)
                .join(' ') || undefined,
        ...(onRowClick
            ? {
                  onClick: (event: MouseEvent<HTMLTableRowElement>) => {
                      if (isRowSelectingClick(event)) grid.api.toggleRowSelection(row.id);
                  },
              }
            : {}),
    };
}

/**
 * `Space` on the focused body cell, which only `cellNavigation()` gives the grid. True when handled.
 *
 * A cell holding a control is left alone: `cellNavigation()` runs after the core add-ons and
 * operates that control, so `Space` on the checkbox cell ticks the checkbox exactly once.
 */
export function selectionKeyDown<TRow>(event: KeyboardEvent<HTMLTableElement>, grid: GridContext<TRow>): boolean {
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
