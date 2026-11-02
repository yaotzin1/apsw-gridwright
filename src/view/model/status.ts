import type { GridState } from '../../core/types';

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
