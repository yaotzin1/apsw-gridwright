import type { GridState } from '../../core/types';

/**
 * What the selection add-on decides without looking at an element: the select-page state. The native
 * checkbox and any other view of it call this, so "all" and "some" mean the same in every view.
 */

/** Whether the page is wholly selected, or partly: the select-page checkbox's checked and indeterminate. */
export function pageSelectionOf(state: Pick<GridState<unknown>, 'rows' | 'selectedIds'>): { readonly all: boolean; readonly some: boolean } {
    const selected = new Set(state.selectedIds);
    const pageIds = state.rows.map((row) => row.id);
    const all = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
    return { all, some: !all && pageIds.some((id) => selected.has(id)) };
}
