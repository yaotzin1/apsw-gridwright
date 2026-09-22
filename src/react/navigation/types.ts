import type { RowId } from '../../core/types';

/**
 * Which cell the grid's single Tab stop is on.
 *
 * Identified by ids rather than indices, so a sort, a filter or a new page keeps the cursor on the
 * same cell when that row and column are still present, and falls back to the first cell when they
 * are not. A row index is a position in a result set that sorting, filtering and paging all
 * rewrite; an id is the row.
 *
 * `columnId` may name an extra column contributed by another add-on -- the `selection()` checkbox,
 * the `rowDetail()` toggle -- because those cells are part of the row a reader moves along.
 */
export interface ActiveCell {
    readonly rowId: RowId;
    readonly columnId: string;
}

export interface CellNavigationOptions {
    /**
     * The cell the cursor starts on. Default: the first cell of the first row, chosen on the first
     * render that has rows.
     */
    readonly initialCell?: ActiveCell;
    /**
     * Called after the cursor has moved and the cell has rendered, for a consumer that wants to
     * persist or mirror it.
     *
     * Never called on mount: the first position is a default this add-on chose rather than a move
     * the reader made, and a handler that persists it would otherwise overwrite a restored cursor
     * on every first paint. The same rule `columnLayout({ onChange })` follows.
     */
    readonly onActiveCellChange?: (cell: ActiveCell | null) => void;
    /**
     * Whether extra columns contributed by other add-ons are reachable with the arrow keys.
     * Default true.
     *
     * A reader moving along a row reads the whole row, and the leftmost thing in it -- usually the
     * selection checkbox -- being reachable only by Tab is a hole. False confines the cursor to
     * data columns and leaves those controls in the Tab order, which is how a grid behaved before
     * this add-on existed.
     */
    readonly includeExtraColumns?: boolean;
    /**
     * Whether the platform's copy shortcut copies from the grid. Default true.
     *
     * With rows selected it copies the loaded ones, with a header row; otherwise the cell under the
     * cursor. Both as tab-separated text and as an HTML table, resolved the way an export resolves
     * them. Any copy shortcut works -- `Ctrl+C`, `Cmd+C`, `Ctrl+Insert` -- and text the reader has
     * selected with the pointer is copied as that text instead. False leaves copying to the browser.
     */
    readonly copy?: boolean;
}

/**
 * The cursor, for a control of your own and for another add-on.
 *
 * `focusCell` is what the key handler itself calls, so a button that moves the cursor and the arrow
 * key that moves it cannot disagree about what happens.
 */
export interface CellNavigationController {
    readonly activeCell: ActiveCell | null;
    /** The ids the cursor may visit in a row, in painting order, extra columns included. */
    readonly columnIds: readonly string[];
    isActive(rowId: RowId, columnId: string): boolean;
    /** Moves the cursor there when that cell exists, and focuses it. Returns whether it moved. */
    focusCell(cell: ActiveCell): boolean;
}
