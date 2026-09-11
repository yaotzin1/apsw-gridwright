import type { GridError, GridStatus, SortDirection } from '../../core/types';
import type { GridwrightLabels } from '../types';

/** A sort the reader has just caused, and the header text to name it by. */
export interface SortAnnouncement {
    readonly columnHeader: string;
    readonly direction: SortDirection | null;
}

/**
 * What the announcement is derived from.
 *
 * Every field is already published on `GridState`. Nothing here asks the engine for anything it
 * does not already say, which is why the feature is invisible across the local/remote seam.
 */
export interface AnnouncementInput {
    readonly status: GridStatus;
    readonly error: GridError | null;
    readonly rowCount: number;
    readonly totalRows: number;
    readonly isTotalExact: boolean;
    /** Zero-based position of the first rendered row in the whole result set. */
    readonly firstRowIndex: number;
    /** False for a virtualized grid, where a from-to range describes the window, not the result. */
    readonly paginated: boolean;
    /** The sort that changed since the last announcement, if one did. */
    readonly sortChange: SortAnnouncement | null;
    readonly labels: GridwrightLabels;
}

/** The ARIA row numbering for one table, computed once rather than per row. */
export interface RowNumbering {
    /** `aria-rowcount`: header-inclusive, or -1 when the total is not exact. */
    readonly rowCount: number;
    /** Turns a zero-based absolute row position into its header-inclusive `aria-rowindex`. */
    readonly indexOf: (absolutePosition: number) => number;
}
