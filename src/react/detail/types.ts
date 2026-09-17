import type { ReactNode } from 'react';
import type { GridRow, RowId } from '../../core/types';
import type { GridContext } from '../addons/types';

/** What `render` is handed for one expanded row. */
export interface RowDetailContext<TRow> {
    readonly row: GridRow<TRow>;
    /**
     * The consumer's own row, unwrapped with `rowDataOf`.
     *
     * `row.data` is a `TreeNode<TRow>` in a grid that also lists `treeData()`. A renderer written
     * against the consumer's type must not have to know that, so the unwrapping happens here, the
     * same way the tree does it for columns and `onSelectionChange`.
     */
    readonly data: TRow;
    readonly grid: GridContext<TRow>;
    /** Collapses this panel: for a "Close" button inside it. */
    readonly close: () => void;
}

export interface RowDetailOptions<TRow> {
    /**
     * The panel's content. Called only for an expanded row, so a component that fetches its own
     * data is the lazy load; there is no `loadDetail` because nothing but React needs the result.
     *
     * Returning `null` or `undefined` renders no panel row at all. Prefer `hasDetail` when the
     * answer is known without rendering: it is asked before the toggle is drawn, so the row does
     * not get a control that opens nothing.
     */
    readonly render: (context: RowDetailContext<TRow>) => ReactNode;
    /** Whether this row can be expanded at all. Default: every row can. */
    readonly hasDetail?: (row: GridRow<TRow>, grid: GridContext<TRow>) => boolean;
    /**
     * Names the row in the toggle's accessible name and the panel's label.
     *
     * Default: the text of the first visible column. A column of identical "Show details" buttons
     * tells a screen reader nothing about which row each one belongs to.
     */
    readonly rowLabel?: (data: TRow, grid: GridContext<TRow>) => string;
    /** Expanded on the first render. Never passed to `onExpandedChange`. */
    readonly initialExpanded?: readonly RowId[];
    /** Called after an expansion change has been committed and rendered, with every expanded id. */
    readonly onExpandedChange?: (expanded: readonly RowId[]) => void;
    /** At most one panel open at a time. Default false. */
    readonly single?: boolean;
    /**
     * Where the toggle column goes. `'none'` contributes none, for a `<GridDetailToggle />` you
     * place yourself in a cell renderer. Default `'start'`.
     */
    readonly toggle?: 'start' | 'end' | 'none';
    /**
     * Keep the expansion of rows the query moved away from, so paging back reopens them. Default
     * true. False for a source whose row ids are not stable across pages.
     */
    readonly persistAcrossPages?: boolean;
    /** Class on the panel's region, beside `gw-detail-panel`. */
    readonly className?: string;
    /**
     * Called before every expansion change the add-on commits, including one made through the
     * controller. Return false to refuse it.
     *
     * It narrows and never widens: a row `hasDetail` already refuses stays refused whatever this
     * returns.
     */
    readonly canToggle?: (rowId: RowId, expanded: boolean) => boolean;
    /** Receives the controller once it exists, and `null` when the grid unmounts. */
    readonly controllerRef?: (controller: RowDetailController | null) => void;
}

/**
 * Expansion, and everything that changes it.
 *
 * Reach it with `useRowDetail()` from anywhere inside a grid that lists `rowDetail()`: a toolbar
 * button, a keyboard shortcut, a control in the panel itself. The built-in toggle uses exactly this
 * and nothing else.
 */
export interface RowDetailController {
    /** Every expanded id, including ids of rows the current page does not hold. */
    readonly expanded: readonly RowId[];
    isExpanded(rowId: RowId): boolean;
    /** False when `hasDetail` said so, or when `canToggle` refuses the change. */
    allows(rowId: RowId, expanded: boolean): boolean;
    expand(rowId: RowId): void;
    collapse(rowId: RowId): void;
    toggle(rowId: RowId): void;
    /**
     * Expands every row the grid is currently holding that has detail.
     *
     * The rows on other pages are not in the grid, so they are not expanded and are not counted.
     * There is deliberately no "everything is expanded" flag: it would be a claim about rows that
     * have never been fetched.
     */
    expandAll(): void;
    /** Collapses everything, including rows the current page does not hold. */
    collapseAll(): void;
}

export interface GridDetailToggleProps {
    readonly rowId: RowId;
    readonly className?: string;
}

/** The presentational row the add-on renders, exported for a body composed by hand. */
export interface GridRowDetailProps {
    readonly rowId: RowId;
    readonly children: ReactNode;
    readonly className?: string;
}

export interface RowDetailProviderProps {
    readonly controller: RowDetailController;
    /**
     * Names a row in the toggle's accessible name and the panel's label.
     *
     * The one place both of them can read it from, so a `<GridDetailToggle />` placed by hand is
     * named the same way the add-on's own column is. Omit it and the grid's first visible column
     * supplies the name.
     */
    readonly rowLabel?: (rowId: RowId) => string;
    readonly children: ReactNode;
}
