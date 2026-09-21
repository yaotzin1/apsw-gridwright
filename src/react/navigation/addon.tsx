import { useCallback, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import type { RowId } from '../../core/types';
import type { GridAddon, GridContext } from '../addons/types';
import { useOptionalTreeContext } from '../tree/context';
import type { TreeContextValue } from '../tree/context';
import { useVirtualScroll } from '../virtual';
import type { VirtualScroll } from '../virtual';
import { CellNavigationProvider } from './context';
import { CELL_NAVIGATION_ADDON } from './messages';
import type { ActiveCell, CellNavigationController, CellNavigationOptions } from './types';
import { cellKey, nextCell, resolveCursor, useCursorState, visitableColumns } from './useCellNavigation';
import type { Move } from './useCellNavigation';

/**
 * Whether the key belongs to whatever the reader is typing in rather than to the grid.
 *
 * An inline editor's `<input>`, a `<select>` in a cell renderer, anything `contenteditable`: arrow
 * keys move a caret or change a value there, and stealing them would make the editor unusable. The
 * cell itself is not interactive, so a cursor sitting on a plain `<td>` is unaffected.
 */
function insideInteractive(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    return target.closest('input, textarea, select, [contenteditable="true"]') !== null;
}

/**
 * 2D cell navigation: one Tab stop into the grid, then the arrow keys.
 *
 * A standard table makes a keyboard user press Tab once per interactive element, which in a grid of
 * 100 rows and 10 columns is hundreds of presses to cross the data. The WAI-ARIA grid pattern
 * answers that with a roving `tabIndex`: exactly one cell is tabbable, the arrows move which one,
 * and the browser announces the focused cell's header, position and text from the markup that is
 * already there -- which is why this is a real focus rather than `aria-activedescendant`.
 *
 * **Movement stays inside what the grid is holding.** No key fetches a page. A paginating source
 * that sends no total leaves `isTotalExact` false, and the grid then knows only that another page
 * exists -- so `Ctrl+End` has no last row to reach. Inventing one, or fetching until the source runs
 * out, are both things this package refuses elsewhere for the same reason.
 */
export function cellNavigation<TRow>(options: CellNavigationOptions = {}): GridAddon<TRow> {
    return {
        name: CELL_NAVIGATION_ADDON,
        setup: function useCellNavigationAddon() {
            const { stored, cursorRef, moveTo, table } = useCursorState(options);
            const includeExtras = options.includeExtraColumns !== false;

            // The grid as of the last render. `setup` runs inside `useGridwright`, before the
            // context provider exists, so the rows and columns arrive through the slots instead;
            // `provide` runs once per render of the grid and is where this is filled in.
            const gridRef = useRef<GridContext<TRow> | null>(null);

            const idsOf = useCallback(
                (grid: GridContext<TRow>) => ({
                    rowIds: grid.state.rows.map((row) => row.id),
                    columnIds: visitableColumns(grid, includeExtras),
                }),
                [includeExtras],
            );

            const cursorOf = useCallback(
                (grid: GridContext<TRow>): ActiveCell | null => {
                    const { rowIds, columnIds } = idsOf(grid);
                    return resolveCursor(stored, rowIds, columnIds);
                },
                [stored, idsOf],
            );

            // Windowed scrolling, when `virtualRows()` is listed. Same bridge as the tree below and
            // for the same reason: `setup` runs before any provider exists.
            const scrollRef = useRef<VirtualScroll | null>(null);

            /**
             * Pulls a row into the mounted window so there is a cell to focus.
             *
             * Under `virtualRows()` only the visible slice is in the DOM, so a cursor moved past the
             * edge names a cell that does not exist yet. Scrolling here and leaving `pending` set
             * lets the focus effect pick the cell up on the render after the scroll lands.
             */
            const revealRow = useCallback((grid: GridContext<TRow>, rowId: RowId): void => {
                const scroll = scrollRef.current;
                if (!scroll) return;
                const index = grid.state.rows.findIndex((row) => row.id === rowId);
                if (index >= 0) scroll.scrollToIndex(index);
            }, []);

            /**
             * Moves the cursor from where the **last keypress** left it, not from the last render.
             *
             * Key repeat delivers several keydowns before React re-renders. Reading the rendered
             * cursor would compute every one of them from the same cell, so holding `ArrowDown`
             * would move one row and then stop.
             */
            const apply = useCallback(
                (grid: GridContext<TRow>, move: Move): boolean => {
                    const { rowIds, columnIds } = idsOf(grid);
                    const from = resolveCursor(cursorRef.current, rowIds, columnIds);
                    if (from === null) return false;
                    const next = nextCell(from, move, rowIds, columnIds);
                    if (next === null) return false;
                    moveTo(next);
                    if (next.rowId !== from.rowId) revealRow(grid, next.rowId);
                    return true;
                },
                [idsOf, moveTo, cursorRef, revealRow],
            );

            // The tree, when one is listed. `setup` cannot call `useOptionalTreeContext()` -- it runs
            // before any provider exists -- so a component rendered into a slot reads it instead and
            // leaves it here. Slot-rendered components sit inside every add-on's provider.
            const treeRef = useRef<TreeContextValue<TRow> | null>(null);

            /**
             * Expands or collapses when the cursor is on a tree node, as the treegrid pattern says.
             *
             * Returns false when the key did not apply -- no tree, a leaf, or a node already in the
             * state the key would put it in -- so the caller falls through to moving the cursor
             * rather than swallowing the key.
             */
            const treeKey = useCallback((rowId: RowId, expand: boolean): boolean => {
                const tree = treeRef.current;
                if (!tree) return false;
                const nodeId = String(rowId);
                if (tree.controller.isExpanded(nodeId) === expand) return false;
                if (expand) tree.controller.expand(nodeId);
                else tree.controller.collapse(nodeId);
                return true;
            }, []);

            const onKeyDown = useCallback(
                (event: KeyboardEvent<HTMLTableElement>, grid: GridContext<TRow>): boolean => {
                    table.current = event.currentTarget;
                    gridRef.current = grid;

                    const { rowIds, columnIds } = idsOf(grid);
                    const cursor = resolveCursor(cursorRef.current, rowIds, columnIds);
                    if (cursor === null) return false;
                    // AC-08: the editor keeps its own keys. Escape back out to the cell belongs to
                    // whatever owns the editor, not here.
                    if (insideInteractive(event.target)) return false;

                    // Reading direction, so "right" is the next column in an Arabic or Hebrew page.
                    const rtl = event.currentTarget.closest('[dir="rtl"]') !== null;
                    const forward = rtl ? -1 : 1;
                    const pageRows = Math.max(1, grid.state.query.pagination.pageSize);
                    const jump = event.ctrlKey || event.metaKey;

                    switch (event.key) {
                        case 'ArrowDown':
                            return apply(grid, { row: { by: 1 } });
                        case 'ArrowUp':
                            return apply(grid, { row: { by: -1 } });
                        case 'ArrowRight':
                            if (treeKey(cursor.rowId, !rtl)) return true;
                            return apply(grid, { column: { by: forward } });
                        case 'ArrowLeft':
                            if (treeKey(cursor.rowId, rtl)) return true;
                            return apply(grid, { column: { by: -forward } });
                        case 'Home':
                            // Both axes in one move: two calls would each read the cursor from
                            // before the other, and the second would undo the first.
                            if (jump) {
                                // Page one, but only when the grid knows where it is. Without an
                                // exact total the first loaded row is as far back as it can honestly
                                // go, and the move below has already gone there.
                                if (grid.state.isTotalExact && grid.state.query.pagination.pageIndex > 0) {
                                    grid.api.setPage(0);
                                }
                                return apply(grid, { row: { to: 'first' }, column: { to: 'first' } });
                            }
                            return apply(grid, { column: { to: 'first' } });
                        case 'End':
                            // The last **loaded** row: see the module comment.
                            return jump
                                ? apply(grid, { row: { to: 'last' }, column: { to: 'last' } })
                                : apply(grid, { column: { to: 'last' } });
                        case 'PageDown':
                            return apply(grid, { row: { by: pageRows } });
                        case 'PageUp':
                            return apply(grid, { row: { by: -pageRows } });
                        default:
                            return false;
                    }
                },
                [idsOf, apply, treeKey, table, cursorRef],
            );

            const attributesFor = (grid: GridContext<TRow>, rowId: RowId, columnId: string) => {
                const cursor = cursorOf(grid);
                const active = cursor !== null && cursor.rowId === rowId && cursor.columnId === columnId;
                return {
                    tabIndex: active ? 0 : -1,
                    'data-gw-cell': cellKey(rowId, columnId),
                    className: active ? 'gw-cell--focused' : undefined,
                    // Clicking a cell, or Tab landing on it, moves the cursor there: the roving
                    // tabIndex has to follow real focus, or the grid would have two ideas of where
                    // the reader is.
                    onFocus: (event: { readonly currentTarget: HTMLElement }) => {
                        // Not the table wrapper's ref: `GridTable` keeps only the last `ref` it is
                        // handed and `virtualRows()` takes one, so an add-on that also took it would
                        // break windowing or itself depending on the listed order, with nothing
                        // failing. `columnLayout()` reaches the table this way for the same reason.
                        table.current = event.currentTarget.closest('table');
                        if (!active) moveTo({ rowId, columnId });
                    },
                };
            };

            // Renders nothing; it exists to read the contexts other add-ons publish, from a place
            // that is inside their providers. A slot-rendered component is, and `setup` is not.
            const Bridge = () => {
                treeRef.current = useOptionalTreeContext<TRow>();
                scrollRef.current = useVirtualScroll();
                return null;
            };

            return {
                overlay: () => <Bridge />,
                tableKeyDown: onKeyDown,
                cellAttributes: (row, column, grid) => attributesFor(grid, row.id, column.id),
                ...(includeExtras
                    ? { extraCellAttributes: (row, columnId, grid) => attributesFor(grid, row.id, columnId) }
                    : {}),
                provide: (children, grid) => {
                    gridRef.current = grid;
                    const cursor = cursorOf(grid);
                    const { columnIds } = idsOf(grid);
                    const controller: CellNavigationController = {
                        activeCell: cursor,
                        columnIds,
                        isActive: (rowId, columnId) =>
                            cursor !== null && cursor.rowId === rowId && cursor.columnId === columnId,
                        focusCell: (cell) => {
                            const current = gridRef.current;
                            if (!current) return false;
                            const ids = idsOf(current);
                            if (!ids.rowIds.includes(cell.rowId) || !ids.columnIds.includes(cell.columnId)) return false;
                            moveTo(cell);
                            revealRow(current, cell.rowId);
                            return true;
                        },
                    };
                    return <CellNavigationProvider value={controller}>{children}</CellNavigationProvider>;
                },
            };
        },
    };
}
