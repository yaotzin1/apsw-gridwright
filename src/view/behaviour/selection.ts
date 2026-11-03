import type { GridRow, GridState } from '../../core/types';
import type { ViewEvent } from '../event';

/**
 * What the selection add-on decides without looking at an element: the select-page state, which
 * clicks select a row, and which key press does. The native checkbox, the React add-on and any other
 * view of them call these, so "all", "some" and "the reader clicked the row, not something in it" mean
 * the same in every view.
 */

/** Whether the page is wholly selected, or partly: the select-page checkbox's checked and indeterminate. */
export function pageSelectionOf(state: Pick<GridState<unknown>, 'rows' | 'selectedIds'>): { readonly all: boolean; readonly some: boolean } {
    const selected = new Set(state.selectedIds);
    const pageIds = state.rows.map((row) => row.id);
    const all = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
    return { all, some: !all && pageIds.some((id) => selected.has(id)) };
}

/**
 * Whether a click on a row selects it: a click on the row itself, not on a control in it, not on a
 * row of a grid nested in it, and not the end of a text selection (the reader dragged across a value
 * to copy it). Without an `origin` nothing is known about the click, so it selects nothing.
 */
export function rowClickSelects(event: ViewEvent): boolean {
    const origin = event.origin;
    if (origin === undefined) return false;
    return !origin.fromControl && !origin.fromNestedGrid && !origin.textSelected;
}

/**
 * The row `Space` selects, or undefined: a plain `Space` pressed on a body cell that holds no
 * control. A cell with a control is left to that control, which cell navigation operates, so `Space`
 * on a checkbox cell ticks the checkbox exactly once.
 */
export function spaceSelectsRow<TRow>(event: ViewEvent, state: Pick<GridState<TRow>, 'rows'>): GridRow<TRow> | undefined {
    if (event.key !== ' ' || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return undefined;
    const cell = event.origin?.cell;
    if (cell === undefined || !cell.targetIsCell || cell.holdsControl) return undefined;
    return state.rows.find((candidate) => String(candidate.id) === cell.rowId);
}
