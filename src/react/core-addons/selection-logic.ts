import type { KeyboardEvent, MouseEvent } from 'react';
import type { GridRow } from '../../core/types';
import type { ContributedAttributes, GridContext } from '../addons/types';
import { rowClickSelects, spaceSelectsRow } from '../../view/behaviour/selection';
import { toViewEvent } from '../view/to-view-event';

export { pageSelectionOf } from '../../view/behaviour/selection';

/**
 * What the selection add-on decides, with no renderer: the select-page state, the row and table
 * attributes, and the row click and `Space` that select without a checkbox. The native checkboxes
 * and any other view of them call these, so the ARIA and the guards cannot drift between views.
 */

/**
 * `aria-multiselectable` on the table. Without it a reader has no way to know that more than one
 * row may be selected, and checkboxes alone do not say so: a single-selection grid has them too.
 */
export function selectionTableAttributes<TRow>(grid: GridContext<TRow>): ContributedAttributes<HTMLTableElement> {
    return { 'aria-multiselectable': grid.api.getSelectionMode() === 'multiple' ? true : undefined };
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
                      if (rowClickSelects(toViewEvent(event))) grid.api.toggleRowSelection(row.id);
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
    const row = spaceSelectsRow(toViewEvent(event), grid.state);
    if (row === undefined) return false;
    grid.api.toggleRowSelection(row.id);
    return true;
}
