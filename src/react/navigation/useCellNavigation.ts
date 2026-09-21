import { useCallback, useEffect, useRef, useState } from 'react';
import type { RowId } from '../../core/types';
import type { GridContext } from '../addons/types';
import { extraColumnsOf } from '../parts/slots';
import type { ActiveCell, CellNavigationOptions } from './types';

/** Where one axis wants to go, before it is clamped to what exists. `null` leaves it alone. */
export type AxisMove = { readonly by: number } | { readonly to: 'first' | 'last' } | null;

/**
 * Where a key wants to go.
 *
 * Both axes in one value rather than two calls, because `Ctrl+End` moves both and two calls would
 * each read the cursor from before the other -- the second would undo the first.
 */
export interface Move {
    readonly row?: AxisMove;
    readonly column?: AxisMove;
}

const clamp = (value: number, max: number): number => Math.min(Math.max(value, 0), max);

const sameCell = (a: ActiveCell | null, b: ActiveCell | null): boolean =>
    a === b || (a !== null && b !== null && a.rowId === b.rowId && a.columnId === b.columnId);

/**
 * The ids a cursor may visit in a row, in painting order.
 *
 * Extra columns sit on the edges they declared, which is where the body paints them, so arrowing
 * left from the first data column reaches the selection checkbox rather than skipping past it.
 */
export function visitableColumns<TRow>(grid: GridContext<TRow>, includeExtras: boolean): readonly string[] {
    const data = grid.columns.filter((column) => !column.hidden).map((column) => column.id);
    if (!includeExtras) return data;
    const extras = extraColumnsOf(grid);
    return [...extras.start.map((column) => column.id), ...data, ...extras.end.map((column) => column.id)];
}

/**
 * The cursor, clamped to a cell that exists right now.
 *
 * Resolved at render from the grid the slot was handed rather than stored, because a sort, a filter
 * or a new page can take the row away between one render and the next. Falling back to the first
 * cell is what keeps the grid at exactly one Tab stop: a grid whose only tabbable cell has just been
 * filtered away is a grid the keyboard cannot enter.
 */
export function resolveCursor(
    stored: ActiveCell | null,
    rowIds: readonly RowId[],
    columnIds: readonly string[],
): ActiveCell | null {
    const firstRow = rowIds[0];
    const firstColumn = columnIds[0];
    if (firstRow === undefined || firstColumn === undefined) return null;
    if (stored === null) return { rowId: firstRow, columnId: firstColumn };
    // One axis surviving keeps its position: hiding a column should not also lose the row.
    return {
        rowId: rowIds.includes(stored.rowId) ? stored.rowId : firstRow,
        columnId: columnIds.includes(stored.columnId) ? stored.columnId : firstColumn,
    };
}

/** Applies a move to a resolved cursor. Returns the destination, or null when nothing moves. */
export function nextCell(
    from: ActiveCell,
    move: Move,
    rowIds: readonly RowId[],
    columnIds: readonly string[],
): ActiveCell | null {
    const rowIndex = rowIds.indexOf(from.rowId);
    const columnIndex = columnIds.indexOf(from.columnId);
    if (rowIndex === -1 || columnIndex === -1) return null;

    const resolve = (axis: AxisMove, current: number, count: number): number => {
        if (!axis) return current;
        return 'by' in axis ? current + axis.by : axis.to === 'first' ? 0 : count - 1;
    };

    const rowId = rowIds[clamp(resolve(move.row ?? null, rowIndex, rowIds.length), rowIds.length - 1)];
    const columnId = columnIds[clamp(resolve(move.column ?? null, columnIndex, columnIds.length), columnIds.length - 1)];
    if (rowId === undefined || columnId === undefined) return null;
    const next = { rowId, columnId };
    return sameCell(next, from) ? null : next;
}

/** The attribute a cell carries so the cursor can find its node after a render. */
export const cellKey = (rowId: RowId, columnId: string): string => `${String(rowId)}::${columnId}`;

/**
 * The cursor's state, and the focus it asks for.
 *
 * Deliberately knows nothing about the grid: `setup` runs inside `useGridwright`, before the context
 * provider exists, so the rows and columns arrive with each slot call instead. Everything that needs
 * them is a pure function above.
 */
export function useCursorState(options: CellNavigationOptions) {
    const [stored, setStored] = useState<ActiveCell | null>(options.initialCell ?? null);

    /**
     * The cursor as of the last *move*, not the last render.
     *
     * Key repeat delivers several keydowns before React re-renders, and a handler that read state
     * would compute every one of them from the same starting cell: holding `ArrowDown` would move
     * one row instead of ten. This advances synchronously inside `moveTo`, so each keypress starts
     * where the previous one left off.
     *
     * Deliberately never written from `stored` during render: that would hand a render happening
     * between two keypresses the chance to roll the cursor back to where the last one started. Only
     * `moveTo` writes it, and an id that has since been filtered away is clamped by `resolveCursor`
     * exactly as a stored one is.
     */
    const cursorRef = useRef<ActiveCell | null>(stored);

    // The cell the browser should be focused on once it has rendered. Separate from `stored` because
    // a windowed row has to be scrolled into existence first, and focus cannot precede the node.
    // Cleared once taken, so an unrelated re-render does not steal focus back.
    const pending = useRef<ActiveCell | null>(null);
    const table = useRef<HTMLElement | null>(null);

    const moveTo = useCallback((cell: ActiveCell): void => {
        cursorRef.current = cell;
        setStored(cell);
        pending.current = cell;
    }, []);

    /** Focuses the cell the cursor asked for, once it is in the document. */
    useEffect(() => {
        const wanted = pending.current;
        const root = table.current;
        if (wanted === null || root === null) return;
        const selector = `[data-gw-cell="${CSS.escape(cellKey(wanted.rowId, wanted.columnId))}"]`;
        const cell = root.querySelector<HTMLElement>(selector);
        // Not found means the row is outside a windowed viewport and the scroll has not landed yet.
        // `pending` stays set so the next render tries again rather than losing the move.
        if (cell === null) return;
        pending.current = null;
        cell.focus();
    });

    // Not on mount: the first position is a default this add-on chose, not a move the reader made,
    // and a handler that persists it would overwrite a restored cursor on every first paint.
    const onChange = useRef(options.onActiveCellChange);
    onChange.current = options.onActiveCellChange;
    const previous = useRef<ActiveCell | null>(stored);
    const notified = useRef(false);
    useEffect(() => {
        if (!notified.current) {
            notified.current = true;
            previous.current = stored;
            return;
        }
        if (sameCell(previous.current, stored)) return;
        previous.current = stored;
        onChange.current?.(stored);
    }, [stored]);

    return { stored, cursorRef, moveTo, table };
}
