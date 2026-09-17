import { createContext, useContext, useId, useMemo } from 'react';
import { GridwrightError } from '../../core/errors';
import type { RowId } from '../../core/types';
import type { GridContext } from '../addons/types';
import { useGridwrightContext } from '../context';
import type { RowDetailController, RowDetailProviderProps } from './types';

interface RowDetailContextValue {
    readonly controller: RowDetailController;
    /** Unique to this grid, so two grids on one page cannot produce the same panel `id`. */
    readonly idPrefix: string;
    readonly rowLabel: (rowId: RowId) => string;
}

const RowDetailContext = createContext<RowDetailContextValue | null>(null);

/**
 * How a row is named when nobody says otherwise: the text of its first visible column.
 *
 * That is the piece of the row a reader is already using to tell it apart, so it is what a toggle
 * should be called. A row the current page does not hold, and a grid with no visible column, fall
 * back to the row id, which is at least unique.
 */
export function firstColumnText<TRow>(grid: GridContext<TRow>, rowId: RowId): string {
    const row = grid.state.rows.find((candidate) => candidate.id === rowId);
    if (!row) return String(rowId);
    const column = grid.columns.find((candidate) => !candidate.hidden);
    // `getText` is the resolved column's, so a tree grid's wrapped columns unwrap the node for us.
    return (column ? column.getText(row.data) : '') || String(rowId);
}

/**
 * Publishes the expansion controller to the toggle, the panel and anything a consumer renders.
 *
 * The `id` prefix is generated here rather than in each component, because the toggle's
 * `aria-controls` has to name the very element the panel renders, and two `useId()` calls produce
 * two different values.
 */
export function RowDetailProvider({ controller, rowLabel, children }: RowDetailProviderProps) {
    const grid = useGridwrightContext();
    const idPrefix = useId();

    const value = useMemo<RowDetailContextValue>(
        () => ({ controller, idPrefix, rowLabel: rowLabel ?? ((rowId) => firstColumnText(grid, rowId)) }),
        [controller, idPrefix, rowLabel, grid],
    );

    return <RowDetailContext.Provider value={value}>{children}</RowDetailContext.Provider>;
}

/** The expansion controller. Throws outside a grid that lists `rowDetail()`. */
export function useRowDetail(): RowDetailController {
    const value = useContext(RowDetailContext);
    if (!value) {
        throw new GridwrightError('[gridwright] useRowDetail() needs a grid that lists the rowDetail() add-on.', { retryable: false });
    }
    return value.controller;
}

/** The controller if this grid has one, so a shared part works with and without the add-on. */
export function useOptionalRowDetail(): RowDetailController | null {
    return useContext(RowDetailContext)?.controller ?? null;
}

/** What names a row in the toggle and the panel. Internal: the naming rule, not a public seam. */
export function useRowLabel(): (rowId: RowId) => string {
    const value = useContext(RowDetailContext);
    return value?.rowLabel ?? ((rowId) => String(rowId));
}

/**
 * The panel's element id, shared by the toggle's `aria-controls` and the region itself.
 *
 * The row id is encoded because it becomes an IDREF: a raw id containing a space would silently
 * turn one `aria-controls` reference into two, both of them wrong.
 */
export function usePanelId(rowId: RowId): string {
    const value = useContext(RowDetailContext);
    return `${value?.idPrefix ?? ':gw:'}detail-${encodeURIComponent(String(rowId))}`;
}
