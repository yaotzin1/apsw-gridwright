import { useCallback, useRef } from 'react';
import type { ClipboardEvent, KeyboardEvent } from 'react';
import type { RowId } from '../../core/types';
import type { GridAddon, GridContext } from '../addons/types';
import { useOptionalTreeContext } from '../tree/context';
import type { TreeContextValue } from '../tree/context';
import { useVirtualScroll } from '../virtual';
import type { VirtualScroll } from '../virtual';
import { addonMessages } from '../addons/context';
import { copyCell, copyRows, isCopyShortcut } from './clipboard';
import type { ClipboardPayload } from './clipboard';
import { CellNavigationProvider } from './context';
import { CELL_NAVIGATION_ADDON, cellNavigationMessages } from './messages';
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
            const copyEnabled = options.copy !== false;

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

            /**
             * What a copy right now would put on the clipboard: the selected rows that are loaded,
             * or else the cell under the cursor. Null when the cursor is on a cell with no data
             * behind it -- the selection checkbox, a column opted out of export -- and the browser's
             * own copy is left to do whatever it would have done.
             */
            const payloadOf = useCallback(
                (grid: GridContext<TRow>): ClipboardPayload | null => {
                    if (grid.state.selectedIds.length > 0) {
                        const rows = grid.api.getSelectedRows();
                        if (rows.length > 0) return copyRows(rows, grid.columns);
                    }
                    const { rowIds, columnIds } = idsOf(grid);
                    const cursor = resolveCursor(cursorRef.current, rowIds, columnIds);
                    if (cursor === null) return null;
                    const column = grid.columns.find((candidate) => candidate.id === cursor.columnId);
                    const row = grid.state.rows.find((candidate) => candidate.id === cursor.rowId);
                    return column && row ? copyCell(row.data, column) : null;
                },
                [idsOf, cursorRef],
            );

            // Set between the copy shortcut's keydown and the `copy` event it produces; see below.
            const armed = useRef(false);

            /**
             * Makes sure the browser fires `copy`, without taking focus or the clipboard API.
             *
             * The copy itself happens in the browser's own `copy` event, below, because that is the
             * one route every browser on every operating system honours: it needs no permission, no
             * secure context and no `allow="clipboard-write"` on an embedding iframe, it carries both
             * flavours synchronously, and it fires for whatever the platform calls copy -- `Cmd+C`,
             * `Ctrl+C`, `Ctrl+Insert`, the Edit menu. `navigator.clipboard` has none of those
             * properties: it is absent on a plain-HTTP page, refused in a cross-origin frame without
             * a permissions policy, and asynchronous, so it fails after the keypress is over.
             *
             * The catch is that Firefox and Safari fire `copy` only when something is selected, and
             * a focused cell selects nothing. So the shortcut's keydown selects the focused cell's
             * text -- its row's, or the table's, when the cell is empty -- and lets the browser carry
             * on. The handler below replaces what the browser was about to copy and clears the
             * selection again.
             */
            const armCopy = useCallback(
                (event: KeyboardEvent<HTMLTableElement>, grid: GridContext<TRow>): void => {
                    const document = event.currentTarget.ownerDocument;
                    const selection = document.getSelection();
                    // The reader's own selection wins: text dragged across and copied is that text.
                    if (!selection || !selection.isCollapsed) return;
                    if (payloadOf(grid) === null) return;
                    const target = event.target instanceof Element ? event.target : null;
                    const anchor = [target?.closest('td, th'), target?.closest('tr'), event.currentTarget].find(
                        (candidate) => candidate && (candidate.textContent ?? '').trim() !== '',
                    );
                    if (!anchor) return;
                    const range = document.createRange();
                    range.selectNodeContents(anchor);
                    selection.removeAllRanges();
                    selection.addRange(range);
                    armed.current = true;
                },
                [payloadOf],
            );

            /** Clears a selection `armCopy` made whose `copy` never came. */
            const disarm = useCallback((document: Document): void => {
                if (!armed.current) return;
                armed.current = false;
                document.getSelection()?.removeAllRanges();
            }, []);

            const onCopy = useCallback(
                (event: ClipboardEvent<HTMLTableElement>, grid: GridContext<TRow>): void => {
                    const wasArmed = armed.current;
                    armed.current = false;
                    const target = event.target instanceof Element ? event.target : null;
                    // A grid nested in this one's detail row copies its own rows, not these.
                    if (target?.closest('table') !== event.currentTarget) return;
                    if (insideInteractive(target)) return;
                    const selection = event.currentTarget.ownerDocument.getSelection();
                    if (!wasArmed && selection && !selection.isCollapsed) return;

                    const payload = payloadOf(grid);
                    if (payload === null) return;
                    event.clipboardData.setData('text/plain', payload.text);
                    event.clipboardData.setData('text/html', payload.html);
                    event.preventDefault();
                    if (wasArmed) selection?.removeAllRanges();

                    const t = addonMessages(grid.translator, grid.contributions as never, CELL_NAVIGATION_ADDON, cellNavigationMessages);
                    grid.announce(payload.rows === null ? t('copiedCell') : t('copiedRows', { count: payload.rows }));
                },
                [payloadOf],
            );

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
                    disarm(event.currentTarget.ownerDocument);

                    // False either way: the browser's own copy has to run for `onCopy` to.
                    if (isCopyShortcut(event)) {
                        if (copyEnabled && !event.repeat) armCopy(event, grid);
                        return false;
                    }

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
                [idsOf, apply, treeKey, table, cursorRef, disarm, armCopy, copyEnabled],
            );

            /**
             * Which rows were actually rendered, this pass and the one before.
             *
             * Under `virtualRows()` only a slice of `state.rows` is in the document, and a cell that
             * is not rendered cannot carry the tab stop. `cellAttributes` is called for exactly the
             * mounted cells, so collecting the ids it is asked about is the add-on's only honest
             * view of the window -- the add-on contract exposes no range, and reaching into
             * `virtualRows()` for one would couple the two.
             *
             * The previous pass is what this render can read: `provide` runs before the body, so the
             * current pass has not happened yet. A render behind is enough, because scrolling
             * re-renders and the answer converges on the next frame.
             */
            const rendered = useRef<{ previous: readonly RowId[]; current: RowId[] }>({ previous: [], current: [] });

            /**
             * Where the tab stop goes, which is not always where the cursor is.
             *
             * Scroll a windowed grid until the cursor's row unmounts and every rendered cell would
             * be `tabIndex="-1"`: the grid would have **no** tab stop, and a keyboard user could not
             * get into it at all until they scrolled back. The stop falls back to the same column of
             * the first rendered row, so Tab lands where the reader is looking, and focusing it
             * moves the cursor there through the usual `onFocus` path.
             *
             * Only when the previous pass rendered something and did not include the cursor's row:
             * on the first render, and without windowing, this is always the cursor itself.
             */
            const tabStopOf = (cursor: ActiveCell | null): ActiveCell | null => {
                if (cursor === null) return null;
                const seen = rendered.current.previous;
                if (seen.length === 0 || seen.includes(cursor.rowId)) return cursor;
                const first = seen[0];
                return first === undefined ? cursor : { rowId: first, columnId: cursor.columnId };
            };

            const attributesFor = (grid: GridContext<TRow>, rowId: RowId, columnId: string) => {
                const cursor = cursorOf(grid);
                if (!rendered.current.current.includes(rowId)) rendered.current.current.push(rowId);
                const stop = tabStopOf(cursor);
                const active = stop !== null && stop.rowId === rowId && stop.columnId === columnId;
                // The ring stays on the cursor even when the tab stop has fallen back to a visible
                // row: the two are different questions, and painting the fallback would tell the
                // reader their cursor had moved when it has not.
                const onCursor = cursor !== null && cursor.rowId === rowId && cursor.columnId === columnId;
                return {
                    tabIndex: active ? 0 : -1,
                    'data-gw-cell': cellKey(rowId, columnId),
                    className: onCursor ? 'gw-cell--focused' : undefined,
                    // Clicking a cell, or Tab landing on it, moves the cursor there: the roving
                    // tabIndex has to follow real focus, or the grid would have two ideas of where
                    // the reader is.
                    onFocus: (event: { readonly currentTarget: HTMLElement }) => {
                        // Not the table wrapper's ref: `GridTable` keeps only the last `ref` it is
                        // handed and `virtualRows()` takes one, so an add-on that also took it would
                        // break windowing or itself depending on the listed order, with nothing
                        // failing. `columnLayout()` reaches the table this way for the same reason.
                        table.current = event.currentTarget.closest('table');
                        if (!onCursor) moveTo({ rowId, columnId });
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
                messages: cellNavigationMessages,
                overlay: () => <Bridge />,
                tableKeyDown: onKeyDown,
                ...(copyEnabled
                    ? {
                          tableAttributes: (grid: GridContext<TRow>) => ({
                              onCopy: (event: ClipboardEvent<HTMLTableElement>) => onCopy(event, grid),
                          }),
                      }
                    : {}),
                cellAttributes: (row, column, grid) => attributesFor(grid, row.id, column.id),
                ...(includeExtras
                    ? { extraCellAttributes: (row, columnId, grid) => attributesFor(grid, row.id, columnId) }
                    : {}),
                provide: (children, grid) => {
                    gridRef.current = grid;
                    // Start of the render pass, before the body renders any cell: what the last one
                    // saw becomes the window this pass reads, and collection begins again.
                    rendered.current = { previous: rendered.current.current, current: [] };
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
